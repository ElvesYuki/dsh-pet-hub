#include "lift_wake.h"
#include "sleep_wake.h"

#include <cassert>
#include <cmath>

namespace {
using vp8_daily::LiftWake;
constexpr int64_t interval = 40000;
constexpr uint32_t armed = 5;

RoundMotion pose(int angle, int gyro = 0, int magnitude = 1000) {
  const double radians = angle * 3.141592653589793 / 180;
  return {{int(std::lround(std::sin(radians) * magnitude)), 0, int(std::lround(std::cos(radians) * magnitude))},
          {0, gyro, 0}};
}

struct Scenario {
  LiftWake detector;
  int64_t now{};
  bool tick(const std::optional<RoundMotion> &sample, uint32_t window = armed) {
    now += interval;
    return detector.observe(sample, now, window);
  }
  void still(int angle, int count, uint32_t window = armed) {
    for (int i = 0; i < count; ++i) assert(!tick(pose(angle), window));
  }
  void pickup(int from, int to, uint32_t window = armed) {
    assert(!tick(pose(from + (to - from) / 2, 90000), window));
    assert(!tick(pose(to, 31000), window));
    still(to, 4, window);
    assert(tick(pose(to), window));
    still(to, 20, window);
  }
};
}

int main() {
  // A stable position can be horizontal, tilted, or upright before sleeping.
  for (const auto start : {0, 45, 90}) {
    Scenario scenario;
    scenario.still(start, 11, 0);
    scenario.pickup(start, start + 37);
    scenario.still(start + 37, 11, 0);
    scenario.pickup(start + 37, start + 75, 9);
  }

  Scenario desk;
  desk.still(0, 11, 0);
  assert(!desk.tick(pose(0)));
  assert(!desk.tick(pose(50, 110000, 3500))); // Knock.
  assert(!desk.tick(pose(45, 110000, 250)));  // Brief free-fall signature.
  desk.still(0, 8);
  // Translation can tilt the measured acceleration momentarily but provides no rotation.
  for (int i = 0; i < 8; ++i) assert(!desk.tick(pose(35, 0)));
  desk.still(0, 8);
  for (int i = 0; i < 8; ++i) assert(!desk.tick(RoundMotion{{0, 0, 1000}, {0, 0, 100000}}));
  desk.still(0, 8);
  assert(!desk.tick(pose(18, 42000)));
  desk.still(18, 8);
  desk.still(0, 3);
  for (int angle = 15; angle <= 180; angle += 15) assert(!desk.tick(pose(angle, 160000)));
  desk.still(180, 10);
  Scenario slow_flip;
  slow_flip.still(0, 11, 0);
  for (int angle = 1; angle <= 180; ++angle) assert(!slow_flip.tick(pose(angle, 25000)));
  slow_flip.still(180, 10);

  Scenario flick;
  flick.still(0, 11, 0);
  assert(!flick.tick(pose(36, 32000)));
  flick.still(36, 2);
  flick.still(0, 8);
  flick.pickup(0, 45);

  Scenario gap;
  gap.still(0, 11, 0);
  assert(!gap.tick(pose(30, 40000)));
  assert(!gap.tick(std::nullopt));
  gap.still(30, 6);
  assert(!gap.tick(pose(50, 30000)));
  gap.now += 200000;
  gap.still(50, 12);
  gap.pickup(50, 83);

  Scenario inactive;
  inactive.still(0, 11, 0);
  assert(!inactive.tick(pose(45, 36000), 0));
  inactive.still(45, 15, 0);

  vp8_daily::LiftWakeEvent event;
  const auto take = [&](uint32_t now) { return event.take_age([=] { return now; }); };
  assert(!event.publish(event.window(), 1));
  event.arm();
  const auto first = event.window();
  assert(first && first == armed);
  event.arm();
  assert(event.window() == first && event.publish(first, 100));
  assert(!event.publish(first, 110));
  assert(take(120) == 20 && !take(120));
  event.end();
  assert(!event.window() && !event.publish(first, 125));
  event.arm();
  assert(event.window() != first && !event.publish(first, 130));
  assert(event.publish(event.window(), UINT32_MAX - 3) && take(4) == 8);
  event.end();
  event.arm();
  assert(event.publish(event.window(), 200) && !take(551));
  event.end();
  event.arm();
  assert(event.publish(event.window(), 600));
  event.discard();
  assert(!take(610));

  // Contact concurrent with a lift is handled through a single wake route.
  using Contact = vp8_daily::WakeContact::Result;
  vp8_daily::WakeContact contact;
  contact.guard_lift(1000000);
  assert(contact.observe(false, false, false, 1100000) == Contact::pass);
  assert(contact.observe(false, true, true, 1120000) == Contact::swallow);
  assert(contact.observe(false, true, true, 1500000) == Contact::swallow);
  assert(contact.observe(false, true, false, 1520000) == Contact::swallow);
  assert(contact.observe(false, true, true, 1700000) == Contact::pass);
  assert(contact.observe(true, true, true, 2500000) == Contact::wake);
  assert(contact.observe(false, true, false, 2550000) == Contact::swallow);
}

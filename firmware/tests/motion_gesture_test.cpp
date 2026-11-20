#include "motion_gesture.h"
#include <cassert>

using vp8_daily::Input;
using vp8_daily::MotionGesture;

namespace {
constexpr RoundMotion rest{{0, 0, 1000}, {2300, 7500, 0}};
constexpr RoundMotion tilted{{650, 0, 760}, {0, 0, 0}};
constexpr RoundMotion shaking_right{{850, 0, 1000}, {0, 0, 0}};
constexpr RoundMotion shaking_left{{-850, 0, 1000}, {0, 0, 0}};

struct Fixture {
  MotionGesture gesture;
  int64_t now{};

  Input sample(std::optional<RoundMotion> reading, bool eligible = true) {
    now += 40000;
    return gesture.observe(reading, now, eligible);
  }

  void quiet(const RoundMotion &reading, unsigned count) {
    for (unsigned i = 0; i < count; ++i) assert(sample(reading) == Input::none);
  }
};
}

int main() {
  Fixture f;
  f.quiet(rest, 100);
  f.quiet(tilted, 8);
  assert(f.sample(tilted) == Input::motion_tilt);
  f.quiet(tilted, 120);
  f.quiet(rest, 5); // Brief return to neutral is not a rearm.
  f.quiet(tilted, 20);
  f.quiet(rest, 10);
  f.quiet(tilted, 8);
  assert(f.sample(tilted) == Input::motion_tilt);

  Fixture mild;
  constexpr RoundMotion mild_tilt{{434, 0, 810}, {18000, 0, 0}}; // About 28 degrees, 0.92 g.
  mild.quiet(rest, 18);
  for (int i = 0; i < 20; ++i) assert(mild.sample(mild_tilt, false) == Input::none);
  mild.quiet(mild_tilt, 4);
  assert(mild.sample(std::nullopt) == Input::none);
  mild.quiet(mild_tilt, 3);
  assert(mild.sample(mild_tilt) == Input::motion_tilt);
  mild.gesture.retry_tilt();
  mild.quiet(mild_tilt, 8);
  assert(mild.sample(mild_tilt) == Input::motion_tilt);
  mild.quiet(rest, 70);
  mild.quiet(RoundMotion{{0, 0, -1000}, {0, 0, 0}}, 25); // Face-down is excluded.

  Fixture moved;
  constexpr RoundMotion new_rest{{-401, 827, 264}, {2226, 7492, -523}};
  constexpr RoundMotion from_new_rest{{-402, 464, 734}, {5000, 6700, 100}};
  moved.quiet(RoundMotion{{-12, 270, -1030}, {2210, 7632, -210}}, 18);
  moved.quiet(new_rest, 40); // Measured position is 92.5 degrees from boot.
  moved.quiet(from_new_rest, 8);
  assert(moved.sample(from_new_rest) == Input::motion_tilt);

  Fixture s;
  s.quiet(rest, 16);
  s.quiet(shaking_right, 1);
  s.quiet(rest, 2);
  assert(s.sample(shaking_left) == Input::motion_shake);
  s.quiet(shaking_right, 2);
  s.quiet(shaking_left, 2);
  s.quiet(rest, 80);
  s.quiet(shaking_right, 1);
  assert(s.sample(std::nullopt) == Input::none);
  s.quiet(shaking_left, 1);
  s.quiet(rest, 16);
  s.quiet(shaking_right, 1);
  s.quiet(rest, 2);
  s.quiet(RoundMotion{{4000, 0, 1000}, {0, 0, 0}}, 1); // Sandwiched impact resets the pulse.
  s.quiet(shaking_left, 1);
  s.quiet(rest, 16);
  s.quiet(shaking_right, 3); // Repeated samples in one direction do not trigger.

  Fixture startup;
  startup.quiet(rest, 10);
  assert(startup.sample(std::nullopt) == Input::none);
  startup.quiet(tilted, 40); // Motion during calibration establishes a new neutral.

  using vp8_daily::motion_event_at;
  using vp8_daily::motion_event_stamp;
  const auto event = motion_event_stamp(Input::motion_tilt, 0x3fffffff);
  assert(motion_event_at(event, 0x40000010, true) == Input::motion_tilt);
  assert(motion_event_at(event, 0x40000010, false) == Input::none);
  assert(motion_event_at(event, 0x40000400, true) == Input::none);
  assert(motion_event_at(0, 0, true) == Input::none);

  vp8_daily::TouchGesture touch;
  assert(!touch.pressed());
  assert(touch.observe(true, true, 100, 100, 0) == Input::none && touch.pressed());
  assert(touch.observe(true, false, 100, 100, 100000) == Input::wave && !touch.pressed());
}

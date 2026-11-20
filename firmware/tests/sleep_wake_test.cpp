#include "sleep_wake.h"
#include <cassert>
#include <vector>

namespace {
void test_scale() {
  using vp8_daily::SleepScale;
  constexpr int width = 402;
  std::vector<uint16_t> pixels(400 * 400, 1);
  pixels.front() = 2;
  pixels.back() = 3;
  std::array<uint16_t, width> row;
  SleepScale scale;
  for (int side = 384; side <= 400; side += 2) {
    scale.prepare(side);
    const int border = 1 + (400 - side) / 2;
    for (int y = 0; y < width; ++y) {
      row.fill(UINT16_MAX);
      scale.row(row.data(), pixels.data(), width, 1, y);
      for (int x = 0; x < width; ++x) {
        if (x < border || x >= width - border || y < border || y >= width - border) assert(row[x] == 0);
        else if (x == border && y == border) assert(row[x] == 2);
        else if (x == width - border - 1 && y == width - border - 1) assert(row[x] == 3);
        else assert(row[x] == 1);
      }
    }
  }
  std::fill(pixels.begin(), pixels.end(), 1);
  for (int i = 0; i < 400; ++i) pixels[i] = i;
  scale.prepare(384);
  scale.row(row.data(), pixels.data(), width, 1, 9);
  for (int x = 9; x < width - 9; ++x) {
    assert(row[x] + row[width - 1 - x] == 399);
    if (x > 9) assert(row[x] > row[x - 1]);
  }
}
} // namespace

int main() {
  using namespace vp8_daily;
  Inactivity clock;
  clock.activity(3000000);
  assert(!clock.request_preload(47999999));
  assert(clock.request_preload(48000000));
  assert(!clock.request_preload(60000000));
  assert(!clock.due(62999999));
  assert(clock.due(63000000));
  clock.activity(64000000);
  assert(!clock.request_preload(108999999));
  assert(clock.request_preload(109000000));
  assert(!clock.request_preload(109000001));
  assert(!clock.due(65000000));
  assert(clock.due(124000000));

  WakeContact wake;
  using Result = WakeContact::Result;
  assert(wake.observe(false, true, true, 1000) == Result::pass);
  assert(wake.observe(true, false, true, 2000) == Result::pass);
  assert(wake.observe(true, true, false, 3000) == Result::pass);
  assert(wake.observe(true, true, true, 4000) == Result::wake);
  assert(wake.observe(false, false, false, 5000) == Result::swallow);
  assert(wake.observe(false, true, true, 6000) == Result::swallow);
  assert(wake.observe(false, true, false, 7000) == Result::swallow);
  assert(wake.observe(false, true, true, 8000) == Result::pass);
  assert(wake.observe(true, true, true, 9000) == Result::wake);
  assert(sleeping(sleep_start_index) && sleeping(sleep_loop_index) && !sleeping(sleep_end_index));

  AppearanceRamp fade;
  constexpr uint8_t normal = 153;
  constexpr int64_t begin = 15000;
  assert(fade.next(begin) == -1);
  fade.arm(AppearanceRamp::dim, AppearanceRamp::awake);
  auto previous = fade.next(begin);
  assert(AppearanceRamp::brightness(previous, normal) > sleep_brightness);
  assert(SleepScale::side_for(previous) == 384);
  fade.sent(begin, previous, true);
  assert(fade.next(begin + 5000) == -1);
  for (int64_t elapsed = AppearanceRamp::interval_us; elapsed < AppearanceRamp::duration_us;
       elapsed += AppearanceRamp::interval_us) {
    const auto now = begin + elapsed;
    const auto level = fade.next(now);
    assert(level > previous && level < AppearanceRamp::awake);
    assert(SleepScale::side_for(level) >= SleepScale::side_for(previous));
    fade.sent(now, level, true);
    previous = level;
  }
  const auto after = begin + AppearanceRamp::duration_us + AppearanceRamp::interval_us;
  assert(fade.pending() && fade.next(after) == AppearanceRamp::awake);
  fade.sent(after, AppearanceRamp::awake, true);
  assert(!fade.pending());
  assert(SleepScale::side_for(AppearanceRamp::awake) == 400);
  assert(AppearanceRamp::brightness(AppearanceRamp::awake, normal) == normal);

  fade.arm(AppearanceRamp::awake, AppearanceRamp::dim);
  const auto first_dim = fade.next(0);
  fade.sent(0, first_dim, true);
  const auto dimmed = fade.next(170000);
  assert(dimmed < first_dim && SleepScale::side_for(dimmed) < 400);
  fade.sent(170000, dimmed, true);
  assert(fade.next(AppearanceRamp::duration_us) == AppearanceRamp::dim);
  fade.sent(AppearanceRamp::duration_us, AppearanceRamp::dim, false);
  assert(fade.pending() && fade.next(AppearanceRamp::duration_us + 500) == -1);
  const auto retry = AppearanceRamp::duration_us + AppearanceRamp::interval_us;
  assert(fade.next(retry) == AppearanceRamp::dim);
  fade.sent(retry, AppearanceRamp::dim, true);
  assert(!fade.pending());

  fade.arm(dimmed, AppearanceRamp::awake);
  const auto reversed = fade.next(0);
  assert(reversed > dimmed && reversed < first_dim);
  test_scale();
}

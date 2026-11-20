#include "ota_idle_policy.h"
#include "touch_gesture.h"

#include <cassert>

using vp8_daily::Input;

int main() {
  vp8_daily::TouchGesture gesture;
  int64_t now = 0;
  const auto touch = [&](int x, int y) { return gesture.observe(true, true, x, y, now += 50000); };
  const auto release = [&] { return gesture.observe(true, false, 0, 0, now += 50000); };

  assert(touch(210, 210) == Input::none);
  assert(touch(215, 217) == Input::none);
  assert(gesture.observe(false, false, 0, 0, now += 50000) == Input::none);
  assert(release() == Input::wave && release() == Input::none);

  assert(touch(260, 205) == Input::none);
  assert(touch(187, 211) == Input::none && touch(170, 210) == Input::none);
  assert(release() == Input::next && release() == Input::none);
  assert(touch(150, 210) == Input::none && touch(228, 227) == Input::none);
  assert(release() == Input::previous);
  assert(touch(200, 195) == Input::none && touch(290, 286) == Input::none);
  assert(release() == Input::none);
  assert(touch(200, 195) == Input::none && touch(203, 300) == Input::none);
  assert(release() == Input::none);
  assert(touch(200, 195) == Input::none && touch(157, 203) == Input::none);
  assert(touch(198, 195) == Input::none && release() == Input::none);
  assert(touch(200, 195) == Input::none);
  now += 1000000;
#if VP8_PLAYFUL_INTERACTIONS
  assert(touch(200, 195) == Input::petting);
#endif
  assert(release() == Input::none);

  const auto installed = [](uint16_t action) { return action == 0 || action == 5 || action == 24 || action == 77; };
  using vp8_ota::browse_action;
  assert(browse_action(0, Input::next, installed) == 5);
  assert(browse_action(5, Input::next, installed) == 24);
  assert(browse_action(24, Input::previous, installed) == 5);
  assert(browse_action(0, Input::previous, installed) == 77);
  assert(browse_action(77, Input::next, installed) == 5);
  assert(browse_action(5, Input::previous, installed) == 77);
  assert(browse_action(4, Input::next, installed) == 5);
  assert(!browse_action(0, Input::previous, [](uint16_t action) { return action == 0; }));
  assert(browse_action(24, Input::next, [](uint16_t action) { return action == 25; }) == 25);
}

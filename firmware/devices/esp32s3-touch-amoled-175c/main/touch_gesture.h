#pragma once

#include <algorithm>
#include <cstdint>
#include <cstdlib>

namespace vp8_daily {
enum class Input : uint8_t { none, wave, previous, next, surprise, usb_connected, battery_full, battery_low,
                             motion_shake, motion_tilt, wake_touch, wake_external, petting, open_menu, focus_due,
                             open_focus, wake_lift, control_ready };

class TouchGesture {
public:
  bool pressed() const { return down_; }

  Input observe(bool valid, bool pressed, int x, int y, int64_t now) {
    if (!valid) return Input::none;
    if (pressed && !down_) {
      down_ = true;
      start_x_ = x;
      start_y_ = y;
      started_ = now;
      dx_ = dy_ = max_x_ = max_y_ = 0;
#if VP8_PLAYFUL_INTERACTIONS
      long_press_fired_ = false;
#endif
    } else if (pressed) {
#if VP8_PLAYFUL_INTERACTIONS
      if (long_press_fired_) return Input::none;
#endif
      dx_ = x - start_x_;
      dy_ = y - start_y_;
      max_x_ = std::max(max_x_, std::abs(dx_));
      max_y_ = std::max(max_y_, std::abs(dy_));
#if VP8_PLAYFUL_INTERACTIONS
      if (now - started_ >= 900000 && max_x_ <= 20 && max_y_ <= 20) {
        long_press_fired_ = true;
        return Input::petting;
      }
#endif
    } else if (down_) {
      down_ = false;
#if VP8_PLAYFUL_INTERACTIONS
      if (long_press_fired_) return Input::none;
#endif
      const auto duration = now - started_;
      const auto horizontal = std::abs(dx_);
      if (duration <= 1200000 && horizontal >= 72 && 2 * horizontal >= 3 * max_y_)
        return dx_ < 0 ? Input::next : Input::previous;
#if VP8_PLAYFUL_INTERACTIONS
      if (duration <= 1200000 && dy_ <= -72 && -2 * dy_ >= 3 * max_x_) return Input::surprise;
#endif
      if (duration <= 400000 && max_x_ <= 20 && max_y_ <= 20) return Input::wave;
    }
    return Input::none;
  }

private:
  bool down_ = false;
#if VP8_PLAYFUL_INTERACTIONS
  bool long_press_fired_ = false;
#endif
  int start_x_ = 0, start_y_ = 0, dx_ = 0, dy_ = 0, max_x_ = 0, max_y_ = 0;
  int64_t started_ = 0;
};
} // namespace vp8_daily

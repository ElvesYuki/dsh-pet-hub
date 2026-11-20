#pragma once

#include <cstdint>
#include <cstdlib>

namespace vp8_daily {
class FocusTimer {
 public:
  static constexpr int seconds_per_session = 25 * 60;
  void start(int64_t now) {
    if (!active()) deadline_ = now + int64_t(seconds_per_session) * 1000000;
  }
  void cancel() { deadline_ = 0; }
  bool active() const { return deadline_ != 0; }
  bool expired(int64_t now) const { return active() && now >= deadline_; }
  bool take_completion(int64_t now) {
    if (!expired(now)) return false;
    cancel();
    return true;
  }
  int remaining(int64_t now) const {
    return !active() ? seconds_per_session : expired(now) ? 0 : int((deadline_ - now + 999999) / 1000000);
  }

 private:
  int64_t deadline_{};
};

enum class FocusPage { launcher, timer };
enum class FocusControl { none, pet, focus, timer_button, network };

struct FocusBox {
  int x, y, w, h;
  constexpr bool contains(int px, int py) const { return px >= x && px < x + w && py >= y && py < y + h; }
};

constexpr int focus_canvas = 400, focus_origin = 33;
constexpr FocusBox pet_card{50, 129, 300, 70}, focus_card{50, 212, 300, 70};
constexpr FocusBox network_card{85, 300, 230, 56};
constexpr FocusBox timer_button{114, 314, 172, 52};
constexpr FocusBox desktop_focus{133, 374, 200, 64}; // physical screen coordinates

class DesktopFocusTouch {
 public:
  bool observe(bool active, bool valid, bool pressed, int x, int y, int64_t now) {
    if (!valid) return false;
    if (!pressed) {
      const bool open = captured_ && eligible_ && active && now - started_ <= 400000;
      *this = {};
      return open;
    }
    if (!down_) {
      captured_ = eligible_ = active && desktop_focus.contains(x, y);
      started_ = now;
      start_x_ = x;
      start_y_ = y;
    } else if (!desktop_focus.contains(x, y) || std::abs(x - start_x_) > 20 || std::abs(y - start_y_) > 20) {
      eligible_ = false;
    }
    down_ = true;
    return false;
  }
  bool captured() const { return captured_; }

 private:
  bool down_{}, captured_{}, eligible_{};
  int64_t started_{};
  int start_x_{}, start_y_{};
};

class FocusTouch {
 public:
  FocusControl observe(FocusPage page, bool valid, bool pressed, int x, int y, bool has_network = false) {
    if (!valid) return FocusControl::none;
    if (!pressed) {
      const auto released = waiting_for_release_ ? FocusControl::none : target_;
      waiting_for_release_ = false;
      down_ = false;
      target_ = FocusControl::none;
      return released;
    }
    if (waiting_for_release_) return FocusControl::none;
    x -= focus_origin;
    y -= focus_origin;
    auto control = FocusControl::none;
    if (page == FocusPage::launcher) {
      if (pet_card.contains(x, y)) control = FocusControl::pet;
      if (focus_card.contains(x, y)) control = FocusControl::focus;
      if (has_network && network_card.contains(x, y)) control = FocusControl::network;
    } else if (timer_button.contains(x, y)) {
      control = FocusControl::timer_button;
    }
    if (!down_) target_ = control;
    else if (control != target_) target_ = FocusControl::none;
    down_ = true;
    return FocusControl::none;
  }

 private:
  bool waiting_for_release_ = true;
  bool down_ = false;
  FocusControl target_ = FocusControl::none;
};
} // namespace vp8_daily

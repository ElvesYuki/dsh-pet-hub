#pragma once

#include <algorithm>
#include <array>
#include <cstdint>

namespace vp8_daily {
constexpr unsigned sleep_start_index = 5, sleep_loop_index = 6, sleep_end_index = 7;
constexpr std::array<uint16_t, 3> sleep_actions{78, 79, 80};
constexpr uint8_t sleep_brightness = 24;

class AppearanceRamp {
 public:
  static constexpr int dim = 0, awake = 1000;
  static constexpr int64_t interval_us = 18000;
  static constexpr int64_t duration_us = 400000;

  void arm(int initial, int target) {
    initial_ = current_ = initial;
    target_ = target;
    started_at_ = -1;
    next_step_ = 0;
  }
  bool pending() const { return current_ != target_; }
  int64_t started_at() const { return started_at_; }

  int next(int64_t now) {
    if (!pending() || now < next_step_) return -1;
    if (started_at_ < 0) started_at_ = now;
    // Relative weights for both brightness and size, in either direction.
    constexpr std::array<uint8_t, 13> curve{3, 8, 15, 25, 36, 48, 60, 71, 81, 89, 95, 98, 100};
    const auto elapsed = now - started_at_;
    if (elapsed >= duration_us) return target_;
    const auto position = elapsed * int64_t(curve.size() - 1);
    const auto index = position / duration_us;
    const auto between = position % duration_us;
    const auto weight = curve[index] * (duration_us - between) + curve[index + 1] * between;
    const auto level = initial_ + (target_ - initial_) * weight / (100 * duration_us);
    return level == current_ ? -1 : int(level);
  }

  void sent(int64_t now, int level, bool ok) {
    next_step_ = now + interval_us;
    if (ok) current_ = level;
  }

  static constexpr uint8_t brightness(int level, uint8_t normal) {
    return sleep_brightness + (normal - sleep_brightness) * level / awake;
  }

 private:
  int initial_ = awake, current_ = awake, target_ = awake;
  int64_t started_at_ = -1;
  int64_t next_step_{};
};

class SleepScale {
 public:
  static constexpr int native_side = 400;
  static constexpr int dim_side = 384;

  static constexpr int side_for(int level) {
    return dim_side + 2 * (((native_side - dim_side) / 2 * level + AppearanceRamp::awake / 2) /
                           AppearanceRamp::awake);
  }

  void prepare(int visible) {
    if (visible_ == visible) return;
    visible_ = visible;
    for (int i = 0; i < visible_ / 2; ++i) {
      map_[i] = (2 * i + 1) * native_side / (2 * visible_);
      map_[visible_ - 1 - i] = native_side - 1 - map_[i];
    }
  }

  // The output still spans the whole native panel window, including its alignment border.
  void row(uint16_t *out, const uint16_t *pixels, int width, int native_border, int y) const {
    const int border = native_border + (native_side - visible_) / 2;
    const int src = y - border;
    if (src < 0 || src >= visible_) {
      std::fill_n(out, width, 0);
      return;
    }
    const auto *line = pixels + map_[src] * native_side;
    std::fill_n(out, border, 0);
    for (int i = 0; i < visible_; ++i) out[border + i] = line[map_[i]];
    std::fill_n(out + border + visible_, border, 0);
  }

 private:
  int visible_{};
  std::array<uint16_t, native_side> map_{};
};

inline bool sleeping(unsigned index) { return index == sleep_start_index || index == sleep_loop_index; }

class Inactivity {
 public:
  void activity(int64_t now) {
    last_activity_ = now;
    preload_requested_ = false;
  }
  bool request_preload(int64_t now) {
    if (preload_requested_ || now - last_activity_ < 45000000) return false;
    preload_requested_ = true;
    return true;
  }
  bool due(int64_t now) const { return now - last_activity_ >= 60000000; }

 private:
  int64_t last_activity_{};
  bool preload_requested_{};
};

class WakeContact {
 public:
  enum class Result { pass, wake, swallow };
  void guard_lift(int64_t now) { lift_guard_until_ = now + 300000; }
  Result observe(bool sleeping, bool valid, bool pressed, int64_t now) {
    if (held_) {
      if (valid && !pressed) held_ = false;
      return Result::swallow;
    }
    if (!valid || !pressed) return Result::pass;
    if (now < lift_guard_until_) {
      held_ = true;
      return Result::swallow;
    }
    if (!sleeping) return Result::pass;
    held_ = true;
    return Result::wake;
  }

 private:
  bool held_{};
  int64_t lift_guard_until_{};
};
} // namespace vp8_daily

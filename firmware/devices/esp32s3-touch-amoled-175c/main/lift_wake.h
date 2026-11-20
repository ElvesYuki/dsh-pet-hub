#pragma once

#include "motion_gesture.h"

#include <atomic>

namespace vp8_daily {
class LiftWake {
 public:
  bool observe(const std::optional<RoundMotion> &sample, int64_t now, uint32_t window) {
    using namespace motion_math;
    if (window_ != window) {
      window_ = window;
      detected_ = false;
      ready_ = window && stable_at_ >= 0 && now - stable_at_ <= 600000;
      ignore_until_ = 0;
      reset_motion();
    }
    if (!sample) {
      reset_motion();
      return false;
    }
    if (last_sample_ >= 0 && now - last_sample_ > 140000) {
      stable_since_ = stable_at_ = -1;
      ready_ = false;
      reset_motion();
    }
    last_sample_ = now;
    if (detected_) return false;
    const auto &gravity = sample->acceleration_mg;
    const auto magnitude = square(gravity);
    const auto rotation = square(sample->rotation_mdps);

    if (!window || !ready_) {
      const bool still = between(magnitude, 880 * 880, 1120 * 1120) && rotation < int64_t(16000) * 16000;
      if (!still || (stable_since_ >= 0 && square(delta(gravity, reference_)) > 100 * 100)) {
        stable_since_ = stable_at_ = -1;
      }
      if (still && stable_since_ < 0) {
        reference_ = gravity;
        stable_since_ = now;
      }
      if (still && now - stable_since_ >= 360000) {
        stable_at_ = now;
        ready_ = window != 0;
      }
      return false;
    }

    if (!between(magnitude, 450 * 450, 2100 * 2100) || within(gravity, opposite(reference_), 360)) {
      reset_motion();
      ignore_until_ = now + 160000;
      return false;
    }
    if (now < ignore_until_) return false;
    if (rotation >= int64_t(22000) * 22000) last_turn_ = now;
    if (last_turn_ < 0 || now - last_turn_ > 1100000 || rotation >= int64_t(16000) * 16000 ||
        !between(magnitude, 800 * 800, 1200 * 1200) ||
        within(gravity, reference_, 860)) {
      changed_since_ = -1;
      return false;
    }
    if (changed_since_ < 0) changed_since_ = now;
    detected_ = now - changed_since_ >= 160000;
    return detected_;
  }

 private:
  static motion_math::Vector opposite(const motion_math::Vector &a) { return {-a[0], -a[1], -a[2]}; }
  void reset_motion() { last_turn_ = changed_since_ = -1; }

  motion_math::Vector reference_{};
  int64_t stable_at_ = -1, stable_since_ = -1, last_sample_ = -1;
  int64_t last_turn_ = -1, changed_since_ = -1, ignore_until_{};
  uint32_t window_{};
  bool ready_{}, detected_{};
};

// Only the display opens a window, the IMU worker publishes, and playback consumes.
class LiftWakeEvent {
 public:
  void arm() {
    const auto previous = state_.load(std::memory_order_relaxed);
    if (!(previous & active)) state_.store((previous + 4U) | active, std::memory_order_release);
  }
  void end() { state_.fetch_and(~(active | pending), std::memory_order_acq_rel); }
  void discard() { state_.fetch_and(~pending, std::memory_order_acq_rel); }
  uint32_t window() const {
    const auto state = state_.load(std::memory_order_acquire);
    return (state & active) ? (state & ~pending) : 0;
  }
  bool publish(uint32_t window, uint32_t now_ms) {
    if (!window || state_.load(std::memory_order_acquire) != window) return false;
    detected_ms_.store(now_ms, std::memory_order_relaxed);
    return state_.compare_exchange_strong(window, window | pending, std::memory_order_release);
  }
  std::optional<uint32_t> take_age(auto now_ms) {
    const auto before = state_.fetch_and(~pending, std::memory_order_acq_rel);
    if (!(before & pending)) return std::nullopt;
    const auto detected = detected_ms_.load(std::memory_order_relaxed);
    const uint32_t age = now_ms() - detected;
    if (age > 350) return std::nullopt;
    return age;
  }

 private:
  static constexpr uint32_t active = 1U, pending = 2U;
  std::atomic<uint32_t> state_{}, detected_ms_{};
};
} // namespace vp8_daily

#pragma once

#include "round_motion.h"
#include "touch_gesture.h"

namespace vp8_daily {
namespace motion_math {
using Vector = std::array<int32_t, 3>;
inline bool between(int64_t value, int minimum, int maximum) { return minimum <= value && value <= maximum; }
inline Vector delta(const Vector &a, const Vector &b) {
  return {a[0] - b[0], a[1] - b[1], a[2] - b[2]};
}
inline int64_t dot(const Vector &a, const Vector &b) {
  return int64_t(a[0]) * b[0] + int64_t(a[1]) * b[1] + int64_t(a[2]) * b[2];
}
inline int64_t square(const Vector &a) { return dot(a, a); }
inline bool within(const Vector &a, const Vector &b, int cosine_squared_per_thousand) {
  const auto projection = dot(a, b);
  return projection > 0 && 1000 * projection * projection >= cosine_squared_per_thousand * square(a) * square(b);
}
} // namespace motion_math

class MotionGesture {
 public:
  Input observe(const std::optional<RoundMotion> &reading, int64_t now, bool eligible = true) {
    using namespace motion_math;
    if (last_valid_ >= 0 && now - last_valid_ > 140000) {
      clear_candidates();
      if (!calibrated_) stable_since_ = -1;
    }
    if (!reading) {
      pulse_at_ = -1;
      return Input::none;
    }
    last_valid_ = now;
    const auto &a = reading->acceleration_mg;
    const auto magnitude = square(a);
    const auto rotation = square(reading->rotation_mdps);
    const bool stable = between(magnitude, 780 * 780, 1250 * 1250) && rotation < int64_t(55000) * 55000;
    if (!calibrated_) {
      if (!stable || (stable_since_ >= 0 && square(delta(a, reference_)) > 120 * 120))
        stable_since_ = -1;
      if (stable && stable_since_ < 0) {
        reference_ = a;
        stable_since_ = now;
      }
      calibrated_ = stable_since_ >= 0 && now - stable_since_ >= 500000;
      return Input::none;
    }

    const auto change = delta(a, reference_);
    const auto distance = square(change);
    // Any individual reading outside this range is ignored as an impact or free fall.
    if (!between(magnitude, 350 * 350, 2600 * 2600)) {
      clear_candidates();
      return Input::none;
    }
    const auto projection = dot(a, reference_);
    // A steady change from lying flat to standing is a new resting pose. Keep a true flip excluded.
    if (stable && !within(a, reference_, 30) &&
        (projection >= 0 || 4 * projection * projection < magnitude * square(reference_))) {
      if (settled_at_ < 0 || square(delta(a, settled_heading_)) > 120 * 120) {
        settled_heading_ = a;
        settled_at_ = now;
      }
      if (now - settled_at_ >= 1300000) {
        reference_ = a;
        tilted_ = false;
        clear_candidates();
      }
      pulse_at_ = tilt_since_ = -1;
      return Input::none;
    }
    settled_at_ = -1;
    if (stable && within(a, reference_, 941)) { // Near the reference, about 14 degrees.
      if (neutral_since_ < 0) neutral_since_ = now;
      if (now - neutral_since_ >= 300000) tilted_ = false;
    } else neutral_since_ = -1;
    if (!eligible || now < next_event_) {
      pulse_at_ = tilt_since_ = -1;
      return Input::none;
    }

    if (pulse_at_ >= 0 && now - pulse_at_ > 500000) pulse_at_ = -1;
    const bool shaking = !between(magnitude, 850 * 850, 1150 * 1150) || rotation >= int64_t(35000) * 35000;
    if (shaking && distance >= 540 * 540) {
      if (pulse_at_ < 0) {
        pulse_ = change;
        pulse_at_ = now;
      } else if (now - pulse_at_ >= 60000 && dot(pulse_, change) <= -int64_t(400 * 400)) {
        return emit(Input::motion_shake, now);
      }
    }
    if (stable && !tilted_ && !within(a, reference_, 821) && within(a, reference_, 30)) { // 25–80 degrees.
      if (tilt_since_ < 0) tilt_since_ = now;
      if (now - tilt_since_ >= 320000) {
        tilted_ = true;
        return emit(Input::motion_tilt, now);
      }
    } else tilt_since_ = -1;
    return Input::none;
  }

  void retry_tilt() {
    tilted_ = false;
    next_event_ = 0;
    clear_candidates();
  }

 private:
  Input emit(Input event, int64_t now) {
    clear_candidates();
    next_event_ = now + 2500000;
    return event;
  }
  void clear_candidates() { pulse_at_ = tilt_since_ = neutral_since_ = settled_at_ = -1; }

  motion_math::Vector reference_{}, pulse_{}, settled_heading_{};
  int64_t stable_since_ = -1, tilt_since_ = -1, neutral_since_ = -1, pulse_at_ = -1;
  int64_t next_event_{};
  int64_t last_valid_ = -1;
  int64_t settled_at_ = -1;
  bool calibrated_{}, tilted_{};
};

// This mailbox fits in a lock-free ESP32-S3 word. The timestamp is in wrapped milliseconds.
inline uint32_t motion_event_stamp(Input event, uint32_t now_ms) {
  return (now_ms << 2) | (event == Input::motion_shake ? 1U : 2U);
}
inline Input motion_event_at(uint32_t stamp, uint32_t now_ms, bool eligible) {
  const auto type = stamp & 3;
  if (!eligible || !type || ((now_ms - (stamp >> 2)) & 0x3fffffff) > 700) return Input::none;
  return type == 1 ? Input::motion_shake : Input::motion_tilt;
}
} // namespace vp8_daily

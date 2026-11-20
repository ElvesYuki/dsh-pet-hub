#pragma once
#include "event_ready_model.h"

namespace round_touch_event_model {
enum class Health : uint32_t { Running, Stopping, Stopped, Fault };
// P0 policy on coherent worker snapshots, NOT the E1 wire/production monitor.
// Timeouts are measured from host observations, not real IRQ/stop timestamps.
// Display/CRC/resource/IO failure gates remain outside this touch-only policy.
class HealthModel {
 public:
  static constexpr uint64_t timeout_ms = 5000;
  Health observe(const Snapshot &s, uint64_t now_ms) {
    if (failed_) return Health::Fault;
    if (!s.generation || (!s.armed && (!s.stopped || s.in_flight)) ||
        s.fault.domain != Domain::None || s.read_errors || s.error_polls ||
        s.polls != s.no_event + s.error_polls + s.stopped_polls + s.reads ||
        uint32_t(s.reads - s.completed) != uint32_t(s.in_flight) ||
        s.valid + s.cancelled + s.suppressed != s.completed ||
        s.presses + s.releases > s.valid) return fault();
    if (!seen_) {
      generation_ = s.generation;
      progress_at_ = now_ms;
    } else if (now_ms < last_ms_ || generation_ != s.generation ||
               uint32_t(s.polls - last_polls_) >= 0x80000000u) {
      return fault();
    }
    if (!seen_ || s.polls != last_polls_) progress_at_ = now_ms;
    seen_ = true;
    last_ms_ = now_ms;
    last_polls_ = s.polls;
    if (terminated_ && (!s.stopped || s.in_flight)) return fault();
    if (s.stopped) {
      if (!s.in_flight) { terminated_ = true; return Health::Stopped; }
      if (!stopping_) { stopping_ = true; stopping_at_ = now_ms; }
      if (now_ms - stopping_at_ > timeout_ms) return fault();
      return Health::Stopping;
    }
    if (stopping_ || now_ms - progress_at_ > timeout_ms) return fault();
    return Health::Running;
  }
 private:
  Health fault() { failed_ = true; return Health::Fault; }
  uint64_t last_ms_ = 0, progress_at_ = 0, stopping_at_ = 0;
  uint32_t generation_ = 0, last_polls_ = 0;
  bool seen_ = false, failed_ = false, stopping_ = false, terminated_ = false;
};
} // namespace round_touch_event_model

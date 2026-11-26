#pragma once

#include "playback_control.h"

namespace vp8_control {
// Calls are serialized by the adapter. Only one decoder run can own a ticket.
class Playback {
 public:
  explicit Playback(uint32_t display_sequence = 0) : display_sequence_(display_sequence) {}
  Control &control() { return control_; }
  const std::optional<Ticket> &ticket() const { return selected_; }

  std::optional<Ticket> claim(uint64_t now, bool local_busy) {
    if (selected_) return std::nullopt;
    selected_ = control_.claim(now, local_busy);
    first_complete_ = false;
    return selected_;
  }
  bool can_submit(const Ticket &ticket, uint64_t now) {
    return selected_ == ticket && control_.tick(now) && control_.session() == ticket.session &&
           (first_complete_ || control_.owns(ticket));
  }
  bool first_dma(const Ticket &ticket, uint64_t now) {
    if (first_complete_ || !can_submit(ticket, now) || display_sequence_ == UINT32_MAX) return false;
    if (!control_.presented(ticket, now, display_sequence_ + 1)) return false;
    ++display_sequence_;
    first_complete_ = true;
    return true;
  }
  bool should_yield(uint64_t now, bool contact, bool background_ready) {
    if (!selected_) return background_ready && !contact && control_.tick(now) && control_.waiting();
    return !can_submit(*selected_, now) || (contact && !first_complete_) ||
           (first_complete_ && control_.waiting());
  }
  void finish(uint64_t now, bool missing = false) {
    if (selected_ && !first_complete_) {
      if (missing) control_.missing(*selected_, now);
      else control_.cancel(*selected_, now);
    }
    selected_.reset();
    first_complete_ = false;
  }

 private:
  Control control_;
  std::optional<Ticket> selected_;
  uint32_t display_sequence_{};
  bool first_complete_{};
};
} // namespace vp8_control

#pragma once
#include "../experimental/event_ready_model.h"
#include <cstddef>
#include <cstdio>

// Candidate only. Worker fields are copied together; IRQ time/sequence are
// independent observations, not a hardware packet/timestamp pair.
namespace round_touch_event {
struct Frame {
  round_touch_event_model::Snapshot sample{};
  uint32_t irq_us = 0, poll_us = 0, read_us = 0, done_us = 0, owner_error = 0;
};
constexpr size_t packet_capacity = 768;
using Checksum = uint32_t (*)(const uint8_t *, size_t);
bool snapshot(Frame &);
inline size_t format(const Frame &f, uint32_t seq, uint32_t drop,
                     char *out, size_t cap, Checksum crc) {
  if (!out || !cap || !crc) return 0;
  out[0] = 0;
  const auto &s = f.sample;
  const uint32_t values[] = {seq, drop, s.generation, s.produced, s.consumed,
    s.startup_discarded, s.polls, s.no_event, s.error_polls, s.stopped_polls,
    s.reads, s.completed, s.valid, s.read_errors, s.cancelled, s.suppressed,
    s.coalesced, s.presses, s.releases, uint32_t(s.first_read_error),
    s.armed, s.stopped, s.in_flight, uint32_t(s.contact), uint32_t(s.fault.domain),
    uint32_t(s.fault.code), f.owner_error, f.irq_us, f.poll_us, f.read_us, f.done_us};
  static constexpr const char *names[] = {"seq", "drop", "generation", "produced",
    "consumed", "startup", "polls", "no_event", "error_polls", "stopped_polls",
    "reads", "completed", "valid", "read_errors", "cancelled", "suppressed",
    "coalesced", "presses", "releases", "first_error", "armed", "stopped",
    "in_flight", "contact", "domain", "code", "owner_error", "irq_us",
    "poll_us", "read_us", "done_us"};
  static_assert(sizeof(values) / sizeof(values[0]) == sizeof(names) / sizeof(names[0]));
  int n = snprintf(out, cap, "@400E1");
  if (n < 0 || size_t(n) >= cap) return 0;
  size_t used = size_t(n);
  for (unsigned i = 0; i < sizeof(values) / sizeof(values[0]); ++i) {
    n = (i == 19 || i == 25)
      ? snprintf(out + used, cap - used, " %s=%ld", names[i], (long)int32_t(values[i]))
      : snprintf(out + used, cap - used, " %s=%lu", names[i], (unsigned long)values[i]);
    if (n < 0 || size_t(n) >= cap - used) { out[0] = 0; return 0; }
    used += size_t(n);
  }
  n = snprintf(out + used, cap - used, " crc=%08lx\n",
    (unsigned long)crc(reinterpret_cast<const uint8_t *>(out), used));
  if (n < 0 || size_t(n) >= cap - used) { out[0] = 0; return 0; }
  return used + size_t(n);
}
struct Emitter {
  uint32_t sequence = 0, drops = 0;
  template<class Write> bool emit(Write write, Checksum crc) {
    Frame f;
    if (!snapshot(f)) return false; // No worker publication yet, not a fake sample.
    char line[packet_capacity];
    const auto n = format(f, ++sequence, drops, line, sizeof(line), crc);
    const bool sent = n && write(line, n) == int(n);
    if (!sent) ++drops;
    return sent; // Single whole enqueue, never retry or wait.
  }
};
} // namespace round_touch_event

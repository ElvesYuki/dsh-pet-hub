#pragma once
#include <cstddef>
#include <cstdint>

// Diagnostic only. These counters do not establish optical presentation.
namespace round_observation {
enum Field : unsigned {
  Show, Full, Dirty, Equal, Pixels, Generation, Frame,
  FlushStart, FlushReturn, FlushBytes, Submit, SubmitError, SubmitFirstError,
  SubmitUs, Done, DoneUs, Registration, RegistrationError, RegistrationFirstError,
  RegistrationBypass, CompletionObserved, IoDelete, IoDeleteError,
  TouchRead, TouchValid, TouchError, TouchFirstError, TouchStage,
  PressEdge, Pressed, TouchUs, Count
};
struct Snapshot { uint32_t value[Count]{}; };
constexpr size_t packet_capacity = 1024;
using Checksum = uint32_t (*)(const uint8_t *, size_t);
// Snapshot values and low microsecond timestamps wrap modulo 2^32. The copy
// is individually atomic, not a transaction across fields or per-frame DMA.
Snapshot snapshot();
// Serialized-writer APIs: View/flush/submit require the original LVGL lock
// (also during startup clear); touch is playback-worker-owned.
void view(bool full, bool changed, uint32_t pixels, uint32_t generation,
          uint32_t frame);
void touch(bool valid, bool pressed, int error, unsigned stage);
size_t format(const Snapshot &, uint32_t sequence, uint32_t drops,
              char *out, size_t capacity, Checksum);
} // namespace round_observation

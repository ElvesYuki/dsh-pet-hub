#pragma once
#include "round_display_observation.h"
#include <atomic>

namespace round_observation {
// IDF disables generic hardware RMW atomics. Each field has ONE writer:
// The original LVGL lock serializes view/flush/submit (including startup clear),
// the SPI ISR owns done, the worker owns touch,
// and serialized setup/teardown owns registration/delete. Snapshot only reads.
// Atomic load/store avoids C++ races; increment is deliberately NOT fetch_add.
// Final Xtensa disassembly must prove inline loads/stores, no ISR library lock.
static_assert(sizeof(std::atomic<uint32_t>) == 4 &&
              alignof(std::atomic<uint32_t>) >= 4);
struct Counters {
  std::atomic<uint32_t> values[Count]{};
  __attribute__((always_inline)) inline void add(Field f, uint32_t n = 1) {
    const auto before = values[f].load(std::memory_order_relaxed);
    values[f].store(before + n, std::memory_order_relaxed);
  }
  __attribute__((always_inline)) inline void set(Field f, uint32_t n) {
    values[f].store(n, std::memory_order_relaxed);
  }
  bool first(Field f, int error) {
    if (error && values[f].load(std::memory_order_relaxed) == 0) {
      values[f].store(uint32_t(error), std::memory_order_relaxed);
      return true;
    }
    return false;
  }
  Snapshot copy() const {
    Snapshot s;
    for (unsigned i = 0; i < Count; ++i)
      s.value[i] = values[i].load(std::memory_order_relaxed);
    return s;
  }
};
} // namespace round_observation

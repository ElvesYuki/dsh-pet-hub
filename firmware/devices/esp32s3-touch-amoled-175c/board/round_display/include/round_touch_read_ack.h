#pragma once
#include <atomic>
#include <cstddef>
#include <cstdint>
#include <cstdio>

namespace round_touch_read_ack {
constexpr uint32_t capacity = 8;
constexpr size_t packet_capacity = 256;
struct Record {
  uint32_t ordinal = 0, at = 0, us = 0, received = 256;
  int32_t error = INT32_MIN;
};
// One worker publishes immutable records; main only reads published slots.
struct State {
  std::atomic<uint32_t> count{0}, lost{0}, rejected{0};
  Record records[capacity]{};
  void record(Record r) {
    const auto index = count.load(std::memory_order_relaxed);
    if (index == capacity) {
      lost.store(lost.load(std::memory_order_relaxed) + 1,
                 std::memory_order_relaxed);
      return;
    }
    records[index] = r;
    count.store(index + 1, std::memory_order_release);
  }
};
using Checksum = uint32_t (*)(const uint8_t *, size_t);
inline size_t format(Record r, uint32_t count, uint32_t lost, uint32_t rejected,
                     uint32_t seq, uint32_t drop, char *out, size_t cap,
                     Checksum crc) {
  if (!out || !cap || !crc)
    return 0;
  const int n = std::snprintf(
      out, cap,
      "@400A1 seq=%lu drop=%lu count=%lu lost=%lu rejected=%lu ordinal=%lu "
      "at=%lu us=%lu received=%lu error=%ld",
      (unsigned long)seq, (unsigned long)drop, (unsigned long)count,
      (unsigned long)lost, (unsigned long)rejected, (unsigned long)r.ordinal,
      (unsigned long)r.at, (unsigned long)r.us, (unsigned long)r.received,
      (long)r.error);
  if (n < 0 || size_t(n) >= cap) {
    out[0] = 0;
    return 0;
  }
  const auto check = crc(reinterpret_cast<const uint8_t *>(out), size_t(n));
  const int tail = std::snprintf(out + n, cap - size_t(n), " crc=%08lx\n",
                                  (unsigned long)check);
  if (tail < 0 || size_t(tail) >= cap - size_t(n)) {
    out[0] = 0;
    return 0;
  }
  return size_t(n + tail);
}
struct Emitter {
  uint32_t cursor = 0, seq = 0, drop = 0;
  template <class Write>
  void emit(const State &state, Write write, Checksum crc) {
    const auto count = state.count.load(std::memory_order_acquire);
    do {
      char line[packet_capacity];
      const auto r = cursor < count ? state.records[cursor] : Record{};
      const auto n = format(r, count, state.lost.load(std::memory_order_relaxed),
                            state.rejected.load(std::memory_order_relaxed),
                            ++seq, drop, line, sizeof(line), crc);
      if (!n || write(line, n) != int(n)) {
        ++drop;
        break;
      }
      if (cursor < count)
        ++cursor;
      else
        break;
    } while (cursor < count);
  }
};
} // namespace round_touch_read_ack

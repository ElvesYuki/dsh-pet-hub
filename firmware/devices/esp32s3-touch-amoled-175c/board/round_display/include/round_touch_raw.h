#pragma once
#include <atomic>
#include <cstddef>
#include <cstdint>
#include <cstdio>
#include <cstring>

namespace round_touch_raw {
constexpr uint32_t capacity = 8;
constexpr size_t packet_capacity = 384;
constexpr int32_t absent = INT32_MIN;
enum Flags : uint32_t { Tx = 1, Rx = 2, Data = 4, Mismatch = 8 };
struct Record {
  uint32_t ordinal = 0, at = 0;
  int32_t tx = absent, rx = absent, result = absent;
  uint32_t tx_n = 0, rx_n = 0, flags = 0;
  uint8_t data[10]{};
};
struct Snapshot {
  uint32_t count, lost, bound, foreign;
};
// Boot binds once, worker registers once, then one producer + main reader.
// No reset/reuse or concurrent teardown. Published records never change.
struct State {
  std::atomic<void *> io{nullptr}, touch{nullptr}, owner{nullptr};
  std::atomic<uint32_t> published{0}, lost{0}, foreign{0};
  Record records[capacity]{};
  Record pending{};
  bool active = false, awaiting = false, bound_once = false;
  uint32_t ordinal = 0;
  bool bind(void *i, void *t) {
    if (bound_once || !i || !t)
      return false;
    bound_once = true;
    io.store(i, std::memory_order_release);
    touch.store(t, std::memory_order_release);
    return true;
  }
  bool register_owner(void *task) {
    if (!task || owner.load(std::memory_order_acquire))
      return false;
    owner.store(task, std::memory_order_release);
    return true;
  }
  bool begin(void *t, void *task, uint32_t at) {
    if (!t || t != touch.load(std::memory_order_acquire))
      return false;
    if (!task || task != owner.load(std::memory_order_acquire)) {
      foreign.store(1, std::memory_order_relaxed);
      return false;
    }
    if (active) {
      foreign.store(1, std::memory_order_relaxed);
      return false;
    }
    ++ordinal;
    if (published.load(std::memory_order_relaxed) == capacity) {
      lost.store(lost.load(std::memory_order_relaxed) + 1,
                 std::memory_order_relaxed);
      return false;
    }
    pending = {};
    pending.ordinal = ordinal;
    pending.at = at;
    active = true;
    awaiting = false;
    return true;
  }
  bool owns(void *i, void *task) {
    if (!i || i != io.load(std::memory_order_acquire))
      return false;
    if (!task || task != owner.load(std::memory_order_acquire)) {
      foreign.store(1, std::memory_order_relaxed);
      return false;
    }
    return true;
  }
  void tx_done(void *i, void *task, int cmd, const void *p, size_t n,
               int error) {
    if (!owns(i, task) || !active)
      return;
    awaiting = false;
    if (cmd != 0xD0 || n != 1 || !p || *static_cast<const uint8_t *>(p) != 0) {
      pending.flags = (pending.flags & ~(Rx | Data)) | Mismatch;
      pending.rx = absent;
      std::memset(pending.data, 0, 10);
      return;
    }
    ++pending.tx_n;
    pending.tx = error;
    pending.rx = absent;
    pending.flags = (pending.flags & ~(Rx | Data)) | Tx;
    std::memset(pending.data, 0, 10);
    awaiting = error == 0;
  }
  void rx_done(void *i, void *task, int cmd, const void *p, size_t n,
               int error) {
    if (!owns(i, task) || !active)
      return;
    if (!awaiting || cmd != -1 || n != 10 || !p) {
      pending.flags = (pending.flags & ~Data) | Mismatch;
      std::memset(pending.data, 0, 10);
      awaiting = false;
      return;
    }
    awaiting = false;
    ++pending.rx_n;
    pending.rx = error;
    pending.flags |= Rx;
    pending.flags &= ~Data;
    std::memset(pending.data, 0, 10);
    if (error == 0) {
      std::memcpy(pending.data, p, 10);
      pending.flags |= Data;
    }
  }
  void end(bool entered, int error) {
    if (!entered)
      return;
    pending.result = error;
    const auto index = published.load(std::memory_order_relaxed);
    records[index] = pending;
    active = false;
    awaiting = false;
    published.store(index + 1, std::memory_order_release);
  }
  Snapshot snapshot() const {
    return {published.load(std::memory_order_acquire),
            lost.load(std::memory_order_relaxed),
            uint32_t(touch.load(std::memory_order_acquire) != nullptr),
            foreign.load(std::memory_order_relaxed)};
  }
  // Called only after original users are stopped, never concurrently with read.
  void retire() {
    touch.store(nullptr, std::memory_order_release);
    io.store(nullptr, std::memory_order_release);
  }
};
using Checksum = uint32_t (*)(const uint8_t *, size_t);
inline size_t format(const Record &r, Snapshot s, uint32_t seq, uint32_t drop,
                     char *out, size_t cap, Checksum crc) {
  if (!out || !cap || !crc)
    return 0;
  char hex[21];
  for (unsigned i = 0; i < 10; ++i)
    std::snprintf(hex + 2 * i, 3, "%02x", unsigned(r.data[i]));
  int n = std::snprintf(
      out, cap,
      "@400T1 seq=%lu drop=%lu count=%lu lost=%lu bound=%lu foreign=%lu "
      "ordinal=%lu at=%lu tx=%ld rx=%ld result=%ld tx_n=%lu rx_n=%lu flags=%lu "
      "data=%s",
      (unsigned long)seq, (unsigned long)drop, (unsigned long)s.count,
      (unsigned long)s.lost, (unsigned long)s.bound, (unsigned long)s.foreign,
      (unsigned long)r.ordinal, (unsigned long)r.at, (long)r.tx, (long)r.rx,
      (long)r.result, (unsigned long)r.tx_n, (unsigned long)r.rx_n,
      (unsigned long)r.flags, hex);
  if (n < 0 || size_t(n) >= cap) {
    out[0] = 0;
    return 0;
  }
  auto check = crc(reinterpret_cast<const uint8_t *>(out), size_t(n));
  int tail = std::snprintf(out + n, cap - size_t(n), " crc=%08lx\n",
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
    const auto s = state.snapshot();
    do {
      char line[packet_capacity];
      const Record empty{};
      const auto &r = cursor < s.count ? state.records[cursor] : empty;
      const auto n = format(r, s, ++seq, drop, line, sizeof(line), crc);
      if (!n || write(line, n) != int(n)) {
        ++drop;
        break;
      }
      if (cursor < s.count)
        ++cursor;
      else
        break;
    } while (cursor < s.count);
  }
};
} // namespace round_touch_raw

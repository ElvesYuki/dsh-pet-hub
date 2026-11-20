#pragma once

#include "playback_control.h"
#include "device_status.h"
#include <algorithm>
#include <array>
#include <bit>
#include <cstdint>
#include <optional>
#include <span>
#include <string_view>

namespace vp8_lan {
enum class Kind : uint8_t {
  device_hello = 1, hub_auth, device_finish, hub_finish, ready = 16, control, status, status_ack,
};
constexpr uint8_t push_capability = 0x04, push_mode = 3;
constexpr size_t header_size = 8, hello_size = 194, auth_prefix_size = 98;
constexpr size_t max_body = hello_size, tag_size = 32, envelope_size = 4 + tag_size;
constexpr uint64_t handshake_ms = 9000;
constexpr size_t status_context_size = 8;
constexpr size_t min_status_size = status_context_size + vp8_status::min_size;
constexpr size_t max_status_size = status_context_size + vp8_status::max_size;
using Bytes = std::span<const uint8_t>;

inline uint16_t u16(const uint8_t *p) { return uint16_t(p[0] | unsigned(p[1]) << 8); }
inline uint32_t u32(const uint8_t *p) { return u16(p) | uint32_t(u16(p + 2)) << 16; }
inline void put16(uint8_t *p, uint16_t value) { p[0] = uint8_t(value); p[1] = uint8_t(value >> 8); }
inline void put32(uint8_t *p, uint32_t value) {
  put16(p, uint16_t(value));
  put16(p + 2, uint16_t(value >> 16));
}
inline void put64(uint8_t *p, uint64_t value) {
  put32(p, uint32_t(value));
  put32(p + 4, uint32_t(value >> 32));
}

struct Packet {
  std::array<uint8_t, header_size + max_body> data{};
  size_t size{};
  Bytes bytes() const { return {data.data(), size}; }
  Bytes payload() const { return bytes().subspan(header_size); }
  std::span<uint8_t> begin(Kind kind, size_t length) {
    data[0] = 'V'; data[1] = 'P'; data[2] = 'L'; data[3] = '1';
    data[4] = 1; data[5] = uint8_t(kind);
    put16(data.data() + 6, uint16_t(length));
    size = header_size + length;
    return {data.data() + header_size, length};
  }
};

inline bool valid_length(Kind kind, size_t size) {
  switch (kind) {
    case Kind::device_hello: return size == hello_size;
    case Kind::hub_auth: return size == auth_prefix_size + 64;
    case Kind::device_finish: return size == 100;
    case Kind::hub_finish: return size == tag_size;
    case Kind::ready: return size == envelope_size + 4;
    case Kind::control: return size == envelope_size + vp8_control::frame_size;
    case Kind::status: return size >= envelope_size + min_status_size && size <= envelope_size + max_status_size;
    case Kind::status_ack: return size == envelope_size + status_context_size;
  }
  return false;
}

class Framer {
 public:
  template<class Emit>
  bool push(Bytes input, Emit emit) {
    while (!input.empty()) {
      const auto want = end_ - used_;
      const auto count = std::min(want, input.size());
      std::copy_n(input.begin(), count, frame_.begin() + used_);
      used_ += count;
      input = input.subspan(count);
      if (used_ < end_) continue;
      if (end_ == header_size) {
        if (std::string_view(reinterpret_cast<const char *>(frame_.data()), 4) != "VPL1" || frame_[4] != 1)
          return false;
        const auto length = u16(frame_.data() + 6);
        if (!valid_length(Kind(frame_[5]), length)) return false;
        end_ += length;
      } else {
        if (!emit(Kind(frame_[5]), Bytes(frame_.data(), used_))) return false;
        reset();
      }
    }
    return true;
  }

  void reset() { used_ = 0; end_ = header_size; }
  bool partial() const { return used_ != 0; }

 private:
  std::array<uint8_t, header_size + max_body> frame_{};
  size_t used_{}, end_{header_size};
};

size_t encode_status(const vp8_status::Status &status, uint32_t session, uint32_t sequence,
                     std::span<uint8_t, max_status_size> out);
struct Receipt {
  vp8_status::Status status;
  uint32_t session{}, sequence{};
};
std::optional<Receipt> decode_status(Bytes payload);
} // namespace vp8_lan

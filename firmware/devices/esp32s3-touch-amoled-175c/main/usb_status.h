#pragma once

#include "device_status.h"
#include "usb_base64.h"
#include <algorithm>
#include <charconv>

namespace vp8_status {
constexpr std::string_view usb_request = "STATUS3 ";
constexpr std::string_view usb_reply = "@VP8_STATUS3 id=";
constexpr std::string_view usb_data = " data=";
constexpr size_t max_base64 = 4 * ((max_size + 2) / 3);

inline bool valid_usb_id(std::string_view id) {
  return id.size() == 8 && std::all_of(id.begin(), id.end(), [](char ch) {
    return (ch >= '0' && ch <= '9') || (ch >= 'a' && ch <= 'f');
  });
}

template<class Snapshot, class Emit>
bool handle_usb(std::string_view line, Snapshot snapshot, Emit emit) {
  if (!line.starts_with(usb_request)) return false;
  const auto id = line.substr(usb_request.size());
  if (!valid_usb_id(id)) return true;

  std::array<uint8_t, max_size> payload;
  const auto size = encode(snapshot(), payload);
  if (!size) return true;

  constexpr size_t prefix_size = usb_reply.size() + 8 + usb_data.size();
  std::array<char, prefix_size + max_base64> reply;
  auto tail = std::copy(usb_reply.begin(), usb_reply.end(), reply.begin());
  tail = std::copy(id.begin(), id.end(), tail);
  std::copy(usb_data.begin(), usb_data.end(), tail);
  const auto encoded = vp8_usb_base64::encode(Bytes(payload).first(size), std::span(reply).subspan(prefix_size));
  emit(std::string_view(reply.data(), prefix_size + encoded));
  return true;
}

class UsbSubscription {
 public:
  bool receive(std::string_view line, uint64_t now) {
    constexpr std::string_view start = "STATUS3_SUB ", stop = "STATUS3_UNSUB ";
    const bool subscribe = line.starts_with(start);
    if (!subscribe && !line.starts_with(stop)) return false;
    const auto id = line.substr(subscribe ? start.size() : stop.size());
    if (!valid_usb_id(id)) return true;
    const bool same = now < expires_at_ && id == std::string_view(id_.data(), id_.size());
    if (!subscribe) {
      if (same) expires_at_ = 0;
      return true;
    }
    if (!same) {
      std::copy(id.begin(), id.end(), id_.begin());
      sequence_ = 0;
      next_at_ = now;
    }
    expires_at_ = now + 15000;
    return true;
  }

  template<class Snapshot, class Emit>
  void tick(uint64_t now, Snapshot snapshot, Emit emit) {
    if (now >= expires_at_ || now < next_at_) return;
    next_at_ = now + 3000;
    if (sequence_ == UINT32_MAX) { expires_at_ = 0; return; }
    std::array<uint8_t, max_size> payload;
    const auto size = encode(snapshot(), payload);
    if (!size) return;
    constexpr std::string_view prefix = "@VP8_STATUS3_PUSH id=", seq = " seq=";
    std::array<char, prefix.size() + 8 + seq.size() + 10 + usb_data.size() + max_base64> reply;
    auto *tail = std::copy(prefix.begin(), prefix.end(), reply.data());
    tail = std::copy(id_.begin(), id_.end(), tail);
    tail = std::copy(seq.begin(), seq.end(), tail);
    tail = std::to_chars(tail, tail + 10, ++sequence_).ptr;
    tail = std::copy(usb_data.begin(), usb_data.end(), tail);
    const auto encoded = vp8_usb_base64::encode(Bytes(payload).first(size),
        std::span(tail, size_t(reply.data() + reply.size() - tail)));
    if (encoded) emit(std::string_view(reply.data(), size_t(tail - reply.data()) + encoded));
  }

 private:
  std::array<char, 8> id_{};
  uint64_t expires_at_{}, next_at_{};
  uint32_t sequence_{};
};
} // namespace vp8_status

#pragma once
#include <cstdint>
#include <span>
#include <string_view>

namespace vp8_usb_base64 {
constexpr std::string_view alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

inline size_t encode(std::span<const uint8_t> packet, std::span<char> text) {
  const size_t length = 4 * ((packet.size() + 2) / 3);
  if (packet.empty() || text.size() < length) return 0;
  size_t out = 0;
  for (size_t i = 0; i < packet.size(); i += 3) {
    const bool second = i + 1 < packet.size(), third = i + 2 < packet.size();
    const unsigned a = packet[i], b = second ? packet[i + 1] : 0, c = third ? packet[i + 2] : 0;
    text[out++] = alphabet[a >> 2];
    text[out++] = alphabet[(a & 3) << 4 | b >> 4];
    text[out++] = second ? alphabet[(b & 15) << 2 | c >> 6] : '=';
    text[out++] = third ? alphabet[c & 63] : '=';
  }
  return out;
}

} // namespace vp8_usb_base64

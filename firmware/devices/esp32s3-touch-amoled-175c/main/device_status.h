#pragma once

#include <array>
#include <cstddef>
#include <cstdint>
#include <optional>
#include <span>
#include <string_view>

namespace vp8_status {
constexpr uint8_t version = 2;
constexpr size_t min_size = 6, max_size = 68;
using Bytes = std::span<const uint8_t>;

struct Battery {
  bool present{}, usb{};
  uint8_t percent{255}, flow{255}, phase{255};
  uint16_t mv{};
  bool operator==(const Battery &) const = default;
};
struct Touch {
  uint8_t state{};
  uint16_t x{65535}, y{65535};
  bool operator==(const Touch &) const = default;
};
struct Imu {
  std::array<int16_t, 3> mg{};
  std::array<int32_t, 3> mdps{};
  bool operator==(const Imu &) const = default;
};
struct Status {
  std::string_view version;
  uint8_t slot{};
  bool busy{}, selected{};
  std::optional<Battery> battery;
  std::optional<Touch> touch;
  std::optional<Imu> imu;
  bool operator==(const Status &) const = default;
};

struct Contact {
  int64_t valid_at_us = -1;
  bool pressed{};
  int x = -1, y = -1;

  void observe(bool valid, bool down, unsigned px, unsigned py, int64_t now) {
    if (!valid) return;
    valid_at_us = now;
    pressed = down;
    if (down && px < 466 && py < 466) {
      x = int(px);
      y = int(py);
    }
  }
};

size_t encode(const Status &status, std::span<uint8_t, max_size> out);
std::optional<Status> decode(Bytes payload);
} // namespace vp8_status

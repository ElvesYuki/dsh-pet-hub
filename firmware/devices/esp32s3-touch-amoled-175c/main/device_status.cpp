#include "device_status.h"
#include "pet_asset.h"
#include <algorithm>
#include <bit>

namespace vp8_status {
namespace {
uint16_t u16(const uint8_t *p) { return uint16_t(p[0] | unsigned(p[1]) << 8); }
void put16(uint8_t *p, uint16_t value) { p[0] = uint8_t(value); p[1] = uint8_t(value >> 8); }

bool alpha_num(char ch) {
  return (ch >= '0' && ch <= '9') || (ch >= 'A' && ch <= 'Z') || (ch >= 'a' && ch <= 'z');
}
bool valid(const Status &s) {
  if (s.slot > 1 || s.version.empty() || s.version.size() > 31 || !alpha_num(s.version.front()) ||
      !std::all_of(s.version.begin(), s.version.end(), [](char ch) {
        return alpha_num(ch) || std::string_view("._+-").find(ch) != std::string_view::npos;
      })) return false;
  if (s.battery) {
    const auto &b = *s.battery;
    if (b.present) {
      if ((b.percent > 100 && b.percent != 255) || b.flow > 3 || b.phase > 6 || b.mv > 8191) return false;
    } else if (b.percent != 255 || b.flow != 255 || b.phase != 255 || b.mv) return false;
  }
  if (s.touch) {
    const auto &t = *s.touch;
    if (t.state > 2 || !((t.x <= 465 && t.y <= 465) || (t.x == 65535 && t.y == 65535))) return false;
  }
  if (s.imu) {
    for (auto value : s.imu->mg) if (value < -4000 || value > 4000) return false;
    for (auto value : s.imu->mdps) if (value < -256000 || value > 256000) return false;
  }
  return true;
}
} // namespace

size_t encode(const Status &s, std::span<uint8_t, max_size> out) {
  if (!valid(s)) return 0;
  auto *p = out.data();
  p[0] = version;
  p[1] = s.slot;
  p[2] = (s.battery ? 1 : 0) | (s.touch ? 2 : 0) | (s.imu ? 4 : 0);
  p[3] = uint8_t(s.version.size());
  p[4] = uint8_t(s.busy) | uint8_t(s.selected) << 1;
  std::copy(s.version.begin(), s.version.end(), p + 5);
  p += 5 + s.version.size();
  if (s.battery) {
    const auto &b = *s.battery;
    p[0] = b.present; p[1] = b.usb; p[2] = b.percent; p[3] = b.flow; p[4] = b.phase; p[5] = 0;
    put16(p + 6, b.mv);
    p += 8;
  }
  if (s.touch) {
    p[0] = s.touch->state; p[1] = 0;
    put16(p + 2, s.touch->x);
    put16(p + 4, s.touch->y);
    p += 6;
  }
  if (s.imu) {
    for (auto v : s.imu->mg) { put16(p, uint16_t(v)); p += 2; }
    for (auto v : s.imu->mdps) { pet::put32(p, uint32_t(v)); p += 4; }
  }
  return size_t(p - out.data());
}

std::optional<Status> decode(Bytes data) {
  if (data.size() < min_size || data.size() > max_size || data[0] != version ||
      (data[2] & ~7) || (data[4] & ~3)) return {};
  const auto *p = data.data();
  const auto flags = data[2], length = data[3];
  if (data.size() != size_t(5 + length + (flags & 1 ? 8 : 0) + (flags & 2 ? 6 : 0) + (flags & 4 ? 18 : 0)))
    return {};
  Status s{{reinterpret_cast<const char *>(p + 5), length}, data[1], bool(p[4] & 1), bool(p[4] & 2), {}, {}, {}};
  p += 5 + length;
  if (flags & 1) {
    if (p[0] > 1 || p[1] > 1 || p[5]) return {};
    s.battery = Battery{bool(p[0]), bool(p[1]), p[2], p[3], p[4], u16(p + 6)};
    p += 8;
  }
  if (flags & 2) {
    if (p[1]) return {};
    s.touch = Touch{p[0], u16(p + 2), u16(p + 4)};
    p += 6;
  }
  if (flags & 4) {
    auto &imu = s.imu.emplace();
    for (auto &v : imu.mg) { v = std::bit_cast<int16_t>(u16(p)); p += 2; }
    for (auto &v : imu.mdps) { v = std::bit_cast<int32_t>(pet::u32(p)); p += 4; }
  }
  if (!valid(s)) return {};
  return s;
}
} // namespace vp8_status

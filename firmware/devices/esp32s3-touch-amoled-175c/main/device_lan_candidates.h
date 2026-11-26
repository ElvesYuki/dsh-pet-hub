#pragma once

#include <array>
#include <bit>
#include <cstdint>
#include <optional>
#include <string_view>

namespace vp8_lan {
using Ipv4 = std::array<uint8_t, 4>;
struct Target {
  Ipv4 ip{};
  uint16_t port{};
  bool operator==(const Target &) const = default;
};
inline Ipv4 ipv4_bytes(uint32_t network_order) { return std::bit_cast<Ipv4>(network_order); }

struct Subnet {
  Ipv4 local{}, mask{};
  bool operator==(const Subnet &) const = default;

  bool admits(const Target &target) const {
    const auto number = [](Ipv4 ip) { return uint32_t(ip[0]) << 24 | uint32_t(ip[1]) << 16 | uint32_t(ip[2]) << 8 | ip[3]; };
    const auto station = number(local), address = number(target.ip), subnet_mask = number(mask);
    const auto bits = std::countl_one(subnet_mask);
    const auto hosts = ~subnet_mask;
    const auto first = target.ip[0], second = target.ip[1];
    const bool private_address = first == 10 || (first == 172 && second >= 16 && second <= 31) ||
        (first == 192 && second == 168);
    return target.port && station && bits >= 8 && bits <= 30 && (hosts & (hosts + 1)) == 0 && private_address &&
        station != address && (station & subnet_mask) == (address & subnet_mask) && (address & hosts) != 0 &&
        (address & hosts) != hosts;
  }
};

// The caller remembers only authenticated discovery endpoints. Taking an
// address consumes the single retry, even if it is no longer on this link.
class DiscoveryReconnect {
 public:
  void remember(Target target) { target_ = target; }
  void clear() { target_.reset(); }
  std::optional<Target> take(const Subnet &subnet) {
    const auto target = target_;
    clear();
    return target && subnet.admits(*target) ? target : std::nullopt;
  }

 private:
  std::optional<Target> target_;
};

class Candidates {
 public:
  static constexpr unsigned capacity = 8;
  bool add(const Subnet &subnet, Target target) {
    if (size_ == targets_.size() || !subnet.admits(target)) return false;
    for (unsigned i = 0; i < size_; ++i) if (targets_[i] == target) return false;
    targets_[size_++] = target;
    return true;
  }
  bool pending() const { return next_ < size_; }
  std::optional<Target> next() { return pending() ? std::optional{targets_[next_++]} : std::nullopt; }

 private:
  std::array<Target, capacity> targets_{};
  unsigned size_{}, next_{};
};
} // namespace vp8_lan

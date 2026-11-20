#pragma once

#include "desktop_internet.h"
#include "station_bootstrap.h"

#include <array>

namespace vp8_daily {
struct DesktopNetworks {
  using Credentials = pet400_transport::Credentials;
  static constexpr size_t capacity = 4;
  uint32_t count{};
  InternetSettings internet{};
  std::array<Credentials, capacity> profiles{};

  size_t find(std::string_view ssid) const {
    for (size_t i = 0; i < count; ++i)
      if (ssid == profiles[i].ssid) return i;
    return count;
  }

  bool valid() const {
    if (count > capacity || ((count || internet.time_host[0]) && !internet_settings_valid(internet))) return false;
    for (size_t i = 0; i < count; ++i)
      if (!pet400_transport::valid(profiles[i]) || find(profiles[i].ssid) != i) return false;
    return true;
  }

  bool upsert(const Credentials &profile, const InternetSettings &settings) {
    auto index = find(profile.ssid);
    if (index == capacity) return false;
    if (index == count) ++count;
    profiles[index] = profile;
    internet = settings;
    return true;
  }

  bool remove(std::string_view ssid) {
    const auto index = find(ssid);
    if (index == count) return false;
    for (size_t i = index + 1; i < count; ++i) profiles[i - 1] = profiles[i];
    profiles[--count] = {};
    return true;
  }
};

class WifiRetryRound {
 public:
  static constexpr int64_t attempt_us = 10'000'000, round_us = 60'000'000;

  void reset(int64_t now) {
    *this = {};
    next_at_ = now;
  }
  size_t index() const { return index_; }
  bool due(int64_t now) const { return now >= next_at_; }
  bool expired(int64_t now) const { return now >= deadline_; }
  bool online() const { return online_; }
  void connected() { online_ = true; }
  void started(int64_t now) {
    if (index_ == 0) round_at_ = now;
    deadline_ = now + attempt_us;
  }
  void failed(int64_t now, size_t count) {
    ++index_;
    if (index_ < count) next_at_ = now;
    else {
      index_ = 0;
      next_at_ = std::max(now, round_at_ + round_us);
    }
  }

 private:
  size_t index_{};
  int64_t next_at_{}, round_at_{}, deadline_{};
  bool online_{};
};
} // namespace vp8_daily

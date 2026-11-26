#pragma once

#include <algorithm>
#include <charconv>
#include <cstdint>
#include <string_view>

namespace vp8_daily {
enum class Weather : uint8_t { keep, none, clear, cloud, rain, snow };
enum class WifiLink : uint8_t { off, connecting, online, unavailable };

struct DesktopStatus {
  int minute = -1;
  int battery = -1;
  Weather weather = Weather::none;
  int celsius{};
  WifiLink wifi = WifiLink::off;
  bool usb_power{};
  bool operator==(const DesktopStatus &) const = default;
};

class DesktopStatusCache {
 public:
  static constexpr int64_t weather_lifetime = 6LL * 60 * 60 * 1000000;
  static constexpr int64_t battery_lifetime = 30LL * 1000000;
  void sync(int64_t now, int local_second, Weather weather, int celsius) {
    clock_at_ = now;
    local_second_ = local_second;
    if (weather != Weather::keep) {
      weather_at_ = now;
      weather_ = weather;
      celsius_ = celsius;
    }
  }
  void battery(int64_t now, int percent, bool usb_power) {
    battery_at_ = now;
    battery_ = percent;
    usb_power_ = usb_power;
  }
  void wifi(WifiLink link) { wifi_ = link; }
  void clear_network() {
    local_second_ = -1;
    clear_weather();
  }
  void clear_weather() {
    weather_ = Weather::none;
    celsius_ = 0;
  }
  DesktopStatus snapshot(int64_t now) const {
    DesktopStatus data;
    data.wifi = wifi_;
    if (local_second_ >= 0)
      data.minute = int((local_second_ + (now - clock_at_) / 1000000) % 86400 / 60);
    if (now - battery_at_ < battery_lifetime) {
      data.battery = battery_;
      data.usb_power = usb_power_;
    }
    if (now - weather_at_ < weather_lifetime) {
      data.weather = weather_;
      data.celsius = celsius_;
    }
    return data;
  }

 private:
  int64_t clock_at_{}, weather_at_{}, battery_at_{};
  int local_second_ = -1, battery_ = -1, celsius_{};
  bool usb_power_{};
  Weather weather_ = Weather::none;
  WifiLink wifi_ = WifiLink::off;
};

struct DesktopSync {
  std::string_view id;
  int local_second{}, celsius{};
  Weather weather = Weather::keep;

  bool parse(std::string_view fields) {
    const auto token = [&] {
      const auto end = fields.find(' ');
      const auto part = fields.substr(0, end);
      fields.remove_prefix(end == fields.npos ? fields.size() : end + 1);
      return part;
    };
    const auto number = [](std::string_view field, int &value) {
      if (field.empty()) return false;
      const auto [end, error] = std::from_chars(field.data(), field.data() + field.size(), value);
      return error == std::errc{} && end == field.data() + field.size();
    };
    id = token();
    if (id.size() != 8 || !std::all_of(id.begin(), id.end(), [](char c) {
          return (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f');
        })) {
      id = {};
      return false;
    }
    if (!number(token(), local_second) || local_second < 0 || local_second >= 86400) return false;
    const auto sky = token();
    if (sky == "keep") weather = Weather::keep;
    else if (sky == "none") weather = Weather::none;
    else if (sky == "clear") weather = Weather::clear;
    else if (sky == "cloud") weather = Weather::cloud;
    else if (sky == "rain") weather = Weather::rain;
    else if (sky == "snow") weather = Weather::snow;
    else return false;
    if (weather <= Weather::none) return fields.empty();
    return number(token(), celsius) && fields.empty() && celsius >= -90 && celsius <= 60;
  }
};
} // namespace vp8_daily

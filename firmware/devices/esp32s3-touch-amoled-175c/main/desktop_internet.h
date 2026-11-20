#pragma once
#include "desktop_status.h"

#include <cstring>
#include <optional>

namespace vp8_daily {
inline constexpr size_t internet_response_limit = 2048;

struct DesktopNetworkCommand {
  enum class Operation { invalid, info, set, clear, list, remove };
  std::string_view id;
  std::string_view settings;
  Operation operation = Operation::invalid;
};

inline DesktopNetworkCommand desktop_network_command(std::string_view fields, bool profiles = false) {
  if (fields.size() < 9 || fields[8] != ' ' ||
      !std::all_of(fields.begin(), fields.begin() + 8, [](char ch) {
        return (ch >= '0' && ch <= '9') || (ch >= 'a' && ch <= 'f');
      })) return {};
  const auto id = fields.substr(0, 8);
  const auto action = fields.substr(9);
  using Operation = DesktopNetworkCommand::Operation;
  if (profiles) {
    if (action == "LIST") return {id, {}, Operation::list};
    if (action.starts_with("REMOVE ") && action.size() > 7) return {id, action.substr(7), Operation::remove};
  } else {
    if (action == "INFO") return {id, {}, Operation::info};
    if (action == "CLEAR") return {id, {}, Operation::clear};
  }
  if (action.starts_with("SET ") && action.size() > 4) return {id, action.substr(4), Operation::set};
  return {id, {}, Operation::invalid};
}
struct InternetSettings {
  char time_host[64]{}, weather_host[64]{};
  int32_t latitude_e4{}, longitude_e4{};
  int16_t utc_minutes{};
};

struct WeatherLocation {
  int32_t latitude_e4{}, longitude_e4{};
  bool valid() const {
    return latitude_e4 >= -900000 && latitude_e4 <= 900000 &&
           longitude_e4 >= -1800000 && longitude_e4 <= 1800000;
  }
  bool operator==(const WeatherLocation &) const = default;
};

inline std::optional<WeatherLocation> parse_weather_location(std::string_view fields) {
  const auto space = fields.find(' ');
  if (space == fields.npos || space == 0 || space + 1 == fields.size()) return std::nullopt;
  const auto integer = [](std::string_view part, int32_t &value) {
    const auto end = part.data() + part.size();
    const auto result = std::from_chars(part.data(), end, value);
    return result.ec == std::errc{} && result.ptr == end;
  };
  WeatherLocation location;
  if (!integer(fields.substr(0, space), location.latitude_e4) ||
      !integer(fields.substr(space + 1), location.longitude_e4) || !location.valid()) return std::nullopt;
  return location;
}

struct WeatherSelection {
  enum class Mode { legacy, disabled, selected, corrupt };
  Mode mode = Mode::legacy;
  WeatherLocation location{};
  bool operator==(const WeatherSelection &) const = default;
};

inline std::optional<WeatherSelection> decode_saved_weather(std::string_view fields) {
  if (fields == "-") return WeatherSelection{WeatherSelection::Mode::disabled};
  if (auto location = parse_weather_location(fields))
    return WeatherSelection{WeatherSelection::Mode::selected, *location};
  return std::nullopt;
}

struct WeatherTarget {
  const char *host;
  WeatherLocation location;
};

inline std::optional<WeatherTarget> weather_target(const InternetSettings &settings, WeatherSelection selection) {
  using Mode = WeatherSelection::Mode;
  if (selection.mode == Mode::selected) return WeatherTarget{"api.open-meteo.com", selection.location};
  if (selection.mode == Mode::legacy && settings.weather_host[0])
    return WeatherTarget{settings.weather_host, {settings.latitude_e4, settings.longitude_e4}};
  return std::nullopt;
}

inline bool internet_host(std::string_view host) {
  if (host.empty() || host.size() > 63) return false;
  size_t length = 0;
  char prev = '.';
  for (const char ch : host) {
    const bool alnum = (ch >= 'A' && ch <= 'Z') || (ch >= 'a' && ch <= 'z') || (ch >= '0' && ch <= '9');
    if (ch == '.') {
      if (!length || prev == '-') return false;
      length = 0;
    } else {
      if ((!alnum && ch != '-') || (!length && ch == '-')) return false;
      ++length;
    }
    prev = ch;
  }
  return length && prev != '-';
}

inline bool internet_settings_valid(const InternetSettings &settings) {
  if (!std::memchr(settings.time_host, 0, sizeof(settings.time_host)) ||
      !std::memchr(settings.weather_host, 0, sizeof(settings.weather_host))) return false;
  return internet_host(settings.time_host) &&
    (!settings.weather_host[0] || internet_host(settings.weather_host)) &&
    WeatherLocation{settings.latitude_e4, settings.longitude_e4}.valid() &&
    settings.utc_minutes >= -720 && settings.utc_minutes <= 840;
}

inline bool sane_epoch(int64_t epoch) { return epoch >= 1704067200 && epoch < 4102444800LL; }
inline int local_second(int64_t epoch, int16_t utc_minutes) {
  return int((epoch % 86400 + int64_t(utc_minutes) * 60 + 86400) % 86400);
}

constexpr int clock_hour = 3600;
constexpr int clock_sync_minute = 50;

inline int clock_sync_hourly_delay(int second_of_day) {
  const int until = clock_sync_minute * 60 - second_of_day % clock_hour;
  return until > 0 ? until : clock_hour + until;
}

struct InternetForecast { Weather weather; int celsius; };
std::optional<InternetForecast> parse_internet_forecast(std::string_view body, int64_t received);
#if defined(ESP_PLATFORM)
using PublishInternet = void (*)(int64_t monotonic, int local_second, Weather, int celsius);
bool internet_restore_clock(const InternetSettings &settings, PublishInternet publish);
void internet_poll(const InternetSettings &settings, WeatherSelection weather, int64_t monotonic, PublishInternet publish);
bool internet_pause(bool reconfigured);
void internet_refresh_weather();
#endif
} // namespace vp8_daily

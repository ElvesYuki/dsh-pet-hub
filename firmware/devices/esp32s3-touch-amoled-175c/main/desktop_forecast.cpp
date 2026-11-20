#include "desktop_internet.h"
#include "cJSON.h"

#include <cmath>
#include <memory>

namespace vp8_daily {
namespace {
Weather condition(int code) {
  switch (code) {
    case 0: case 1: return Weather::clear;
    case 2: case 3: case 45: case 48: return Weather::cloud;
    case 71: case 73: case 75: case 77: case 85: case 86: return Weather::snow;
    case 51: case 53: case 55: case 56: case 57: case 61: case 63: case 65: case 66: case 67:
    case 80: case 81: case 82: case 95: case 96: case 97: case 99: return Weather::rain;
    default: return Weather::none;
  }
}

bool shallow_json(std::string_view body) {
  if (body.empty() || body.size() > internet_response_limit) return false;
  int depth = 0;
  bool quoted = false, escaped = false;
  for (const char ch : body) {
    if (quoted) {
      if (escaped) escaped = false;
      else if (ch == '\\') escaped = true;
      else if (ch == '"') quoted = false;
      continue;
    }
    if (ch == '"') quoted = true;
    else if (ch == '{' || ch == '[') { if (++depth > 12) return false; }
    else if (ch == '}' || ch == ']') { if (--depth < 0) return false; }
  }
  return !quoted && depth == 0;
}
} // namespace

std::optional<InternetForecast> parse_internet_forecast(std::string_view body, int64_t received) {
  if (!shallow_json(body)) return std::nullopt;
  const char *end = nullptr;
  const std::unique_ptr<cJSON, decltype(&cJSON_Delete)> root(
      cJSON_ParseWithLengthOpts(body.data(), body.size(), &end, false), cJSON_Delete);
  if (!root || !cJSON_IsObject(root.get()) || !end ||
      !std::all_of(end, body.data() + body.size(), [](char ch) {
        return ch == ' ' || ch == '\t' || ch == '\r' || ch == '\n';
      })) return std::nullopt;
  const auto *units = cJSON_GetObjectItemCaseSensitive(root.get(), "current_units");
  const auto *unit = cJSON_GetStringValue(cJSON_GetObjectItemCaseSensitive(units, "temperature_2m"));
  if (!unit || std::string_view(unit) != "°C") return std::nullopt;
  const auto *current = cJSON_GetObjectItemCaseSensitive(root.get(), "current");
  const double time = cJSON_GetNumberValue(cJSON_GetObjectItemCaseSensitive(current, "time"));
  const double temp = cJSON_GetNumberValue(cJSON_GetObjectItemCaseSensitive(current, "temperature_2m"));
  const double code = cJSON_GetNumberValue(cJSON_GetObjectItemCaseSensitive(current, "weather_code"));
  if (!std::isfinite(time) || std::trunc(time) != time || time < received - 7200 || time > received + 900 ||
      !std::isfinite(temp) || temp < -90 || temp > 60 || !(code >= 0 && code <= 99) || std::trunc(code) != code)
    return std::nullopt;
  const auto weather = condition(int(code));
  if (weather == Weather::none) return std::nullopt;
  return InternetForecast{weather, int(std::lround(temp))};
}
} // namespace vp8_daily

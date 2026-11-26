#include "desktop_weather_work.h"
#include "desktop_network_profiles.h"

#include <cassert>
#include <string>

int main() {
  using namespace vp8_daily;
  using Operation = DesktopNetworkCommand::Operation;
  assert(desktop_network_command("abcd1234 INFO").operation == Operation::info);
  assert(desktop_network_command("abcd1234 INFO").id == "abcd1234");
  assert(desktop_network_command("abcd1234 CLEAR").operation == Operation::clear);
  assert(desktop_network_command("abcd1234 LIST", true).operation == Operation::list);
  assert(desktop_network_command("abcd1234 REMOVE 57694669", true).operation == Operation::remove);
  assert(desktop_network_command("abcd1234 REMOVE 57694669", true).settings == "57694669");
  assert(desktop_network_command("abcd1234 REMOVE 57694669").operation == Operation::invalid);
  assert(desktop_network_command("abcd1234 CLEAR", true).operation == Operation::invalid);
  const auto set = desktop_network_command("012345ab SET 74657374 - ntp.example - 480 0 0");
  assert(set.operation == Operation::set && set.settings == "74657374 - ntp.example - 480 0 0");
  assert(desktop_network_command("ABCD1234 INFO").id.empty());
  assert(desktop_network_command("bad INFO").id.empty());
  for (const auto malformed : {"abcd1234 INFO ", "abcd1234 CLEAR x", "abcd1234 SET ", "abcd1234 "}) {
    const auto request = desktop_network_command(malformed);
    assert(request.id == "abcd1234" && request.operation == Operation::invalid);
  }
  assert(internet_host("time.example.org") && internet_host("weather-api.example.org"));
  assert(!internet_host("https://time.example.org") && !internet_host("time.example.org:80"));
  assert(!internet_host("..") && !internet_host("host-.example.org") && !internet_host("host.example."));
  using Mode = WeatherSelection::Mode;
  const auto command = desktop_network_command("120000ab SET -900000 1800000");
  const WeatherLocation pole{-900000, 1800000};
  assert(command.operation == Operation::set && parse_weather_location(command.settings) == pole);
  for (const auto invalid : {"", "-", "1", " 1", "1 ", "0 1 ", "0  1", "0 +1",
                            "-900001 0", "0 1800001", "2147483648 0", "0 0 0", "10.0 20"}) {
    assert(!parse_weather_location(invalid));
  }
  assert(decode_saved_weather("-") == (WeatherSelection{Mode::disabled}));
  assert(decode_saved_weather("-900000 1800000") == (WeatherSelection{Mode::selected, pole}));
  assert(!decode_saved_weather("not a location") && !decode_saved_weather("0 0x01"));

  InternetSettings settings{"time.example.org", "weather.example.org", -900000, 1800000, 480};
  assert(internet_settings_valid(settings));
  auto legacy = weather_target(settings, {});
  assert(legacy && legacy->location == pole && std::string_view(legacy->host) == "weather.example.org");
  assert(!weather_target(settings, {Mode::disabled}));
  assert(!weather_target(settings, {Mode::corrupt}));
  const auto selected = weather_target(settings, {Mode::selected, {0, 0}});
  assert(selected && selected->location == WeatherLocation{} &&
         std::string_view(selected->host) == "api.open-meteo.com");
  assert(weather_target({}, {Mode::selected, pole})->location == pole);
  assert(!weather_target({}, {}));
  assert(std::string_view(settings.time_host) == "time.example.org" && settings.utc_minutes == 480);

  DesktopNetworks profiles;
  const std::array<DesktopNetworks::Credentials, 5> networks{
    { {"one", ""}, {"two", "12345678"}, {"three", ""}, {"four", ""}, {"five", ""} }
  };
  assert(profiles.valid() && profiles.count == 0);
  for (size_t i = 0; i < 4; ++i) assert(profiles.upsert(networks[i], settings));
  assert(profiles.valid() && profiles.count == 4 && !profiles.upsert(networks[4], settings));
  assert(profiles.upsert({"two", "new-password"}, settings) && profiles.find("two") == 1);
  assert(std::string_view(profiles.profiles[1].password) == "new-password");
  assert(profiles.remove("one") && profiles.count == 3 && profiles.find("two") == 0);
  assert(profiles.profiles[3].ssid[0] == '\0' && !profiles.remove("missing"));
  assert(profiles.upsert(networks[4], settings) && profiles.find("five") == 3);
  profiles.profiles[1] = profiles.profiles[0];
  assert(!profiles.valid());
  profiles.profiles[0].ssid[0] = '\0';
  assert(!profiles.valid());
  profiles.count = 5;
  assert(!profiles.valid());

  WifiRetryRound retry;
  constexpr int64_t seconds = 1'000'000;
  retry.reset(15 * seconds);
  assert(!retry.due(14 * seconds) && retry.due(15 * seconds));
  for (int i = 0; i < 4; ++i) {
    const int64_t now = (15 + 10 * i) * seconds;
    assert(retry.index() == size_t(i) && retry.due(now));
    retry.started(now);
    assert(!retry.expired(now + 10 * seconds - 1));
    retry.failed(now + 10 * seconds, 4);
  }
  assert(retry.index() == 0 && !retry.due(74 * seconds) && retry.due(75 * seconds));
  retry.started(75 * seconds);
  retry.failed(76 * seconds, 4);
  assert(retry.index() == 1 && retry.due(76 * seconds));
  retry.started(76 * seconds);
  retry.connected();
  assert(retry.online() && retry.index() == 1);
  retry.reset(80 * seconds);
  assert(!retry.online() && retry.index() == 0 && retry.due(80 * seconds));

  DesktopStatusCache cache;
  cache.sync(1000, 600, Weather::cloud, 21);
  cache.battery(1000, 78, false);
  cache.clear_weather();
  const auto status = cache.snapshot(1200);
  assert(status.minute == 10 && status.battery == 78 && status.weather == Weather::none && status.celsius == 0);

  settings.latitude_e4 = -900001;
  assert(!internet_settings_valid(settings));
  settings.latitude_e4 = 0;
  settings.utc_minutes = 841;
  assert(!internet_settings_valid(settings));
  constexpr int64_t utc_midnight = 1704067200;
  assert(sane_epoch(utc_midnight) && !sane_epoch(0));
  assert(local_second(utc_midnight, 480) == 28800);
  assert(local_second(utc_midnight + 16 * 3600, 480) == 0);
  assert(local_second(utc_midnight, -60) == 23 * 3600);
  assert(clock_sync_hourly_delay(0) == 3000);
  assert(clock_sync_hourly_delay(2999) == 1);
  assert(clock_sync_hourly_delay(3000) == 3600);
  assert(clock_sync_hourly_delay(3001) == 3599);
  assert(clock_sync_hourly_delay(86399) == 3001);
  const auto local = local_second(utc_midnight + 3 * 3600, 345);
  assert((local + clock_sync_hourly_delay(local)) % 3600 == 3000);

  constexpr auto body = R"({"current_units":{"temperature_2m":"°C"},"current":{"time":1704067200,"temperature_2m":-4.5,"weather_code":73}})";
  const auto parsed = parse_internet_forecast(body, utc_midnight + 600);
  assert(parsed && parsed->weather == Weather::snow && parsed->celsius == -5);
  assert(!parse_internet_forecast(body, utc_midnight + 7201));
  assert(!parse_internet_forecast(body, utc_midnight - 901));
  assert(!parse_internet_forecast(std::string(body) + " junk", utc_midnight));
  assert(!parse_internet_forecast(std::string_view(body).substr(0, 20), utc_midnight));
  assert(!parse_internet_forecast(std::string(100, '[') + "0" + std::string(100, ']'), utc_midnight));
  assert(!parse_internet_forecast(
      R"({"current_units":{"temperature_2m":"°C"},"current":{"time":1704067200,"temperature_2m":null,"weather_code":0}})", utc_midnight));
  assert(!parse_internet_forecast(
      R"({"current_units":{"temperature_2m":"°F"},"current":{"time":1704067200,"temperature_2m":10,"weather_code":0}})", utc_midnight));
  assert(!parse_internet_forecast(
      R"({"current_units":{"temperature_2m":"°C"},"current":{"time":1704067200,"temperature_2m":10,"weather_code":74}})", utc_midnight));

  WeatherWork work;
  assert(work.idle() && !work.take() && !work.collect());
  assert(work.submit("old.example", {}) && work.cancel()); // Queued, before the HTTPS task opens a socket.
  assert(!work.take() && work.submit("new.example", pole));
  const auto job = work.take();
  assert(job && std::string_view(job->host) == "new.example" && job->location == pole);
  assert(!work.submit("third.example", {}) && !work.take() && !work.collect());
  assert(!work.cancel() && work.cancelled() && !work.cancel());
  assert(!work.submit("third.example", {})); // STA and the next job both wait for cleanup.
  work.finish({InternetForecast{Weather::clear, 25}, utc_midnight});
  assert(work.idle() && !work.collect());
  assert(work.submit("third.example", {}) && work.take());
  work.finish({InternetForecast{Weather::cloud, 19}, utc_midnight});
  assert(!work.idle() && work.cancel() && !work.collect()); // Unconsumed reply from a previous city.
  assert(work.submit("fourth.example", {}) && work.take());
  work.finish({InternetForecast{Weather::rain, 17}, utc_midnight});
  const auto reply = work.collect();
  assert(reply && reply->forecast && reply->forecast->weather == Weather::rain &&
         reply->forecast->celsius == 17 && reply->received == utc_midnight && work.idle() && !work.collect());
  assert(work.submit("offline.example", {}) && work.take());
  work.finish({});
  const auto failed = work.collect();
  assert(failed && !failed->forecast && work.idle());
}

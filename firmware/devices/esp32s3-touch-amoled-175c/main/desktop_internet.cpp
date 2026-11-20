#include "desktop_weather_work.h"

#include "esp_crt_bundle.h"
#include "esp_heap_caps.h"
#include "esp_http_client.h"
#include "esp_netif_sntp.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

#include <cstdio>
#include <ctime>

namespace vp8_daily {
namespace {
constexpr int64_t seconds = 1000000;
constexpr int64_t retry = 120 * seconds;
constexpr int64_t weather_interval = 30 * 60 * seconds;
bool sntp_started{}, clock_valid{};
int64_t next_ntp{}, ntp_deadline{}, next_weather{};
char ntp_host[64]{};
WeatherWork weather_work;
TaskHandle_t weather_task{};
portMUX_TYPE weather_lock = portMUX_INITIALIZER_UNLOCKED;

struct WeatherLock {
  WeatherLock() { portENTER_CRITICAL(&weather_lock); }
  ~WeatherLock() { portEXIT_CRITICAL(&weather_lock); }
};

// Only the HTTPS task accesses these objects.
esp_http_client_handle_t request{};
char *body{};
size_t used{};
char url[240]{};
bool overflow{};

void end_weather() {
  if (request && esp_http_client_cleanup(request) != ESP_OK) puts("@VP8_DESKNET1 WEATHER_CLEANUP_FAILED");
  request = nullptr;
  if (body) heap_caps_free(body);
  body = nullptr;
}

esp_err_t collect(esp_http_client_event_t *event) {
  if (event->event_id != HTTP_EVENT_ON_DATA) return ESP_OK;
  if (event->data_len < 0 || size_t(event->data_len) > internet_response_limit - used) {
    overflow = true;
    return ESP_FAIL;
  }
  std::memcpy(body + used, event->data, event->data_len);
  used += event->data_len;
  return ESP_OK;
}

bool start_weather(WeatherTarget target) {
  constexpr uint32_t internal = MALLOC_CAP_INTERNAL | MALLOC_CAP_8BIT;
  if (heap_caps_get_free_size(internal) < 65536 || heap_caps_get_largest_free_block(internal) < 32768) {
    puts("@VP8_DESKNET1 WEATHER_LOW_MEMORY");
    return false;
  }
  const int length = std::snprintf(url, sizeof(url),
      "https://%s/v1/forecast?latitude=%.4f&longitude=%.4f&current=temperature_2m,weather_code&timeformat=unixtime",
      target.host, target.location.latitude_e4 / 10000.0, target.location.longitude_e4 / 10000.0);
  if (length <= 0 || size_t(length) >= sizeof(url)) return false;
  body = static_cast<char *>(heap_caps_malloc(internet_response_limit, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT));
  if (!body) return false;
  used = 0;
  overflow = false;
  esp_http_client_config_t config{};
  config.url = url;
  config.timeout_ms = 4000;
  config.is_async = true;
  config.disable_auto_redirect = true;
  config.crt_bundle_attach = esp_crt_bundle_attach;
  config.event_handler = collect;
  request = esp_http_client_init(&config);
  return request && esp_http_client_set_header(request, "Accept-Encoding", "identity") == ESP_OK;
}

void stop_clock_sync() {
  if (sntp_started) esp_netif_sntp_deinit();
  sntp_started = false;
  ntp_deadline = 0;
}

void publish_system_clock(const InternetSettings &settings, int64_t epoch, PublishInternet publish) {
  clock_valid = true;
  publish(esp_timer_get_time(), local_second(epoch, settings.utc_minutes), Weather::keep, 0);
}

void update_clock(const InternetSettings &settings, int64_t now, PublishInternet publish) {
  if (!sntp_started) {
    if (now < next_ntp) return;
    std::memcpy(ntp_host, settings.time_host, sizeof(ntp_host));
    esp_sntp_config_t config = ESP_NETIF_SNTP_DEFAULT_CONFIG(ntp_host);
    config.start = false;
    if (esp_netif_sntp_init(&config) != ESP_OK) {
      next_ntp = now + retry;
      return;
    }
    if (esp_netif_sntp_start() != ESP_OK) {
      esp_netif_sntp_deinit();
      next_ntp = now + retry;
      return;
    }
    sntp_started = true;
    ntp_deadline = now + 18 * seconds;
  }
  if (esp_netif_sntp_sync_wait(0) == ESP_OK) {
    const auto epoch = std::time(nullptr);
    if (sane_epoch(epoch)) {
      publish_system_clock(settings, epoch, publish);
      next_ntp = esp_timer_get_time() + clock_sync_hourly_delay(local_second(epoch, settings.utc_minutes)) * seconds;
      stop_clock_sync();
      puts("@VP8_DESKNET1 CLOCK_SYNCED");
      return;
    }
  }
  if (now >= ntp_deadline) {
    stop_clock_sync();
    next_ntp = now + retry;
    puts("@VP8_DESKNET1 CLOCK_RETRY");
  }
}
} // namespace

namespace {
bool weather_cancelled() {
  const WeatherLock lock;
  return weather_work.cancelled();
}

WeatherReply fetch_weather(const WeatherJob &job) {
  if (weather_cancelled()) return {};
  if (!start_weather({job.host, job.location})) {
    end_weather();
    return {};
  }
  const auto started = esp_timer_get_time();
  const auto deadline = started + 60 * seconds;
  esp_err_t status = ESP_ERR_TIMEOUT;
  while (!weather_cancelled() && esp_timer_get_time() < deadline) {
    status = esp_http_client_perform(request);
    if (status != ESP_ERR_HTTP_EAGAIN || overflow) break;
    vTaskDelay(pdMS_TO_TICKS(10));
  }
  if (weather_cancelled()) {
    end_weather();
    return {};
  }
  if (esp_timer_get_time() >= deadline) status = ESP_ERR_TIMEOUT;
  std::optional<InternetForecast> forecast;
  const auto received = std::time(nullptr);
  const auto http_status = esp_http_client_get_status_code(request);
  const bool complete = esp_http_client_is_complete_data_received(request);
  if (status == ESP_OK && !overflow && http_status == 200 && complete && sane_epoch(received)) {
    forecast = parse_internet_forecast({body, used}, received);
  }
  if (!forecast) {
    int tls_error = 0, tls_flags = 0;
    const auto tls_status = esp_http_client_get_and_clear_last_tls_error(request, &tls_error, &tls_flags);
    printf("@VP8_DESKNET1 WEATHER_RETRY result=%s http=%d complete=%u bytes=%u overflow=%u tls=%s tls_code=%d tls_flags=%x elapsed_ms=%lld\n",
        esp_err_to_name(status), http_status, unsigned(complete), unsigned(used), unsigned(overflow),
        esp_err_to_name(tls_status), tls_error, unsigned(tls_flags), (esp_timer_get_time() - started) / 1000);
  }
  end_weather();
  return {forecast, received};
}

void weather_worker(void *) {
  for (;;) {
    ulTaskNotifyTake(pdTRUE, portMAX_DELAY);
    std::optional<WeatherJob> job;
    {
      const WeatherLock lock;
      job = weather_work.take();
    }
    if (job) {
      const auto reply = fetch_weather(*job);
      const WeatherLock lock;
      weather_work.finish(reply);
    }
  }
}

bool weather_submit(WeatherTarget target) {
  if (!weather_task &&
      xTaskCreatePinnedToCore(weather_worker, "vp8_weather", 8192, nullptr,
                              tskIDLE_PRIORITY, &weather_task, 1) != pdPASS) {
    puts("@VP8_DESKNET1 WEATHER_TASK_UNAVAILABLE");
    return false;
  }
  {
    const WeatherLock lock;
    if (!weather_work.submit(target.host, target.location)) return false;
  }
  xTaskNotifyGive(weather_task);
  return true;
}
} // namespace

bool internet_restore_clock(const InternetSettings &settings, PublishInternet publish) {
  const auto epoch = std::time(nullptr);
  if (!sane_epoch(epoch)) return false;
  publish_system_clock(settings, epoch, publish);
  return true;
}

void internet_poll(const InternetSettings &settings, WeatherSelection weather, int64_t now, PublishInternet publish) {
  update_clock(settings, now, publish);
  const auto target = weather_target(settings, weather);
  if (!clock_valid || !target) return;
  std::optional<WeatherReply> reply;
  bool idle;
  {
    const WeatherLock lock;
    reply = weather_work.collect();
    idle = weather_work.idle();
  }
  if (reply) {
    next_weather = now + (reply->forecast ? weather_interval : retry);
    if (const auto &forecast = reply->forecast) {
      publish(now, local_second(reply->received, settings.utc_minutes), forecast->weather, forecast->celsius);
      puts("@VP8_DESKNET1 WEATHER_SYNCED");
      printf("@VP8_DESKNET1 WEATHER_DISPLAY condition=%u celsius=%d\n",
          unsigned(forecast->weather), forecast->celsius);
    }
  }
  if (idle && now >= next_weather && !weather_submit(*target)) next_weather = now + retry;
}

void internet_refresh_weather() {
  const WeatherLock lock;
  weather_work.cancel();
  next_weather = 0;
}

bool internet_pause(bool reconfigured) {
  stop_clock_sync();
  if (reconfigured) {
    clock_valid = false;
    next_weather = next_ntp = 0;
  }
  const WeatherLock lock;
  return weather_work.cancel();
}
} // namespace vp8_daily

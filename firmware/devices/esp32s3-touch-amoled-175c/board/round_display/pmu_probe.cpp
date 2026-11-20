#include "pmu_probe.h"
#include "esp_log.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include <inttypes.h>

namespace {
constexpr unsigned max_attempts = 3;
constexpr int timeout_ms = 100;
constexpr unsigned backoff_ms = 20;
constexpr uint8_t id_register = 0x03, expected_id = 0x4a;
constexpr const char *tag = "round_175c";

bool retryable(esp_err_t error) {
  return error == ESP_ERR_TIMEOUT || error == ESP_ERR_INVALID_RESPONSE;
}
} // namespace

esp_err_t round_175c_probe_pmu(i2c_master_bus_handle_t bus,
                             gpio_num_t sda, gpio_num_t scl) {
  const auto started = esp_timer_get_time();
  i2c_device_config_t config{};
  config.dev_addr_length = I2C_ADDR_BIT_LEN_7;
  config.device_address = 0x34;
  config.scl_speed_hz = 400000;
  i2c_master_dev_handle_t handle = nullptr;
  auto operation = i2c_master_bus_add_device(bus, &config, &handle);
  esp_err_t cleanup = ESP_OK;
  unsigned attempts = 0;
  uint8_t id = 0;
  bool id_valid = false;
  const char *stage = "add";
  if (operation == ESP_OK) {
    stage = "read";
    for (unsigned attempt = 1; attempt <= max_attempts; ++attempt) {
      attempts = attempt;
      id = 0;
      uint8_t reg = id_register; // Keep ISR-visible transfer data on the stack.
      const auto before_read = esp_timer_get_time();
      const auto read = i2c_master_transmit_receive(
          handle, &reg, 1, &id, 1, timeout_ms);
      const auto read_us = esp_timer_get_time() - before_read;
      id_valid = read == ESP_OK;
      if (!id_valid) id = 0; // Never interpret bytes from a failed transfer.
      operation = id_valid && id != expected_id ? ESP_ERR_NOT_SUPPORTED : read;
      if (operation == ESP_OK) {
        ESP_LOGI(tag, "pmu_read attempt=%u/%u err=0x%x (%s) read_us=%" PRId64
                 " id_valid=1 id=0x%02x",
                 attempt, max_attempts, unsigned(read), esp_err_to_name(read),
                 read_us, unsigned(id));
      } else {
        // A post-SDK snapshot, not a capture of fault-time bus levels. Do not
        // change GPIO configuration or add pulses; IDF owns bus recovery.
        const int sda_level = id_valid ? -1 : gpio_get_level(sda);
        const int scl_level = id_valid ? -1 : gpio_get_level(scl);
        ESP_LOGW(tag, "pmu_read attempt=%u/%u err=0x%x (%s) read_us=%" PRId64
                 " id_valid=%u id=0x%02x post_sda=%d post_scl=%d",
                 attempt, max_attempts, unsigned(read), esp_err_to_name(read),
                 read_us, unsigned(id_valid), unsigned(id), sda_level, scl_level);
      }
      if (id_valid || !retryable(read) || attempt == max_attempts) break;
      // Nominal RTOS backoff only; neither SDK calls nor scheduling have a
      // hard wall-clock bound established by this application loop.
      vTaskDelay(pdMS_TO_TICKS(backoff_ms));
    }
    if (id_valid && id != expected_id) stage = "identity";
    cleanup = i2c_master_bus_rm_device(handle);
    if (operation == ESP_OK && cleanup != ESP_OK) stage = "remove";
  }
  const auto result = operation != ESP_OK ? operation : cleanup;
  const auto elapsed_us = esp_timer_get_time() - started;
  if (result == ESP_OK) {
    ESP_LOGI(tag, "pmu_probe result=ok attempts=%u elapsed_us=%" PRId64
             " id=0x%02x cleanup=0x%x",
             attempts, elapsed_us, unsigned(id), unsigned(cleanup));
  } else {
    ESP_LOGE(tag, "pmu_probe result=failed stage=%s attempts=%u elapsed_us=%" PRId64
             " op=0x%x (%s) cleanup=0x%x (%s) id_valid=%u id=0x%02x",
             stage, attempts, elapsed_us, unsigned(operation),
             esp_err_to_name(operation), unsigned(cleanup),
             esp_err_to_name(cleanup), unsigned(id_valid), unsigned(id));
  }
  return result;
}

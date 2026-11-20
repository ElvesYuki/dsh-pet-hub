#include "round_battery.h"
#include "driver/i2c_master.h"
#if ROUND_POWER_KEY
#include "round_power_key.h"
#endif

namespace {
// AXP2101 datasheet §6.13.2. These transfers only set the read address pointer.
constexpr uint8_t status_reg = 0x00, adc_enable_reg = 0x30;
constexpr uint8_t vbat_reg = 0x34, percent_reg = 0xa4;
constexpr int transfer_timeout_ms = 8;
i2c_master_dev_handle_t pmu{};

template <size_t N>
bool read(uint8_t reg, uint8_t (&bytes)[N]) {
  return i2c_master_transmit_receive(pmu, &reg, 1, bytes, N, transfer_timeout_ms) == ESP_OK;
}
} // namespace

esp_err_t round_battery_init() {
  if (pmu) return ESP_OK;
  i2c_master_bus_handle_t bus{};
  const auto bus_result = i2c_master_get_bus_handle(I2C_NUM_0, &bus);
  if (bus_result != ESP_OK) return bus_result;
  i2c_device_config_t config{};
  config.dev_addr_length = I2C_ADDR_BIT_LEN_7;
  config.device_address = 0x34;
  config.scl_speed_hz = 400000;
  i2c_master_dev_handle_t handle{};
  const auto result = i2c_master_bus_add_device(bus, &config, &handle);
  if (result == ESP_OK) pmu = handle;
  return result;
}

std::optional<bool> round_battery_usb_power() {
  uint8_t status[1]{};
  if (!pmu || !read(status_reg, status) || !(status[0] & 0x08)) return std::nullopt;
  return bool(status[0] & 0x20);
}

std::optional<RoundBatteryReading> round_battery_read() {
  uint8_t status[2]{};
  if (!pmu || !read(status_reg, status)) return std::nullopt;
  const auto raw_phase = status[1] & 0x7;
  RoundBatteryReading reading{bool(status[0] & 0x08), bool(status[0] & 0x20),
      RoundBatteryFlow((status[1] >> 5) & 0x3),
      raw_phase <= 5 ? RoundChargePhase(raw_phase) : RoundChargePhase::unknown, {}, {}};
  if (!reading.present) return reading;

  uint8_t percent[1]{};
  if (read(percent_reg, percent) && percent[0] <= 100) reading.percent = percent[0];

  uint8_t adc_enable[1]{}, voltage[2]{};
  if (read(adc_enable_reg, adc_enable) && (adc_enable[0] & 1) && read(vbat_reg, voltage)) {
    const auto millivolts = uint16_t((unsigned(voltage[0] & 0x3f) << 8) | voltage[1]);
    if (millivolts > 0 && millivolts <= 0x1fff) reading.millivolts = millivolts;
  }
  return reading;
}

#if ROUND_POWER_KEY
namespace {
// AXP2101 datasheet IRQ Enable 1 and IRQ Status 1. Acknowledge only the PWR short-press bit.
constexpr uint8_t irq_enable_reg = 0x41, irq_status_reg = 0x49, short_press = 1 << 3;
}

esp_err_t round_power_key_init() {
  if (!pmu) return ESP_ERR_INVALID_STATE;
  uint8_t enabled[1]{};
  if (!read(irq_enable_reg, enabled)) return ESP_FAIL;
  if (!(enabled[0] & short_press)) return ESP_ERR_NOT_SUPPORTED;
  bool stale{};
  return round_power_key_take_short_press(stale);
}

esp_err_t round_power_key_take_short_press(bool &pressed) {
  pressed = false;
  if (!pmu) return ESP_ERR_INVALID_STATE;
  uint8_t status[1]{};
  if (!read(irq_status_reg, status)) return ESP_FAIL;
  if (!(status[0] & short_press)) return ESP_OK;
  const uint8_t ack[]{irq_status_reg, short_press};
  const auto result = i2c_master_transmit(pmu, ack, sizeof(ack), transfer_timeout_ms);
  pressed = result == ESP_OK;
  return result;
}
#endif

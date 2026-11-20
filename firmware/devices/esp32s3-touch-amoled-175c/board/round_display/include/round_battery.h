#pragma once
#include <cstdint>
#include <optional>
#include "esp_err.h"

enum class RoundBatteryFlow : uint8_t { standby, charging, discharging, unknown };
enum class RoundChargePhase : uint8_t { trickle, precharge, cc, cv, full, idle, unknown };

struct RoundBatteryReading {
  bool present;
  bool usb_power;
  RoundBatteryFlow flow;
  RoundChargePhase phase;
  std::optional<uint8_t> percent;
  std::optional<uint16_t> millivolts;
};

// Attach after the display BSP initializes I2C0. Runtime reads have a single caller.
esp_err_t round_battery_init();
std::optional<bool> round_battery_usb_power();
std::optional<RoundBatteryReading> round_battery_read();

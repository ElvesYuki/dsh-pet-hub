#pragma once
#include "driver/gpio.h"

// 1.75C schematic, page 1 KEYS. Key1 shorts GPIO0 to ground; R7 pulls it high.
inline esp_err_t round_boot_key_init() {
  gpio_config_t config{};
  config.pin_bit_mask = 1ULL << GPIO_NUM_0;
  config.mode = GPIO_MODE_INPUT;
  config.pull_up_en = GPIO_PULLUP_DISABLE;
  config.pull_down_en = GPIO_PULLDOWN_DISABLE;
  config.intr_type = GPIO_INTR_DISABLE;
  return gpio_config(&config);
}

inline bool round_boot_key_pressed() { return gpio_get_level(GPIO_NUM_0) == 0; }

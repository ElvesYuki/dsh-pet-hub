#pragma once
#include <cstdint>
#include "esp_err.h"
#include "lvgl.h"

// Pin definitions: ../../pinout.md; device evidence is recorded in the
// round-pet 2026-10-29 reports.
esp_err_t round_display_init(lv_display_t **display);
// Software task placement only; -1 retains the original no-affinity default.
esp_err_t round_display_init_on_core(lv_display_t **display, int core);
esp_err_t round_display_backlight(bool enabled);
inline constexpr uint8_t round_display_normal_brightness = 153;
esp_err_t round_display_brightness(uint8_t level);

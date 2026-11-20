#pragma once
#include "esp_lcd_panel_io.h"
#include "esp_lcd_panel_ops.h"
#include "lvgl.h"

// One startup binding per boot. Callers stop submissions, drain/delete the IO,
// then release their original callback context. No arbitrary concurrent teardown.
esp_err_t round_observation_bind(esp_lcd_panel_io_handle_t, esp_lcd_panel_handle_t);
esp_err_t round_observation_attach(lv_display_t *);

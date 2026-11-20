#pragma once
#include "esp_lcd_panel_io.h"
#include "esp_lcd_panel_ops.h"

// Isolated local playback measurement without the LVGL display owner.
esp_err_t round_display_probe_init(esp_lcd_panel_io_handle_t *, esp_lcd_panel_handle_t *);

#pragma once
#include "round_touch_raw.h"
#include "esp_lcd_panel_io.h"
#include "esp_lcd_touch.h"
extern round_touch_raw::State round_touch_raw_state;
void round_touch_raw_bind(esp_lcd_panel_io_handle_t, esp_lcd_touch_handle_t);
void round_touch_raw_owner();
extern "C" const volatile uint32_t round_touch_raw_plan[];

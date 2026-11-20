#pragma once
#include "round_touch_read_ack.h"
#include "esp_lcd_panel_io.h"
#include "esp_lcd_touch.h"
extern round_touch_read_ack::State round_touch_read_ack_state;
extern "C" esp_err_t round_touch_read_ack_write(esp_lcd_touch_handle_t,
                                          esp_lcd_panel_io_handle_t, uint8_t);
extern "C" const volatile uint32_t round_touch_read_ack_plan[];

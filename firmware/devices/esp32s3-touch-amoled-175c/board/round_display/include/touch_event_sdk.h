#pragma once
#include "round_touch_event.h"
#include "round_touch.h"
#include "esp_lcd_touch.h"
// One static binding per boot. No runtime touch deletion/rebind/service removal.
esp_err_t round_touch_event_bind(esp_lcd_touch_handle_t);
esp_err_t round_touch_event_owner(); // First call on the playback worker, then arm.
RoundTouch round_touch_event_read(); // Same owner, synchronous SDK I/O.
RoundTouch round_touch_event_sample(esp_err_t &); // Original BSP read/get boundary.
esp_err_t round_touch_event_stop(); // Same owner; static ISR/context stay alive.
extern "C" const volatile uint32_t round_touch_event_plan[];

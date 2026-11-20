#include "touch_raw_sdk.h"
#include "esp_attr.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include <type_traits>

DRAM_ATTR round_touch_raw::State round_touch_raw_state;
void round_touch_raw_bind(esp_lcd_panel_io_handle_t io,
                          esp_lcd_touch_handle_t touch) {
  if (!round_touch_raw_state.bind(io, touch))
    round_touch_raw_state.foreign.store(1, std::memory_order_relaxed);
}
void round_touch_raw_owner() {
  if (!round_touch_raw_state.register_owner(xTaskGetCurrentTaskHandle()))
    round_touch_raw_state.foreign.store(1, std::memory_order_relaxed);
}
extern "C" esp_err_t __real_esp_lcd_touch_read_data(esp_lcd_touch_handle_t);
extern "C" esp_err_t __real_esp_lcd_panel_io_tx_param(esp_lcd_panel_io_handle_t,
                                                      int, const void *,
                                                      size_t);
extern "C" esp_err_t __real_esp_lcd_panel_io_rx_param(esp_lcd_panel_io_handle_t,
                                                      int, void *, size_t);
extern "C" esp_err_t
__wrap_esp_lcd_touch_read_data(esp_lcd_touch_handle_t touch) {
  const auto own = round_touch_raw_state.begin(
      touch, xTaskGetCurrentTaskHandle(), uint32_t(esp_timer_get_time()));
  const auto result = __real_esp_lcd_touch_read_data(touch);
  round_touch_raw_state.end(own, result);
  return result;
}
extern "C" esp_err_t
__wrap_esp_lcd_panel_io_tx_param(esp_lcd_panel_io_handle_t io, int cmd,
                                 const void *p, size_t n) {
  const auto result = __real_esp_lcd_panel_io_tx_param(io, cmd, p, n);
  round_touch_raw_state.tx_done(io, xTaskGetCurrentTaskHandle(), cmd, p, n,
                                result);
  return result;
}
extern "C" esp_err_t
__wrap_esp_lcd_panel_io_rx_param(esp_lcd_panel_io_handle_t io, int cmd, void *p,
                                 size_t n) {
  const auto result = __real_esp_lcd_panel_io_rx_param(io, cmd, p, n);
  round_touch_raw_state.rx_done(io, xTaskGetCurrentTaskHandle(), cmd, p, n,
                                result);
  return result;
}
static_assert(std::is_same_v<decltype(&__wrap_esp_lcd_touch_read_data),
                             decltype(&esp_lcd_touch_read_data)>);
static_assert(std::is_same_v<decltype(&__wrap_esp_lcd_panel_io_tx_param),
                             decltype(&esp_lcd_panel_io_tx_param)>);
static_assert(std::is_same_v<decltype(&__wrap_esp_lcd_panel_io_rx_param),
                             decltype(&esp_lcd_panel_io_rx_param)>);
extern "C" const volatile uint32_t round_touch_raw_plan[] = {
    1,   sizeof(round_touch_raw::State),  sizeof(round_touch_raw::Record), 8,
    384, sizeof(round_touch_raw::Emitter)};
static_assert(sizeof(round_touch_raw::State) +
                  sizeof(round_touch_raw::Emitter) <=
              1024);

#include "touch_read_ack_sdk.h"
#include "touch_raw_sdk.h"
#include "esp_attr.h"
#include "esp_err.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

DRAM_ATTR round_touch_read_ack::State round_touch_read_ack_state;
extern "C" esp_err_t __real_esp_lcd_panel_io_tx_param(
    esp_lcd_panel_io_handle_t, int, const void *, size_t);

extern "C" esp_err_t round_touch_read_ack_write(esp_lcd_touch_handle_t touch,
                                          esp_lcd_panel_io_handle_t io,
                                          uint8_t received) {
  if (!touch || touch != round_touch_raw_state.touch.load(std::memory_order_acquire) ||
      !round_touch_raw_state.owns(io, xTaskGetCurrentTaskHandle())) {
    round_touch_read_ack_state.rejected.store(1, std::memory_order_relaxed);
    return ESP_ERR_INVALID_STATE; // No write for unbound/foreign users.
  }
  const uint8_t ack[] = {0x00, 0xAB};
  const auto at = uint32_t(esp_timer_get_time());
  // Deliberately bypass the passive wrapper: T1 describes original read I/O.
  // This one extra write is independently visible in A1, never retried here.
  const auto error = __real_esp_lcd_panel_io_tx_param(io, 0xD0, ack, sizeof(ack));
  round_touch_read_ack_state.record(
      {round_touch_raw_state.ordinal, at, uint32_t(esp_timer_get_time()) - at,
       received, error});
  return error;
}
extern "C" const volatile uint32_t round_touch_read_ack_plan[] = {
    1, sizeof(round_touch_read_ack::State), sizeof(round_touch_read_ack::Emitter),
    round_touch_read_ack::capacity, round_touch_read_ack::packet_capacity};
static_assert(sizeof(round_touch_read_ack::State) +
                  sizeof(round_touch_read_ack::Emitter) <= 512);

#include "touch_event_sdk.h"
#include "driver/gpio.h"
#include "esp_attr.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include <atomic>

namespace {
using namespace round_touch_event_model;
// Xtensa does not advertise all atomic operations as lock-free. This code uses
// only aligned load/store; the final object/IRQ audit rejects library atomics.
static_assert(sizeof(std::atomic<uint32_t>) == sizeof(uint32_t) &&
              alignof(std::atomic<uint32_t>) >= alignof(uint32_t));
struct State {
  Counter irq;
  Consumer worker{irq, 1}; // Never replaced, destroyed, or reused this boot.
  std::atomic<esp_lcd_touch_handle_t> handle{nullptr};
  std::atomic<TaskHandle_t> owner{nullptr};
  std::atomic<uint32_t> irq_us{0}, owner_error{0};
  bool attempted = false, bound = false, published = false;
  uint32_t poll_us = 0, read_us = 0, done_us = 0;
  int64_t bound_at = 0, previous_poll = 0;
  bool window_failed = false;
  portMUX_TYPE publication_lock = portMUX_INITIALIZER_UNLOCKED;
  round_touch_event::Frame publication;
};
} // namespace
// All callback/context storage has internal boot lifetime, even on failure/stop.
DRAM_ATTR State round_touch_event_state;

extern "C" void IRAM_ATTR round_touch_event_irq(void *context) {
  auto tp = static_cast<esp_lcd_touch_handle_t>(context);
  auto &s = round_touch_event_state;
  if (tp != s.handle.load(std::memory_order_acquire) || !tp) return;
  s.irq_us.store(uint32_t(esp_timer_get_time()), std::memory_order_relaxed);
  s.irq.edge(); // Only this one non-reentrant GPIO callback writes the counter.
}
namespace {
void publish() { // Worker only (or startup failure before a worker exists).
  auto &s = round_touch_event_state;
  round_touch_event::Frame f;
  f.sample = s.worker.snapshot();
  f.irq_us = s.irq_us.load(std::memory_order_relaxed);
  f.owner_error = s.owner_error.load(std::memory_order_relaxed);
  f.poll_us = s.poll_us; f.read_us = s.read_us; f.done_us = s.done_us;
  portENTER_CRITICAL(&s.publication_lock);
  s.publication = f; s.published = true;
  portEXIT_CRITICAL(&s.publication_lock);
}
esp_err_t init_failure(esp_err_t error) {
  auto &s = round_touch_event_state;
  s.worker.arm(error, false);
  publish();
  return error;
}
bool own() {
  auto &s = round_touch_event_state;
  if (s.owner.load(std::memory_order_acquire) == xTaskGetCurrentTaskHandle()) return true;
  s.owner_error.store(1, std::memory_order_release);
  return false; // Never mutate worker fields from an unregistered task.
}
} // namespace

esp_err_t round_touch_event_bind(esp_lcd_touch_handle_t tp) {
  auto &s = round_touch_event_state;
  if (s.attempted) {
    s.owner_error.store(1, std::memory_order_release);
    return ESP_ERR_INVALID_STATE;
  }
  s.attempted = true;
  if (!tp || tp->config.int_gpio_num == GPIO_NUM_NC || tp->config.interrupt_callback)
    return init_failure(ESP_ERR_INVALID_ARG);
  // Own one cache-on service. The touch SDK registration helper would attempt
  // another install and emit an E log, so bind through the GPIO SDK directly.
  const auto installed = gpio_install_isr_service(0);
  if (installed != ESP_OK) return init_failure(installed);
  s.bound_at = esp_timer_get_time();
  s.handle.store(tp, std::memory_order_release);
  const auto registered = gpio_isr_handler_add(tp->config.int_gpio_num, round_touch_event_irq, tp);
  if (registered != ESP_OK) {
    s.handle.store(nullptr, std::memory_order_release); // Late callback is inert.
    // Static context remains alive; retain shared service, never uninstall it.
    const auto disabled = gpio_intr_disable(tp->config.int_gpio_num);
    if (disabled != ESP_OK) s.owner_error.store(uint32_t(disabled), std::memory_order_release);
    return init_failure(registered);
  }
  s.bound = true;
  return ESP_OK;
}
esp_err_t round_touch_event_owner() {
  auto &s = round_touch_event_state;
  portENTER_CRITICAL(&s.publication_lock);
  const auto registered = s.owner.load(std::memory_order_relaxed) != nullptr;
  if (!registered) s.owner.store(xTaskGetCurrentTaskHandle(), std::memory_order_release);
  portEXIT_CRITICAL(&s.publication_lock);
  if (registered) {
    s.owner_error.store(1, std::memory_order_release);
    return ESP_ERR_INVALID_STATE;
  }
  const auto now = esp_timer_get_time();
  const auto init_error = !s.bound ? ESP_ERR_INVALID_STATE :
      now < s.bound_at || now - s.bound_at > 5000000 ? ESP_ERR_TIMEOUT : ESP_OK;
  const auto ok = s.worker.arm(init_error, s.bound);
  publish();
  return ok ? ESP_OK : ESP_ERR_INVALID_STATE;
}
RoundTouch round_touch_event_read() {
  auto &s = round_touch_event_state;
  RoundTouch r{}; r.valid = false;
  if (!own()) return r;
  const auto now = esp_timer_get_time();
  s.poll_us = uint32_t(now);
  if (s.window_failed || now < s.bound_at ||
      now - (s.previous_poll ? s.previous_poll : s.bound_at) > 5000000) {
    s.window_failed = true;
    s.owner_error.store(ESP_ERR_TIMEOUT, std::memory_order_release);
    publish(); return r; // Fail closed after an unobserved counter interval.
  }
  s.previous_poll = now;
  const auto p = s.worker.poll();
  if (p.decision != Decision::Read) { publish(); return r; }
  s.read_us = uint32_t(esp_timer_get_time());
  esp_err_t error = ESP_OK;
  const auto sample = round_touch_event_sample(error);
  const auto completed_at = esp_timer_get_time();
  s.done_us = uint32_t(completed_at);
  if (completed_at < now || completed_at - now > 5000000) {
    s.window_failed = true;
    s.owner_error.store(ESP_ERR_TIMEOUT, std::memory_order_release);
    s.worker.stop(); // Drain the late I/O but never publish a stale gesture.
  }
  const auto result = s.worker.complete(p.ticket, error, sample.pressed);
  if (result.publish) r = sample;
  publish(); return r;
}
esp_err_t round_touch_event_stop() {
  if (!own()) return ESP_ERR_INVALID_STATE;
  auto &s = round_touch_event_state;
  s.worker.stop(); publish();
  // The synchronous owner API cannot stop itself in the middle of an I/O call.
  return s.worker.drained() ? ESP_OK : ESP_ERR_INVALID_STATE;
}
namespace round_touch_event {
bool snapshot(Frame &out) {
  auto &s = round_touch_event_state;
  portENTER_CRITICAL(&s.publication_lock);
  const auto ready = s.published;
  if (ready) out = s.publication;
  portEXIT_CRITICAL(&s.publication_lock);
  // Foreign-owner failures can occur without another worker publication.
  if (ready) out.owner_error = s.owner_error.load(std::memory_order_acquire);
  return ready;
}
} // namespace round_touch_event
extern "C" const volatile uint32_t round_touch_event_plan[] = {
  1, sizeof(State), sizeof(round_touch_event::Frame),
  round_touch_event::packet_capacity, max_pending, sizeof(round_touch_event::Emitter)};

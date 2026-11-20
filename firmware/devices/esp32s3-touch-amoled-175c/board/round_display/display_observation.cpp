#include "display_observation_sdk.h"
#include "observation_state.h"
#include "esp_attr.h"
#include "esp_timer.h"
#include <cstdio>
#include <type_traits>
#ifdef ROUND_OBSERVATION_TEST
#include <new>
#endif

namespace round_observation {
namespace {
struct Slot {
  esp_lcd_panel_io_color_trans_done_cb_t callback = nullptr;
  void *context = nullptr;
  esp_lcd_panel_io_handle_t io = nullptr;
  std::atomic<uint32_t> live{0};
};
struct State {
  Counters counters;
  std::atomic<esp_lcd_panel_io_handle_t> io{nullptr};
  std::atomic<esp_lcd_panel_handle_t> panel{nullptr};
  std::atomic<lv_display_t *> display{nullptr};
  std::atomic<uint32_t> bound{0}, captured{0};
  Slot slot;
};
static_assert(sizeof(std::atomic<void *>) == sizeof(void *) &&
              alignof(std::atomic<void *>) >= alignof(void *));
DRAM_ATTR State state;

// This shim deliberately ignores SDK user_ctx: the SDK replaces callback and
// user_ctx separately. Slot fields are written once before release publication.
// Its own path is IRAM/DRAM; forwarding retains the original cache-on ISR policy.
bool IRAM_ATTR done(esp_lcd_panel_io_handle_t io,
                    esp_lcd_panel_io_event_data_t *event, void *) {
  if (!state.slot.live.load(std::memory_order_acquire) || io != state.slot.io)
    return false;
  state.counters.add(Done);
  state.counters.set(DoneUs, uint32_t(esp_timer_get_time()));
  return state.slot.callback(io, event, state.slot.context);
}
void display_event(lv_event_t *e) {
  if (lv_event_get_target(e) != state.display.load(std::memory_order_acquire)) return;
  const auto code = lv_event_get_code(e);
  if (code == LV_EVENT_FLUSH_START) {
    state.counters.add(FlushStart);
    auto *area = static_cast<const lv_area_t *>(lv_event_get_param(e));
    if (area) state.counters.add(FlushBytes, uint32_t(lv_area_get_size(area)) * 2);
  } else if (code == LV_EVENT_FLUSH_FINISH) {
    state.counters.add(FlushReturn); // Callback return, NOT DMA completion.
  }
}
} // namespace

Snapshot snapshot() { return state.counters.copy(); }
void view(bool full, bool changed, uint32_t pixels, uint32_t generation,
          uint32_t frame) {
  state.counters.add(Show);
  state.counters.add(full ? Full : changed ? Dirty : Equal);
  state.counters.add(Pixels, pixels);
  state.counters.set(Generation, generation);
  state.counters.set(Frame, frame);
}
void touch(bool valid, bool pressed, int error, unsigned stage) {
  state.counters.add(TouchRead);
  state.counters.set(TouchUs, uint32_t(esp_timer_get_time()));
  if (!valid) {
    state.counters.add(TouchError);
    if (state.counters.first(TouchFirstError, error))
      state.counters.set(TouchStage, stage); // Stage belongs to the first error.
    return; // A read failure must not synthesize a release/press edge.
  }
  state.counters.add(TouchValid);
  const auto previous = state.counters.values[Pressed].load(std::memory_order_relaxed);
  state.counters.set(Pressed, uint32_t(pressed)); // Worker is the sole writer.
  if (pressed && !previous) state.counters.add(PressEdge);
}

size_t format(const Snapshot &s, uint32_t seq, uint32_t drops,
              char *out, size_t cap, Checksum checksum) {
  if (!out || !cap || !checksum) return 0;
  out[0] = 0;
  static constexpr const char *names[] = {
      "show", "full", "dirty", "equal", "pixels", "generation", "frame",
      "flush_start", "flush_return", "flush_bytes", "submit", "submit_err",
      "submit_first_err", "submit_us", "done", "done_us", "reg", "reg_err",
      "reg_first_err", "reg_bypass", "observed", "io_del", "io_del_err",
      "touch_read", "touch_valid", "touch_err", "touch_first_err", "touch_stage",
      "press_edge", "pressed", "touch_us"};
  static_assert(sizeof(names) / sizeof(names[0]) == Count);
  int n = snprintf(out, cap, "@400V1 seq=%lu drop=%lu",
                   (unsigned long)seq, (unsigned long)drops);
  if (n < 0 || size_t(n) >= cap) { out[0] = 0; return 0; }
  size_t used = size_t(n);
  for (unsigned i = 0; i < Count; ++i) {
    const bool error = i == SubmitFirstError || i == RegistrationFirstError ||
                       i == TouchFirstError;
    n = error ? snprintf(out + used, cap - used, " %s=%ld", names[i],
                         (long)int32_t(s.value[i]))
              : snprintf(out + used, cap - used, " %s=%lu", names[i],
                         (unsigned long)s.value[i]);
    if (n < 0 || size_t(n) >= cap - used) { out[0] = 0; return 0; }
    used += size_t(n);
  }
  const auto crc = checksum(reinterpret_cast<const uint8_t *>(out), used);
  n = snprintf(out + used, cap - used, " crc=%08lx\n", (unsigned long)crc);
  if (n < 0 || size_t(n) >= cap - used) { out[0] = 0; return 0; }
  return used + size_t(n);
}
} // namespace round_observation

esp_err_t round_observation_bind(esp_lcd_panel_io_handle_t io,
                                 esp_lcd_panel_handle_t panel) {
  using namespace round_observation;
  if (!io || !panel) return ESP_ERR_INVALID_ARG;
  uint32_t unused = 0;
  if (!state.bound.compare_exchange_strong(unused, 1)) return ESP_ERR_INVALID_STATE;
  state.panel.store(panel, std::memory_order_release);
  state.io.store(io, std::memory_order_release);
  return ESP_OK;
}
esp_err_t round_observation_attach(lv_display_t *display) {
  using namespace round_observation;
  if (!display) return ESP_ERR_INVALID_ARG;
  if (!state.io.load(std::memory_order_acquire)) return ESP_ERR_INVALID_STATE;
  lv_display_t *empty = nullptr;
  if (!state.display.compare_exchange_strong(empty, display)) return ESP_ERR_INVALID_STATE;
  const auto before = lv_display_get_event_count(display);
  lv_display_add_event_cb(display, display_event, LV_EVENT_ALL, nullptr);
  if (lv_display_get_event_count(display) == before + 1) return ESP_OK;
  state.display.store(nullptr, std::memory_order_release);
  return ESP_ERR_NO_MEM;
}

extern "C" esp_err_t __real_esp_lcd_panel_draw_bitmap(
    esp_lcd_panel_handle_t, int, int, int, int, const void *);
extern "C" esp_err_t __real_esp_lcd_panel_io_register_event_callbacks(
    esp_lcd_panel_io_handle_t, const esp_lcd_panel_io_callbacks_t *, void *);
extern "C" esp_err_t __real_esp_lcd_panel_io_del(esp_lcd_panel_io_handle_t);

extern "C" esp_err_t __wrap_esp_lcd_panel_draw_bitmap(
    esp_lcd_panel_handle_t panel, int x1, int y1, int x2, int y2, const void *data) {
  using namespace round_observation;
  const bool own = panel && panel == state.panel.load(std::memory_order_acquire);
  if (own) {
    state.counters.add(Submit);
    state.counters.set(SubmitUs, uint32_t(esp_timer_get_time()));
  }
  const auto result = __real_esp_lcd_panel_draw_bitmap(panel, x1, y1, x2, y2, data);
  if (own && result != ESP_OK) {
    state.counters.add(SubmitError); state.counters.first(SubmitFirstError, result);
  }
  return result;
}
extern "C" esp_err_t __wrap_esp_lcd_panel_io_register_event_callbacks(
    esp_lcd_panel_io_handle_t io, const esp_lcd_panel_io_callbacks_t *callbacks,
    void *context) {
  using namespace round_observation;
  if (!io || io != state.io.load(std::memory_order_acquire))
    return __real_esp_lcd_panel_io_register_event_callbacks(io, callbacks, context);
  state.counters.add(Registration);
  const bool capture = callbacks && callbacks->on_color_trans_done &&
                       !state.captured.exchange(1, std::memory_order_acq_rel);
  esp_lcd_panel_io_callbacks_t wrapped{};
  if (capture) {
    state.slot.callback = callbacks->on_color_trans_done;
    state.slot.context = context;
    state.slot.io = io;
    state.slot.live.store(1, std::memory_order_release);
    wrapped = *callbacks; wrapped.on_color_trans_done = done;
  } else {
    state.counters.add(RegistrationBypass);
  }
  state.counters.set(CompletionObserved, 0);
  const auto result = __real_esp_lcd_panel_io_register_event_callbacks(
      io, capture ? &wrapped : callbacks, context);
  if (result != ESP_OK) {
    state.counters.add(RegistrationError);
    state.counters.first(RegistrationFirstError, result);
  } else if (capture) state.counters.set(CompletionObserved, 1);
  // The static slot is never rewritten/reused, even on registration failure.
  return result;
}
extern "C" esp_err_t __wrap_esp_lcd_panel_io_del(esp_lcd_panel_io_handle_t io) {
  using namespace round_observation;
  const bool own = io && io == state.io.load(std::memory_order_acquire);
  if (own) state.counters.add(IoDelete);
  const auto result = __real_esp_lcd_panel_io_del(io); // Original SDK drains first.
  if (own) {
    if (result != ESP_OK) state.counters.add(IoDeleteError);
    else {
      state.slot.live.store(0, std::memory_order_release); // Do not clear fields.
      state.counters.set(CompletionObserved, 0);
      state.io.store(nullptr, std::memory_order_release);
      state.panel.store(nullptr, std::memory_order_release);
      state.display.store(nullptr, std::memory_order_release);
    }
  }
  return result;
}

extern "C" const volatile uint32_t round_display_observation_plan[] = {
    1, sizeof(round_observation::State), sizeof(round_observation::Snapshot),
    round_observation::packet_capacity, round_observation::Count};
static_assert(std::is_same_v<decltype(&__wrap_esp_lcd_panel_draw_bitmap),
                             decltype(&esp_lcd_panel_draw_bitmap)>);
static_assert(std::is_same_v<decltype(&__wrap_esp_lcd_panel_io_register_event_callbacks),
                             decltype(&esp_lcd_panel_io_register_event_callbacks)>);
static_assert(std::is_same_v<decltype(&__wrap_esp_lcd_panel_io_del),
                             decltype(&esp_lcd_panel_io_del)>);
#ifdef ROUND_OBSERVATION_TEST
void round_observation_test_reset() {
  using namespace round_observation;
  state.~State(); new (&state) State{}; // Host fake only, with callbacks quiescent.
}
#endif

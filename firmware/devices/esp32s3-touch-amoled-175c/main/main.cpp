#include "round_display.h"
#include "round_display_probe.h"
#include "esp_heap_caps.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"
#include "freertos/task.h"
#include "vpx/vp8dx.h"
#include "vpx/vpx_decoder.h"
#include "pet_sha256.h"
#if !VP8_OTA
#include "expected.h"
#endif
#if VP8_FLASH_PROBE
#include "cache_firmware.h"
#endif
#if VP8_OTA
#include "ota_firmware.h"
#include "ota_cache.h"
#endif
#if VP8_RETAINED
#include "touch_gesture.h"
#include "daily_policy.h"
#include "round_touch.h"
#if VP8_SLEEP_WAKE
#include "sleep_wake.h"
#endif
#if VP8_FOCUS_MENU
#include "desktop_arc.h"
#include <new>
#endif
#include "driver/usb_serial_jtag.h"
#endif
#include <algorithm>
#include <array>
#include <cstdio>
#include <cstring>
#if VP8_BOOT_PAIRING
#include <string_view>
#endif
#if VP8_PIPELINE
#include "freertos/queue.h"
#include "esp_rom_sys.h"
#include <atomic>
extern "C" {
#include "muse_yuv.h"
}
#endif

#if !VP8_FLASH_PROBE
#if !VP9_REFERENCE_PROBE
extern const uint8_t idle232_start[] asm("_binary_0_232_ivf_start");
extern const uint8_t idle232_end[] asm("_binary_0_232_ivf_end");
#endif
extern const uint8_t idle400_start[] asm("_binary_0_400_ivf_start");
extern const uint8_t idle400_end[] asm("_binary_0_400_ivf_end");
extern const uint8_t action400_start[] asm("_binary_67_400_ivf_start");
extern const uint8_t action400_end[] asm("_binary_67_400_ivf_end");
#endif

namespace {
constexpr unsigned frames = 241;
constexpr unsigned max_samples = 1450;
constexpr unsigned strip = 20;
SemaphoreHandle_t dma_done;
esp_lcd_panel_handle_t panel;
uint16_t *rgb, *stripe;
uint8_t *packet;
uint32_t *metrics;
int64_t started;
#if VP8_PIPELINE
esp_lcd_panel_io_handle_t raw_io;
uint16_t *stripe_extra;
#if VP8_VISUAL_PROBE
constexpr int buffer_count = 3;
constexpr unsigned visual_side = PET_MEDIA_SIDE;
constexpr unsigned i420_bytes = visual_side * visual_side * 3 / 2;
constexpr unsigned stage_count = 5;
using Buffer = uint8_t *;
std::array<Buffer, buffer_count> yuv_slots{};
#else
uint16_t *rgb_extra;
using Buffer = uint16_t *;
#if VP8_RATE_PROBE
uint16_t *rgb_lookahead;
constexpr int buffer_count = 3;
#else
constexpr int buffer_count = 2;
#endif
#endif
#endif
#if !VP8_VISUAL_PROBE
constexpr unsigned stage_count = 4;
#endif

#if VP8_RETAINED
#if VP8_TOUCH_SWIPE
vp8_daily::TouchGesture touch_gesture;
#else
vp8_daily::TouchEdge touch_edge;
#endif
vp8_daily::Input daily_input = vp8_daily::Input::none;
#if VP8_SLEEP_WAKE
vp8_daily::WakeContact wake_contact;
#endif
#if VP8_FOCUS_MENU
bool wait_for_pet_release{};
vp8_daily::DesktopFocusTouch desktop_focus_touch;
std::atomic<int> desktop_focus_seconds{};
vp8_daily::DesktopArc *desktop_arc;
#endif

bool usb_wave() {
#if VP8_OTA
  return vp8_ota::take_wave();
#elif VP8_ACTION_UPDATE
  return vp8_cache::take_serial_wave();
#else
  constexpr char command[] = "WAVE\n";
  static size_t at = 0;
  static bool malformed = false;
  uint8_t bytes[32];
  const int length = usb_serial_jtag_read_bytes(bytes, sizeof(bytes), 0);
  bool matched = false;
  for (int i = 0; i < length; ++i) {
    if (!malformed && bytes[i] == command[at]) ++at;
    else malformed = true;
    if (bytes[i] == '\n') {
      matched |= !malformed && at == sizeof(command) - 1;
      malformed = false;
      at = 0;
    }
  }
  return matched;
#endif
}

void poll_daily_input(unsigned current, [[maybe_unused]] bool automatic_idle) {
#if VP8_OTA
  if (vp8_ota::checking()) return;
#endif
#if VP8_FOCUS_MENU
  if (daily_input == vp8_daily::Input::none && vp8_ota::take_menu_key() && !vp8_ota::pairing_prompt()) {
    daily_input = vp8_daily::Input::open_menu;
    return;
  }
#endif
  const auto sample = round_touch_read();
  const auto now = esp_timer_get_time();
#if VP8_VPC1_USB_PROBE || VP8_VPC1_LAN
  vp8_ota::control_contact(sample.valid, sample.pressed);
#endif
#if VP8_SENSOR_QUERY
  vp8_ota::observe_touch(sample.valid, sample.pressed, sample.x, sample.y, now);
#endif
#if VP8_SLEEP_WAKE
  static int64_t last_sleep_poll = -1;
  static unsigned last_sleep_clip = 0;
  using Contact = vp8_daily::WakeContact::Result;
  if (sample.valid && sample.pressed) vp8_ota::note_sleep_activity(now);
  const auto contact = wake_contact.observe(vp8_daily::sleeping(current), sample.valid, sample.pressed, now);
#if VP8_FOCUS_MENU
  const bool ignore_touch = wait_for_pet_release;
  if (ignore_touch && sample.valid && !sample.pressed) wait_for_pet_release = false;
  const auto remaining = vp8_ota::focus_seconds(now);
  desktop_focus_seconds.store(remaining, std::memory_order_relaxed);
  bool desktop_owned = desktop_focus_touch.captured();
  if (contact == Contact::pass && !ignore_touch && !vp8_ota::pairing_prompt()) {
    const auto open = desktop_focus_touch.observe(remaining > 0, sample.valid, sample.pressed,
                                                  sample.x, sample.y, now);
    desktop_owned |= desktop_focus_touch.captured();
    if (open && daily_input == vp8_daily::Input::none) {
      daily_input = vp8_daily::Input::open_focus;
      return;
    }
  } else {
    desktop_focus_touch = {};
  }
#endif
  if (vp8_daily::sleeping(current)) {
    const auto gap = last_sleep_poll >= 0 && last_sleep_clip == current ? now - last_sleep_poll : -1;
    last_sleep_poll = now;
    last_sleep_clip = current;
    if (daily_input != vp8_daily::Input::none) return;
    if (contact == Contact::wake) {
      vp8_ota::note_wake_touch(now, gap);
      daily_input = vp8_daily::Input::wake_touch;
    }
    else if (usb_wave()) daily_input = vp8_daily::Input::wave;
    else if ((daily_input = vp8_ota::take_power_reaction(true)) == vp8_daily::Input::none &&
             vp8_ota::sleep_external_wake()) daily_input = vp8_daily::Input::wake_external;
#if VP8_LIFT_WAKE
    if (daily_input == vp8_daily::Input::none && vp8_ota::take_lift_wake()) {
      wake_contact.guard_lift(now);
      daily_input = vp8_daily::Input::wake_lift;
    }
#endif
    return;
  }
  last_sleep_poll = -1;
  vp8_ota::request_wake_preload(now);
#endif
#if VP8_TOUCH_SWIPE
#if VP8_SLEEP_WAKE
  const bool take_touch = contact == Contact::pass
#if VP8_FOCUS_MENU
                          && !ignore_touch && !desktop_owned
#endif
                          ;
  auto input = take_touch ? touch_gesture.observe(sample.valid, sample.pressed, sample.x, sample.y, now)
                          : vp8_daily::Input::none;
#else
  auto input = touch_gesture.observe(sample.valid, sample.pressed, sample.x, sample.y, now);
#endif
#else
  auto input = touch_edge.observe(sample.valid, sample.pressed, now) ? vp8_daily::Input::wave : vp8_daily::Input::none;
#endif
  const bool diagnostic = usb_wave();
  if (daily_input != vp8_daily::Input::none) return;
  const auto touch = input != vp8_daily::Input::none;
  if (diagnostic && !touch) input = vp8_daily::Input::wave;
  if (input == vp8_daily::Input::wave && current != vp8_daily::wave) {
    daily_input = input;
    printf("@VP8_DAILY REQUEST source=%s at_us=%lld\n", touch ? "touch" : "usb", now - started);
  }
#if VP8_TOUCH_SWIPE
  if (input == vp8_daily::Input::next || input == vp8_daily::Input::previous) {
    daily_input = input;
    printf("@VP8_DAILY SWIPE direction=%s at_us=%lld\n",
           input == vp8_daily::Input::next ? "left" : "right", now - started);
  }
#endif
#if VP8_PLAYFUL_INTERACTIONS
  if (input == vp8_daily::Input::surprise || input == vp8_daily::Input::petting) daily_input = input;
#if VP8_FOCUS_MENU
  if (daily_input == vp8_daily::Input::none && current == vp8_daily::idle && vp8_ota::focus_due(now))
    daily_input = vp8_daily::Input::focus_due;
#endif
  if (daily_input == vp8_daily::Input::none)
    daily_input = vp8_ota::take_power_reaction(current == vp8_daily::idle);
#endif
#if VP8_LOCAL_MOTION
  const auto motion = vp8_ota::take_local_motion(daily_input == vp8_daily::Input::none &&
      !touch_gesture.pressed());
  if (motion != vp8_daily::Input::none) daily_input = motion;
#endif
#if VP8_VPC1_USB_PROBE || VP8_VPC1_LAN
  if (daily_input == vp8_daily::Input::none && vp8_ota::control_turn(current == vp8_daily::idle || automatic_idle))
    daily_input = vp8_daily::Input::control_ready;
#endif
}
#endif

struct Sample {
  const char *name;
  const uint8_t *start, *end;
  unsigned side;
  const char (*hash)[65];
};

struct Decoder {
  vpx_codec_ctx_t ctx{};
  bool initialized = false;
  ~Decoder() { if (initialized) vpx_codec_destroy(&ctx); }
  bool init(unsigned side) {
    vpx_codec_dec_cfg_t cfg{1, side, side};
#if VP9_REFERENCE_PROBE
    const auto iface = vpx_codec_vp9_dx();
#else
    const auto iface = vpx_codec_vp8_dx();
#endif
    initialized = vpx_codec_dec_init(&ctx, iface, &cfg, 0) == VPX_CODEC_OK;
    return initialized;
  }
};

bool IRAM_ATTR done(esp_lcd_panel_io_handle_t, esp_lcd_panel_io_event_data_t *, void *) {
  BaseType_t higher = pdFALSE;
  xSemaphoreGiveFromISR(dma_done, &higher);
  return higher == pdTRUE;
}

bool push(int x, int y, int w, int h) {
  return esp_lcd_panel_draw_bitmap(panel, x, y, x + w, y + h, stripe) == ESP_OK &&
    xSemaphoreTake(dma_done, pdMS_TO_TICKS(1000)) == pdTRUE;
}

bool blank() {
  std::fill_n(stripe, 466 * strip, 0);
  for (int y = 0; y < 466; y += strip)
    if (!push(0, y, 466, std::min(int(strip), 466 - y))) return false;
  return true;
}

void fill_stripe(uint16_t *target, const uint16_t *pixels, int side, int width, int border, int y, int rows) {
  for (int row = 0; row < rows; ++row) {
    auto *out = target + row * width;
    const int src = y + row - border;
    if (src < 0 || src >= side) {
      std::fill_n(out, width, 0);
    } else {
      if (border) out[0] = out[width - 1] = 0;
      std::copy_n(pixels + src * side, side, out + border);
    }
  }
}

#if VP8_BOOT_PAIRING
void overlay_boot_prompt(uint16_t *target, int width, int y, int rows) {
  struct Glyph { char letter; std::array<uint8_t, 7> mask; };
  constexpr Glyph glyphs[]{
    {'B', {30, 17, 17, 30, 17, 17, 30}}, {'C', {14, 17, 16, 16, 16, 17, 14}},
    {'E', {31, 16, 16, 30, 16, 16, 31}}, {'N', {17, 25, 25, 21, 19, 19, 17}},
    {'O', {14, 17, 17, 17, 17, 17, 14}}, {'P', {30, 17, 17, 30, 16, 16, 16}},
    {'R', {30, 17, 17, 30, 20, 18, 17}}, {'S', {15, 16, 16, 14, 1, 1, 30}},
    {'T', {31, 4, 4, 4, 4, 4, 4}},
  };
  constexpr std::string_view message = "PRESS BOOT ONCE";
  constexpr int scale = 4, pitch = 6 * scale, text_width = message.size() * pitch;
  const int left = (width - text_width) / 2, top = width / 2 - 14;
  for (int row = 0; row < rows; ++row) {
    const int offset = y + row - top;
    if (offset < -10 || offset >= 7 * scale + 10) continue;
    auto *line = target + row * width + left;
    std::fill_n(line - 8, text_width + 16, 0);
    if (offset < 0 || offset >= 7 * scale) continue;
    for (size_t i = 0; i < message.size(); ++i) {
      const auto glyph = std::find_if(std::begin(glyphs), std::end(glyphs),
        [letter = message[i]](const Glyph &entry) { return entry.letter == letter; });
      if (glyph == std::end(glyphs)) continue;
      const auto mask = glyph->mask[offset / scale];
      for (int col = 0; col < 5; ++col)
        if (mask & (16 >> col)) std::fill_n(line + i * pitch + col * scale, scale, UINT16_MAX);
    }
  }
}
#endif

#if VP8_SLEEP_WAKE
// The display worker owns these during playback. Between clips the caller joins that worker.
int panel_appearance = vp8_daily::AppearanceRamp::awake;
int displayed_sleep_side = vp8_daily::SleepScale::native_side;
vp8_daily::SleepScale sleep_scale;

bool set_panel_appearance(int level) {
  using vp8_daily::AppearanceRamp;
  const auto brightness = AppearanceRamp::brightness(level, round_display_normal_brightness);
  if (brightness != AppearanceRamp::brightness(panel_appearance, round_display_normal_brightness) &&
      round_display_brightness(brightness) != ESP_OK) return false;
  panel_appearance = level;
  return true;
}
#endif

bool present(unsigned side, const uint16_t *pixels
#if VP8_FOCUS_MENU
             , bool desktop = false
#endif
             ) {
  const int base = (466 - side) / 2;
  const int x = base & ~1, width = side + 2 * (base - x);
#if VP8_SLEEP_WAKE
  using vp8_daily::SleepScale;
  const int visible = side == SleepScale::native_side ? SleepScale::side_for(panel_appearance) : int(side);
  if (visible != int(side)) sleep_scale.prepare(visible);
#endif
#if VP8_PIPELINE
  // Same panel gap as round_display; 0x3C resumes the same window on CO5300.
  const auto window = [](uint32_t cmd, int low, int end) {
    const uint8_t address[]{uint8_t(low >> 8), uint8_t(low), uint8_t((end - 1) >> 8), uint8_t(end - 1)};
    return esp_lcd_panel_io_tx_param(raw_io, 0x02000000 | (cmd << 8), address, sizeof(address)) == ESP_OK;
  };
  if (!window(0x2a, x + 6, x + 6 + width) || !window(0x2b, x, x + width)) return false;
  unsigned index = 0;
  bool pending = false;
  bool ok = true;
  const auto wait = [] { return xSemaphoreTake(dma_done, pdMS_TO_TICKS(1000)) == pdTRUE; };
#endif
#if VP8_BOOT_PAIRING
  const auto prompt = side == visual_side ? vp8_ota::pairing_prompt() : 0;
#endif
#if VP8_FOCUS_MENU
  const bool overlays = desktop && side == vp8_daily::focus_canvas && !prompt;
  if (overlays)
    desktop_arc->update(vp8_ota::desktop_status(), desktop_focus_seconds.load(std::memory_order_relaxed));
#endif
  for (int y = 0; y < width; y += strip) {
    const int rows = std::min(int(strip), width - y);
#if VP8_PIPELINE
    auto *out = index++ % 2 ? stripe_extra : stripe;
#if VP8_SLEEP_WAKE
    if (visible != int(side)) {
      for (int row = 0; row < rows; ++row)
        sleep_scale.row(out + row * width, pixels, width, base - x, y + row);
    } else
#endif
      fill_stripe(out, pixels, side, width, base - x, y, rows);
#if VP8_BOOT_PAIRING
    if (prompt) overlay_boot_prompt(out, width, y, rows);
#endif
#if VP8_FOCUS_MENU
    if (overlays) {
      const int border = base - x;
      desktop_arc->draw(out + border, width, y - border, rows);
    }
#endif
    // Prepare the next stripe during DMA, but wait before taking the SPI lock.
    if (pending && !wait()) return false;
    pending = false;
    const int command = y == 0 ? 0x32002c00 : 0x32003c00;
    if (esp_lcd_panel_io_tx_color(raw_io, command, out, size_t(rows) * width * 2) != ESP_OK) {
      ok = false;
      break;
    }
    pending = true;
#else
    fill_stripe(stripe, pixels, side, width, base - x, y, rows);
    if (!push(x, x + y, width, rows)) return false;
#endif
  }
#if VP8_PIPELINE
  const bool displayed = (!pending || wait()) && ok;
#if VP8_SLEEP_WAKE
  if (displayed && side == SleepScale::native_side && visible != displayed_sleep_side) {
    displayed_sleep_side = visible;
    if (visible == SleepScale::dim_side || visible == SleepScale::native_side)
      printf("@VP8_SLEEP SIZE side=%d origin=%d\n", visible, (466 - visible) / 2);
  }
#endif
#if VP8_BOOT_PAIRING
  if (displayed && prompt) vp8_ota::pairing_prompt_drawn(prompt);
#endif
  return displayed;
#else
  return true;
#endif
}

#if VP8_FOCUS_MENU
void show_focus_menu(vp8_daily::FocusTimer &timer, vp8_daily::FocusPage page) {
  using namespace vp8_daily;
  touch_gesture = {};
  wake_contact = {};
  desktop_focus_touch = {};
  wait_for_pet_release = true;
  if (!set_panel_appearance(AppearanceRamp::awake)) {
    puts("@VP8_MENU BRIGHTNESS_FAILED");
    return;
  }
  FocusCanvas screen{rgb};
  FocusTouch touch;
  bool redraw = true;
  int previous_seconds = -1;
  std::optional<bool> previous_online;
  for (;;) {
    const auto now = esp_timer_get_time();
    if (timer.expired(now) || vp8_ota::pairing_prompt()) break;
    if (vp8_ota::take_menu_key()) {
      if (page == FocusPage::launcher) break;
      page = FocusPage::launcher;
      touch = {};
      redraw = true;
      puts("@VP8_MENU LAUNCHER");
    }
    const auto sample = round_touch_read();
#if VP8_SENSOR_QUERY
    vp8_ota::observe_touch(sample.valid, sample.pressed, sample.x, sample.y, now);
#endif
    std::optional<bool> online;
#if VP8_DESKTOP_INTERNET
    online = vp8_ota::menu_network_online();
#endif
    const auto selected = touch.observe(page, sample.valid, sample.pressed, sample.x, sample.y, online.has_value());
#if VP8_DESKTOP_INTERNET
    if (selected == FocusControl::network) vp8_ota::toggle_menu_network();
#endif
    if (selected == FocusControl::pet) {
      wait_for_pet_release = false;
      break;
    }
    if (selected == FocusControl::focus) {
      page = FocusPage::timer;
      redraw = true;
      puts("@VP8_MENU FOCUS");
    }
    if (selected == FocusControl::timer_button) {
      if (timer.active()) {
        timer.cancel();
        puts("@VP8_FOCUS CANCEL");
      } else {
        timer.start(now);
        puts("@VP8_FOCUS START seconds=1500");
      }
      break;
    }
    const auto seconds = timer.remaining(now);
    if (redraw || (page == FocusPage::timer && seconds != previous_seconds) ||
        (page == FocusPage::launcher && online != previous_online)) {
      screen.draw(page, seconds, timer.active(), online);
      if (!present(focus_canvas, rgb)) {
        puts("@VP8_MENU DISPLAY_FAILED");
        break;
      }
      previous_seconds = seconds;
      previous_online = online;
      redraw = false;
    }
    vTaskDelay(pdMS_TO_TICKS(20));
  }
}
#endif

bool pixels_match(const vpx_image_t &image, unsigned side, const char *expected) {
  pet::Sha256 hash;
  for (unsigned p = 0; p < 3; ++p) {
    const unsigned width = p ? side / 2 : side;
    for (unsigned y = 0; y < width; ++y) hash.update(image.planes[p] + y * image.stride[p], width);
  }
  uint8_t digest[32];
  hash.finish(digest);
  char hex[65];
  for (unsigned i = 0; i < 32; ++i) std::snprintf(hex + 2 * i, 3, "%02x", digest[i]);
  return !std::strcmp(hex, expected);
}

void convert(const vpx_image_t &image, unsigned side, uint16_t *output) {
#if VP8_PIPELINE
  if (image.stride[1] == image.stride[2] && image.stride[0] % 16 == 0 && image.stride[1] % 8 == 0 &&
      reinterpret_cast<uintptr_t>(image.planes[0]) % 16 == 0 &&
      reinterpret_cast<uintptr_t>(image.planes[1]) % 8 == 0 && reinterpret_cast<uintptr_t>(image.planes[2]) % 8 == 0) {
    muse_yuv_1x(image.planes[0], image.planes[1], image.planes[2], image.stride[0], image.stride[1],
      side, side, reinterpret_cast<uint8_t *>(output), side * 2);
    return;
  }
  puts("@VP8_SIMD_FALLBACK");
#endif
  const auto clamp = [](int v) { return std::clamp(v, 0, 255); };
  for (unsigned y = 0; y < side; ++y) {
    const auto *luma = image.planes[0] + y * image.stride[0];
    const auto *u = image.planes[1] + (y / 2) * image.stride[1];
    const auto *v = image.planes[2] + (y / 2) * image.stride[2];
    auto *out = output + y * side;
    for (unsigned x = 0; x < side; x += 2) {
      const int d = int(u[x / 2]) - 128, e = int(v[x / 2]) - 128;
      const int r = 409 * e + 128, g = -100 * d - 208 * e + 128, b = 516 * d + 128;
      for (unsigned i = 0; i < 2; ++i) {
        const int c = 298 * (int(luma[x + i]) - 16);
        const uint16_t color = uint16_t((clamp((c + r) >> 8) >> 3) << 11 |
          (clamp((c + g) >> 8) >> 2) << 5 | (clamp((c + b) >> 8) >> 3));
        out[x + i] = __builtin_bswap16(color);
      }
    }
  }
}

#if VP8_VISUAL_PROBE
vpx_image_t staged_image(Buffer data) {
  vpx_image_t image{};
  const unsigned luma_bytes = visual_side * visual_side;
  image.planes[0] = data;
  image.planes[1] = data + luma_bytes;
  image.planes[2] = data + luma_bytes + luma_bytes / 4;
  image.stride[0] = visual_side;
  image.stride[1] = image.stride[2] = visual_side / 2;
  return image;
}

vpx_image_t stage_i420(const vpx_image_t &source, Buffer target) {
  auto staged = staged_image(target);
  for (int p = 0; p < 3; ++p) {
    const int width = staged.stride[p];
    for (int row = 0; row < width; ++row)
      std::memcpy(staged.planes[p] + row * width, source.planes[p] + row * source.stride[p], width);
  }
  return staged;
}
#endif

struct FrameResult {
  const Sample &sample;
  unsigned fps;
  int64_t from, first = 0, last = 0;
  unsigned shown = 0, late = 0;
  size_t internal_largest = SIZE_MAX, psram_largest = SIZE_MAX;
#if VP8_VPC1_USB_PROBE || VP8_VPC1_LAN
  std::optional<vp8_control::Ticket> control_ticket{};
#endif
#if VP8_FOCUS_MENU
  bool desktop = false;
#endif
#if VP8_SLEEP_WAKE
  vp8_ota::WakeTiming wake_timing{};
  vp8_daily::AppearanceRamp appearance{};
  unsigned wake_fade_steps{};
#if VP8_LIFT_WAKE
  bool sleep_loop{};
#endif

  void step_appearance() {
    const auto at = esp_timer_get_time();
    const int level = appearance.next(at);
    if (level < 0) return;
    const bool sent = set_panel_appearance(level);
    const auto completed = esp_timer_get_time();
    appearance.sent(at, level, sent);
    if (!sent) {
      printf("@VP8_SLEEP BRIGHTNESS_FAILED step=%d\n", level);
      return;
    }
    if (wake_timing.detected_us >= 0 && !wake_fade_steps++) wake_timing.brightness_us = completed;
    if (appearance.pending()) return;
    printf("@VP8_SLEEP BRIGHTNESS level=%u\n",
        vp8_daily::AppearanceRamp::brightness(level, round_display_normal_brightness));
    if (wake_timing.detected_us >= 0) {
      printf("@VP8_SLEEP WAKE_FADE first_us=%lld full_us=%lld span_us=%lld steps=%u\n",
          wake_timing.brightness_us - wake_timing.detected_us, completed - wake_timing.detected_us,
          completed - appearance.started_at(), wake_fade_steps);
    }
  }
#endif
  void measure() {
    internal_largest = std::min(internal_largest, heap_caps_get_largest_free_block(MALLOC_CAP_INTERNAL | MALLOC_CAP_8BIT));
    psram_largest = std::min(psram_largest, heap_caps_get_largest_free_block(MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT));
  }
  bool display(const uint16_t *pixels
#if VP8_FAST_TOUCH
               , vp8_daily::FrameGate &gate
#endif
               ) {
#if VP8_FAST_TOUCH
    if (gate.cancelled()) return true;
#endif
#if VP8_PIPELINE
    if (shown) {
      const auto previous_cost = metrics[2 * max_samples + shown - 1];
      const auto target = first + int64_t(shown) * 1000000 / fps - previous_cost;
      auto remaining = target - esp_timer_get_time();
      while (remaining > 1500) {
#if VP8_FAST_TOUCH
        if (gate.cancelled()) return true;
#endif
        vTaskDelay(1);
        remaining = target - esp_timer_get_time();
      }
      if (remaining > 0) esp_rom_delay_us(unsigned(remaining));
    }
#else
    if (shown) {
      const auto target = first + int64_t(shown) * 1000000 / fps;
      while (esp_timer_get_time() < target - 1000) vTaskDelay(1);
    }
#endif
#if VP8_VPC1_USB_PROBE || VP8_VPC1_LAN
    if (!shown && control_ticket && !vp8_ota::control_can_submit(*control_ticket)) {
      gate.cancel();
      return true;
    }
#endif
#if VP8_FAST_TOUCH
    if (!gate.begin()) return true;
#endif
#if VP8_SLEEP_WAKE
    if (appearance.pending()) step_appearance();
#endif
    const auto submitted = esp_timer_get_time();
    const bool presented = present(sample.side, pixels
#if VP8_FOCUS_MENU
                                   , desktop
#endif
                                   );
#if VP8_FAST_TOUCH
    gate.end();
#endif
    if (!presented) return false;
#if VP8_LIFT_WAKE
    if (sleep_loop && panel_appearance == vp8_daily::AppearanceRamp::dim) vp8_ota::arm_lift_wake();
#endif
    const auto ended = esp_timer_get_time();
    if (!shown) {
      first = ended;
#if VP8_VPC1_USB_PROBE || VP8_VPC1_LAN
      if (control_ticket && !gate.cancelled()) vp8_ota::control_first_dma(*control_ticket);
#endif
#if VP8_SLEEP_WAKE
      if (wake_timing.detected_us >= 0) {
        const auto touch = wake_timing.detected_us;
        const auto brightness = wake_timing.brightness_us < 0 ? -1 : wake_timing.brightness_us - touch;
        printf("@VP8_SLEEP WAKE_TIMING brightness_us=%lld clip_us=%lld dma_us=%lld poll_gap_us=%lld\n",
            brightness, from - touch, ended - touch, wake_timing.poll_gap_us);
      }
#endif
      printf("@VP8_FIRST %s local_us=%lld boot_to_dma_us=%lld\n", sample.name, ended - from, ended - started);
    } else {
      metrics[3 * max_samples + shown - 1] = ended - last;
      if (ended - last > 1000000 / fps + 1001) ++late;
    }
    last = ended;
    metrics[2 * max_samples + shown++] = ended - submitted;
    if (shown % 24 == 1) measure();
    return true;
  }
  bool complete() const { return last - first >= 60000000; }
};

#if VP8_PIPELINE
struct Pipeline {
  FrameResult &result;
  QueueHandle_t free = xQueueCreate(buffer_count, sizeof(Buffer));
  QueueHandle_t ready = xQueueCreate(buffer_count, sizeof(Buffer));
  SemaphoreHandle_t done = xSemaphoreCreateBinary();
#if VP8_VISUAL_PROBE
  SemaphoreHandle_t primed = xSemaphoreCreateBinary();
#endif
  std::atomic<bool> stop{false};
#if VP8_FAST_TOUCH
  vp8_daily::FrameGate gate{};
#endif
  bool ok = true;
  bool running = false;
  bool begin() {
    if (!free || !ready || !done) return false;
#if VP8_VISUAL_PROBE
    if (!primed) return false;
    for (const auto &slot : yuv_slots) xQueueSend(free, &slot, 0);
#else
    xQueueSend(free, &rgb, 0);
    xQueueSend(free, &rgb_extra, 0);
#if VP8_RATE_PROBE
    xQueueSend(free, &rgb_lookahead, 0);
#endif
#endif
    running = xTaskCreatePinnedToCore(worker, "vp8_display", 4608, this, 5, nullptr, 1) == pdPASS;
    return running;
  }
  template<class Receive>
  bool wait_for_frame(Receive receive) {
#if VP8_SLEEP_WAKE
    // Start brightening while decoding the first wake frame. Dimming starts with sleep playback.
    while (result.appearance.pending() && result.wake_timing.detected_us >= 0 && !gate.cancelled()) {
      result.step_appearance();
      if (receive(pdMS_TO_TICKS(vp8_daily::AppearanceRamp::interval_us / 1000))) return true;
    }
#endif
    return receive(portMAX_DELAY);
  }
  static void worker(void *arg) {
    auto &self = *static_cast<Pipeline *>(arg);
    Buffer buffer;
#if VP8_VISUAL_PROBE
    self.wait_for_frame([&](auto ticks) { return xSemaphoreTake(self.primed, ticks) == pdTRUE; });
#endif
    while (self.wait_for_frame([&](auto ticks) { return xQueueReceive(self.ready, &buffer, ticks) == pdTRUE; }) && buffer) {
#if VP8_FAST_TOUCH
      if (self.gate.cancelled()) {
        xQueueSend(self.free, &buffer, portMAX_DELAY);
        continue;
      }
#endif
      if (self.ok && !self.result.complete()) {
#if VP8_VISUAL_PROBE
        const auto from = esp_timer_get_time();
        convert(staged_image(buffer), visual_side, rgb);
        metrics[max_samples + self.result.shown] = esp_timer_get_time() - from;
        // Conversion consumed the I420 plane; release it while RGB DMA proceeds.
        xQueueSend(self.free, &buffer, portMAX_DELAY);
        buffer = nullptr;
#if VP8_FAST_TOUCH
        self.ok = self.result.display(rgb, self.gate);
#else
        self.ok = self.result.display(rgb);
#endif
#else
        self.ok = self.result.display(buffer);
#endif
      }
      if (!self.ok || self.result.complete()) self.stop.store(true);
      if (buffer) xQueueSend(self.free, &buffer, portMAX_DELAY);
    }
    xSemaphoreGive(self.done);
    vTaskDelete(nullptr);
  }
  void finish() {
    if (!running) return;
#if VP8_VISUAL_PROBE
    xSemaphoreGive(primed);
#endif
    Buffer end = nullptr;
    xQueueSend(ready, &end, portMAX_DELAY);
    xSemaphoreTake(done, portMAX_DELAY);
    running = false;
  }
  ~Pipeline() {
    finish();
#if VP8_VISUAL_PROBE
    if (primed) vSemaphoreDelete(primed);
#endif
    if (done) vSemaphoreDelete(done);
    if (ready) vQueueDelete(ready);
    if (free) vQueueDelete(free);
  }
};
#endif

bool run(const Sample &sample, bool check, unsigned fps = 24, bool *paced = nullptr
#if VP8_RETAINED
         , unsigned daily_index = vp8_daily::idle, bool automatic_idle = false
#endif
         ) {
#if VP8_SLEEP_WAKE
  using vp8_daily::AppearanceRamp;
  if (!check && daily_index != vp8_daily::sleep_loop_index && daily_index != vp8_daily::sleep_end_index &&
      !set_panel_appearance(AppearanceRamp::awake) && !set_panel_appearance(AppearanceRamp::awake)) {
    puts("@VP8_SLEEP BRIGHTNESS_RESTORE_FAILED");
  }
#endif
#if VP8_OTA
  if (sample.end - sample.start < 32) return false;
  const unsigned frames = vp8_cache::load32(sample.start + 24);
  if (frames < 2 || frames > max_samples) return false;
#endif
  FrameResult result{sample, fps, esp_timer_get_time()};
#if VP8_VPC1_USB_PROBE || VP8_VPC1_LAN
  if (!check) result.control_ticket = vp8_ota::control_ticket();
#endif
#if VP8_FOCUS_MENU
  result.desktop = !vp8_daily::sleeping(daily_index);
#endif
#if VP8_SLEEP_WAKE
  if (daily_index == vp8_daily::sleep_loop_index) {
    result.appearance.arm(panel_appearance, AppearanceRamp::dim);
#if VP8_LIFT_WAKE
    result.sleep_loop = true;
#endif
  } else if (daily_index == vp8_daily::sleep_end_index) {
    result.wake_timing = vp8_ota::take_wake_timing();
    result.appearance.arm(panel_appearance, AppearanceRamp::awake);
  }
#endif
  Decoder decoder;
  if (!decoder.init(sample.side)) return false;
  printf("@VP8_BEGIN %s check=%u target_fps=%u\n", sample.name, check, fps);
  const auto *at = sample.start + 32;
#if VP8_PIPELINE
  Pipeline pipe{result};
  if (!check && !pipe.begin()) return false;
#endif
  unsigned prepared = 0;
#if VP8_OTA
  const unsigned limit = vp8_ota::checking() ? std::min(frames, 8u) : frames;
#elif VP8_RETAINED
  const unsigned limit = frames;
#else
  const unsigned limit = max_samples;
#endif
  while (prepared < limit) {
#if VP8_RETAINED
    if (!check) {
      poll_daily_input(daily_index, automatic_idle);
#if VP8_FAST_TOUCH
      if (daily_input != vp8_daily::Input::none
#if VP8_VPC1_USB_PROBE || VP8_VPC1_LAN
          || (result.control_ticket && pipe.gate.cancelled())
#endif
          ) { pipe.gate.cancel(); break; }
#else
      if (daily_input != vp8_daily::Input::none && prepared >= 2) break;
#endif
    }
#endif
#if VP8_VISUAL_PROBE
    if (sample.side != visual_side) return false;
    Buffer target = yuv_slots[0];
#else
    uint16_t *target = rgb;
#endif
#if VP8_PIPELINE
    if (!check) {
      if (pipe.stop.load()) break;
      xQueueReceive(pipe.free, &target, portMAX_DELAY);
      if (pipe.stop.load()) break;
    }
#endif
    const unsigned ordinal = prepared % frames;
    if (!ordinal) at = sample.start + 32;
    if (sample.end - at < 12) return false;
    const size_t size = size_t(at[0]) | size_t(at[1]) << 8 | size_t(at[2]) << 16 | size_t(at[3]) << 24;
    at += 12;
    if (size > 22000 || size > size_t(sample.end - at)) return false;
    const auto decode = esp_timer_get_time();
    std::memcpy(packet, at, size);
    if (vpx_codec_decode(&decoder.ctx, packet, unsigned(size), nullptr, 0) != VPX_CODEC_OK) {
      const auto detail = vpx_codec_error_detail(&decoder.ctx);
      printf("@VP8_DECODE_ERROR %s frame=%u reason=%s detail=%s\n", sample.name, ordinal,
             vpx_codec_error(&decoder.ctx), detail ? detail : "none");
      return false;
    }
    at += size;
    vpx_codec_iter_t iter = nullptr;
    const auto *image = vpx_codec_get_frame(&decoder.ctx, &iter);
    const auto decoded = esp_timer_get_time();
    if (!image || image->fmt != VPX_IMG_FMT_I420 || image->d_w != sample.side || image->d_h != sample.side ||
        vpx_codec_get_frame(&decoder.ctx, &iter)) return false;
    if (check) {
#if VP8_VISUAL_PROBE
      const auto staged = stage_i420(*image, target);
      if (!pixels_match(staged, sample.side, sample.hash[ordinal])) {
#else
      if (!pixels_match(*image, sample.side, sample.hash[ordinal])) {
#endif
        printf("@VP8_BAD_HASH %s %u\n", sample.name, ordinal);
        return false;
      }
      if (++prepared == frames) break;
#if VP9_REFERENCE_PROBE
      vTaskDelay(1);
#else
      if (prepared % 16 == 0) vTaskDelay(1);
#endif
      continue;
    }
    metrics[prepared] = decoded - decode;
#if VP8_VISUAL_PROBE
    stage_i420(*image, target);
    metrics[4 * max_samples + prepared++] = esp_timer_get_time() - decoded;
#else
    convert(*image, sample.side, target);
    metrics[max_samples + prepared++] = esp_timer_get_time() - decoded;
#endif
#if VP8_PIPELINE
    xQueueSend(pipe.ready, &target, portMAX_DELAY);
#if VP8_VISUAL_PROBE
    if (prepared == 2) xSemaphoreGive(pipe.primed);
#endif
#if VP8_RATE_PROBE || VP8_VISUAL_PROBE
    // CPU0's idle task and system work must run even when decode is the limiting stage.
    vTaskDelay(1);
#endif
#else
    if (!result.display(target)) return false;
    if (result.complete()) break;
#endif
  }
  if (check) {
    printf("@VP8_I420 %s verified=%u\n", sample.name, prepared);
#if VP9_REFERENCE_PROBE
    printf("@VP8_STACK %s check=1 main_min=%u\n", sample.name, unsigned(uxTaskGetStackHighWaterMark(nullptr)));
#endif
    return prepared == frames;
  }
#if VP8_PIPELINE
  pipe.finish();
  if (!pipe.ok) return false;
#endif
#if VP8_RETAINED
#if VP8_FAST_TOUCH
  if (pipe.gate.cancelled()) {
    printf("@VP8_DAILY CANCEL clip=%s displayed=%u discarded=%u\n", sample.name, result.shown, prepared - result.shown);
    if (result.shown < 2) return true;
  } else
#endif
  if (result.shown < 2 || result.shown != prepared) return false;
  printf("@VP8_DAILY END clip=%s eof=%u\n", sample.name, unsigned(result.shown == frames));
#else
  if (!result.complete()) return false;
#endif
  result.measure();
  const unsigned shown = result.shown;
#if VP9_REFERENCE_PROBE
  printf("@VP8_STACK %s check=0 main_min=%u\n", sample.name, unsigned(uxTaskGetStackHighWaterMark(nullptr)));
#endif
  if (paced) *paced = result.late * 20 <= shown - 1 &&
      (shown - 1) * 1000000LL >= (result.last - result.first) * fps - 1000000LL;
  printf("@VP8_RESULT %s frames=%u span_us=%lld late=%u dropped=0 internal_min=%zu psram_min=%zu internal_block=%zu psram_block=%zu\n",
    sample.name, shown, result.last - result.first, result.late, heap_caps_get_minimum_free_size(MALLOC_CAP_INTERNAL | MALLOC_CAP_8BIT),
    heap_caps_get_minimum_free_size(MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT), result.internal_largest, result.psram_largest);
  const char *names[]{"decode", "convert", "dma", "gap", "i420_copy"};
  for (unsigned i = 0; i < stage_count; ++i) {
    auto *values = metrics + i * max_samples;
    const unsigned count = shown - (i == 3);
    std::sort(values, values + count);
    printf("@VP8_STATS %s %s p95_us=%lu max_us=%lu\n", sample.name, names[i],
      (unsigned long)values[(95 * count + 99) / 100 - 1], (unsigned long)values[count - 1]);
  }
  return true;
}
}

extern "C" void app_main() {
#if VP8_OTA
  if (!vp8_ota::begin_boot()) return;
#endif
  started = esp_timer_get_time();
  esp_lcd_panel_io_handle_t io = nullptr;
  ESP_ERROR_CHECK(round_display_probe_init(&io, &panel));
#if VP8_PIPELINE
  raw_io = io;
  dma_done = xSemaphoreCreateCounting(2, 0);
  stripe_extra = static_cast<uint16_t *>(heap_caps_malloc(466 * strip * 2, MALLOC_CAP_DMA | MALLOC_CAP_INTERNAL));
  if (!stripe_extra || !dma_done) { puts("@VP8_NO_MEMORY"); return; }
#if VP8_VISUAL_PROBE
  for (auto &slot : yuv_slots) {
    slot = static_cast<Buffer>(heap_caps_aligned_alloc(16, i420_bytes, MALLOC_CAP_SPIRAM));
    if (!slot) { puts("@VP8_NO_MEMORY"); return; }
  }
#else
  rgb_extra = static_cast<uint16_t *>(heap_caps_aligned_alloc(16, visual_side * visual_side * sizeof(uint16_t), MALLOC_CAP_SPIRAM));
  if (!rgb_extra) { puts("@VP8_NO_MEMORY"); return; }
#endif
#if VP8_RATE_PROBE
  rgb_lookahead = static_cast<uint16_t *>(heap_caps_aligned_alloc(16, visual_side * visual_side * sizeof(uint16_t), MALLOC_CAP_SPIRAM));
  if (!rgb_lookahead) { puts("@VP8_NO_MEMORY"); return; }
#endif
#else
  dma_done = xSemaphoreCreateBinary();
#endif
  rgb = static_cast<uint16_t *>(heap_caps_aligned_alloc(16, visual_side * visual_side * sizeof(uint16_t), MALLOC_CAP_SPIRAM));
  stripe = static_cast<uint16_t *>(heap_caps_malloc(466 * strip * 2, MALLOC_CAP_DMA | MALLOC_CAP_INTERNAL));
  packet = static_cast<uint8_t *>(heap_caps_aligned_alloc(16, 22000, MALLOC_CAP_SPIRAM));
  metrics = static_cast<uint32_t *>(heap_caps_malloc(stage_count * max_samples * sizeof(uint32_t), MALLOC_CAP_SPIRAM));
  if (!dma_done || !rgb || !stripe || !packet || !metrics) { puts("@VP8_NO_MEMORY"); return; }
#if VP8_FOCUS_MENU
  auto *arc_memory = heap_caps_malloc(sizeof(vp8_daily::DesktopArc), MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
  if (!arc_memory) { puts("@VP8_NO_MEMORY desktop_arc"); return; }
  desktop_arc = new (arc_memory) vp8_daily::DesktopArc;
#endif
  esp_lcd_panel_io_callbacks_t callbacks{};
  callbacks.on_color_trans_done = done;
  ESP_ERROR_CHECK(esp_lcd_panel_io_register_event_callbacks(io, &callbacks, nullptr));
  if (!blank()) { puts("@VP8_BLANK_ERROR"); return; }
  ESP_ERROR_CHECK(round_display_backlight(true));
#if VP8_FLASH_PROBE
#if VP8_RETAINED
  const auto touch_result = round_touch_init();
  if (touch_result != ESP_OK) { printf("@VP8_ERROR touch_init error=%ld\n", long(touch_result)); return; }
#if VP8_OTA
  const auto play = vp8_ota::run;
#else
  const auto play = vp8_cache::run_from_flash;
#endif
  if (!play([](unsigned index, vp8_cache::Clip data, bool verify
#if VP8_OTA
              , bool automatic_idle
#endif
              ) {
    static constexpr const char *names[]{"0-400", "4-400", "1-400", "11-400"};
#if VP8_OTA
    // The retained cache verifies the object SHA. Reference I420 hashes belong to the probe.
    if (verify) return false;
    const char (*expected_hashes)[65] = nullptr;
#else
    static constexpr const char (*hashes[])[65]{hash_0_400, hash_4_400, hash_1_400, hash_11_400};
    const auto *expected_hashes = index < std::size(hashes) ? hashes[index] : nullptr;
#endif
    const char *name = index < std::size(names) ? names[index] : "extra-400";
#if VP8_SLEEP_WAKE
    static constexpr const char *sleep_names[]{"78-400", "79-400", "80-400"};
    if (index >= vp8_daily::sleep_start_index && index <= vp8_daily::sleep_end_index)
      name = sleep_names[index - vp8_daily::sleep_start_index];
#endif
    const Sample clip{name, data.data(),
                      data.data() + data.size(), visual_side, expected_hashes};
    return run(clip, verify, 24, nullptr, index
#if VP8_OTA
               , automatic_idle
#endif
               );
  }, [] {
    const auto requested = daily_input;
    daily_input = vp8_daily::Input::none;
#if VP8_OTA
    return requested;
#else
    return requested == vp8_daily::Input::wave;
#endif
  }
#if VP8_FOCUS_MENU
  , show_focus_menu
#endif
  )) {
    puts("@VP8_ERROR cache");
#if VP8_OTA
    vp8_ota::fail_boot();
#endif
    return;
  }
#else
  if (!vp8_cache::run_from_flash([](unsigned index, vp8_cache::Clip data, bool verify) {
    const Sample clip{index ? "67-400" : "0-400", data.data(), data.data() + data.size(), visual_side,
                      index ? hash_67_400 : hash_0_400};
    return run(clip, verify);
  })) { puts("@VP8_ERROR cache"); return; }
#endif
#else
  const Sample samples[]{
#if !VP9_REFERENCE_PROBE
    {"0-232", idle232_start, idle232_end, 232, hash_0_232},
#endif
    {"0-400", idle400_start, idle400_end, visual_side, hash_0_400},
    {"67-400", action400_start, action400_end, visual_side, hash_67_400},
  };
#if VP8_VISUAL_PROBE
  for (const auto &sample : samples) {
    if (sample.side != visual_side) continue;
    if (!run(sample, true)) { printf("@VP8_ERROR %s\n", sample.name); return; }
  }
  for (const auto &sample : samples) {
    if (sample.side != visual_side) continue;
    if (!run(sample, false)) { printf("@VP8_ERROR %s\n", sample.name); return; }
  }
#elif VP8_RATE_PROBE
  for (const auto &sample : samples) {
    if (sample.side != visual_side) continue;
    bool paced = false;
    if (!blank() || !run(sample, true) || !run(sample, false, 20, &paced) ||
        (!paced && !run(sample, false, 18, &paced))) {
      printf("@VP8_ERROR %s\n", sample.name);
      return;
    }
    printf("@VP8_RATE_GATE %s paced=%u\n", sample.name, paced);
  }
#else
  for (const auto &sample : samples) {
    if (!blank() || !run(sample, true) || !run(sample, false)) {
      printf("@VP8_ERROR %s\n", sample.name);
      return;
    }
  }
#endif
#endif
  puts("@VP8_DONE");
}

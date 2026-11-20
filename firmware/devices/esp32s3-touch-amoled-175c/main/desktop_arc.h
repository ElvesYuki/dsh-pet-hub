#pragma once

#include "focus_menu_ui.h"

namespace vp8_daily {
// Local to the native 400px canvas. The DMA stripe adds the physical (33,33) offset.
class DesktopArc {
 public:
  DesktopArc() {
    for (int i = 0; i < progress_width; ++i) {
      const int x = i - progress_width / 2;
      progress_[i] = int(std::lround(std::sqrt(float(progress_radius * progress_radius - x * x))));
    }
    compose_top();
  }

  void update(DesktopStatus status, int remaining) {
    if (status != status_) {
      status_ = status;
      compose_top();
    }
    if (remaining == remaining_) return;
    remaining_ = remaining;
    bottom_.count = 0;
    if (remaining > 0) {
      const auto timer = time_text(remaining / 60, remaining % 60);
      text(bottom_, {timer.data(), timer.size()}, -2 * countdown_advance, countdown_advance,
           13, FocusCanvas::mint, countdown_glyphs, countdown_scale, true);
    }
  }

  void draw(uint16_t *pixels, int stride, int first, int rows) const {
    FocusCanvas stripe{pixels, stride, first, rows};
    top_.draw(stripe);
    bottom_.draw(stripe);
    if (remaining_ <= 0 || first + rows <= progress_min_y || first > center + progress_radius + 1) return;
    constexpr int duration = FocusTimer::seconds_per_session;
    const int lit = std::min(remaining_, duration) * progress_width / duration;
    for (int i = 0; i < progress_width; ++i) {
      stripe.box({center - progress_width / 2 + i, center + progress_[i] - 1, 1, 3},
                 i < lit ? FocusCanvas::mint : FocusCanvas::track);
    }
  }

 private:
  static constexpr int center = focus_canvas / 2;
  static constexpr float radius = 182;
  static constexpr int progress_radius = 196, progress_width = 174, progress_min_y = 374;
  static constexpr int sprite_side = 24;
  static constexpr uint16_t transparent = UINT16_MAX;
  // Scale the ink vertically while keeping the same glyph advance along the arc.
  static constexpr float clock_scale = 22.f / 21, telemetry_scale = 14.f / 12, countdown_scale = 18.f / 16;

  struct Stamp {
    int x{}, y{}, h{};
    uint16_t ink{};
    // One row mask per coverage level, from 25% through 100%.
    std::array<std::array<uint64_t, 42>, 4> coverage{};

    template <typename Pixel>
    bool make(float distance, bool lower, int width, int height, float source_y, uint16_t color, Pixel pixel,
              float vertical_scale, bool four_samples) {
      const float angle = distance / radius;
      const float cosine = std::cos(angle);
      const float sine = std::sin(angle);
      const float rotation = lower ? -sine : sine;
      const float cx = center + radius * sine;
      const float cy = center + (lower ? radius : -radius) * cosine;
      const float source_x = (width - 1) * .5f;
      const float y_radius = (std::max(source_y, height - 1 - source_y) + .5f) * vertical_scale;
      const float dx = cosine * source_x + std::abs(sine) * y_radius + 1;
      const float dy = std::abs(sine) * source_x + cosine * y_radius + 1;
      x = std::max(0, int(std::ceil(cx - dx)));
      y = std::max(0, int(std::ceil(cy - dy)));
      const int right = std::min(focus_canvas - 1, int(std::floor(cx + dx)));
      h = std::min(focus_canvas - 1, int(std::floor(cy + dy))) - y + 1;
      ink = color;
      if (h > int(coverage.front().size()) || right - x >= 64) return false;

      const float inverse_y_scale = 1.f / vertical_scale;
      const auto sample = [&](float px, float py) {
        const int sx = int(std::floor(source_x + px * cosine + py * rotation + .5f));
        const int sy = int(std::floor(source_y + (py * cosine - px * rotation) * inverse_y_scale + .5f));
        return sx >= 0 && sx < width && sy >= 0 && sy < height && pixel(sx, sy);
      };
      bool any = false;
      for (int row = 0; row < h; ++row) {
        for (auto &level : coverage) level[row] = 0;
        for (int col = x; col <= right; ++col) {
          const float px = col - cx, py = y + row - cy;
          int samples = sample(px - .25f, py - .25f) + sample(px + .25f, py + .25f);
          samples += four_samples ? sample(px - .25f, py + .25f) + sample(px + .25f, py - .25f) : samples;
          if (samples) {
            coverage[samples - 1][row] |= uint64_t(1) << (col - x);
            any = true;
          }
        }
      }
      return any;
    }

    static uint16_t half(uint16_t a, uint16_t b) {
      const auto swap = [](uint16_t v) { return uint16_t(v >> 8 | v << 8); };
      // Mask off the low bit of each RGB565 channel before halving.
      a = swap(a);
      b = swap(b);
      return swap(uint16_t(((a & 0xf7de) >> 1) + ((b & 0xf7de) >> 1) + (a & b & 0x0821)));
    }

    void draw(FocusCanvas &stripe) const {
      for (int i = std::max(0, stripe.first_ - y); i < std::min(h, stripe.end_ - y); ++i) {
        auto *dest = stripe.pixels_ + (y + i - stripe.first_) * stripe.stride_ + x;
        for (uint64_t bits = coverage.back()[i]; bits; bits &= bits - 1) dest[std::countr_zero(bits)] = ink;
        for (int level = 0; level < 3; ++level) {
          for (uint64_t bits = coverage[level][i]; bits; bits &= bits - 1) {
            auto &pixel = dest[std::countr_zero(bits)];
            const auto middle = half(pixel, ink);
            pixel = level == 1 ? middle : half(middle, level == 0 ? pixel : ink);
          }
        }
      }
    }
  };

  template <size_t Capacity>
  struct Layer {
    std::array<Stamp, Capacity> stamps{};
    size_t count{};

    template <typename Pixel>
    void add(float distance, bool lower, int width, int height, float source_y, uint16_t color, Pixel pixel,
             float vertical_scale = 1, bool four_samples = false) {
      if (count < Capacity &&
          stamps[count].make(distance, lower, width, height, source_y, color, pixel, vertical_scale, four_samples))
        ++count;
    }

    void draw(FocusCanvas &stripe) const {
      for (size_t i = 0; i < count; ++i) stamps[i].draw(stripe);
    }
  };

  static std::array<char, 5> time_text(int minutes, int seconds) {
    const auto digit = [](int n) { return char('0' + n); };
    return {digit(minutes / 10), digit(minutes % 10), ':', digit(seconds / 10), digit(seconds % 10)};
  }

  template <size_t Capacity, size_t Count, size_t Height>
  static void text(Layer<Capacity> &layer, std::string_view value, float distance, int advance, float source_y,
                   uint16_t color, const uint64_t (&glyphs)[Count][Height], float vertical_scale, bool lower = false) {
    for (char ch : value) {
      const auto index = focus_digits.find(ch);
      if (index < Count) {
        layer.add(distance, lower, advance, Height, source_y, color,
                  [&](int x, int y) { return (glyphs[index][y] >> x & 1) != 0; }, vertical_scale, true);
      }
      distance += advance;
    }
  }

  void compose_top() {
    top_.count = 0;
    if (status_.minute >= 0) {
      const auto clock = time_text(status_.minute / 60, status_.minute % 60);
      text(top_, {clock.data(), clock.size()}, -2 * clock_advance, clock_advance, 15,
           FocusCanvas::white, clock_glyphs, clock_scale);
    } else {
      for (int cell : {-2, -1, 1, 2}) {
        top_.add(cell * clock_advance, false, clock_advance, 32, 15, FocusCanvas::soft,
                 [](int x, int y) { return x >= 5 && x < 17 && y >= 14 && y < 17; }, clock_scale, true);
      }
      text(top_, ":", 0, clock_advance, 15, FocusCanvas::soft, clock_glyphs, clock_scale);
    }
    if (status_.weather != Weather::none) {
      icon(-145, sprite_side, 11.5f, [&](FocusCanvas &canvas) { canvas.weather_icon(status_.weather, 11, 12); },
           std::array{FocusCanvas::soft, FocusCanvas::amber, FocusCanvas::mint, FocusCanvas::white});
      integer(std::clamp(status_.celsius, -90, 60), '~', -125, false);
    } else {
      text(top_, "--~", -125, telemetry_advance, 7, FocusCanvas::soft, telemetry_glyphs, telemetry_scale);
    }
    const bool online = status_.wifi == WifiLink::online;
    const bool connecting = status_.wifi == WifiLink::connecting;
    constexpr uint16_t wifi_rows[]{
      0b000011111110000, 0b001110000011100, 0b011000000000110,
      0b100001111100001, 0b000111000111000, 0b001000000000100,
      0b000000111000000, 0b000001000100000, 0b000000000000000,
      0b000000010000000, 0b000000111000000, 0b000000010000000,
    };
    top_.add(-64, false, 15, std::size(wifi_rows), 6,
             online ? FocusCanvas::mint : connecting ? FocusCanvas::amber : FocusCanvas::soft,
             [&](int x, int y) {
               const bool slash = !online && !connecting && (x == y + 1 || x == y + 2);
               return slash || ((!connecting || y >= 6) && (wifi_rows[y] >> x & 1));
             });
    if (status_.battery >= 0) {
      constexpr float battery = 86;
      const int percent = std::min(status_.battery, 100);
      icon(battery, 13, 7, [&](FocusCanvas &canvas) { canvas.battery_icon(percent); },
           std::array{FocusCanvas::soft, FocusCanvas::black});
      // The icon's last ink column is x=22. Leave six empty pixels along the arc.
      integer(percent, '%', battery + (22 - 11.5f) + 7, true);
    }
  }

  template <typename Paint, size_t Colors>
  void icon(float distance, int height, float source_y, Paint paint, const std::array<uint16_t, Colors> &colors) {
    std::array<uint16_t, sprite_side * sprite_side> pixels;
    pixels.fill(transparent);
    FocusCanvas canvas{pixels.data(), sprite_side, 0, sprite_side};
    paint(canvas);
    for (auto color : colors) {
      if (std::find(pixels.begin(), pixels.end(), color) == pixels.end()) continue;
      top_.add(distance, false, sprite_side, height, source_y, color,
               [&](int x, int y) { return pixels[y * sprite_side + x] == color; });
    }
  }

  void integer(int value, char unit, float position, bool from_first_ink) {
    char chars[5];
    const auto result = std::to_chars(chars, chars + sizeof(chars) - 1, value);
    if (result.ec != std::errc{}) return;
    *result.ptr = unit;
    if (from_first_ink) {
      uint64_t ink = 0;
      for (auto row : telemetry_glyphs[focus_digits.find(chars[0])]) ink |= row;
      position += (telemetry_advance - 1) * .5f - std::countr_zero(ink);
    }
    text(top_, {chars, size_t(result.ptr + 1 - chars)}, position, telemetry_advance, 7,
         unit == '%' ? FocusCanvas::soft : FocusCanvas::white, telemetry_glyphs, telemetry_scale);
  }

  DesktopStatus status_{};
  int remaining_{};
  Layer<20> top_;
  Layer<5> bottom_;
  std::array<uint8_t, progress_width> progress_;
};
} // namespace vp8_daily

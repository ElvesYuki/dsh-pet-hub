#pragma once

#include "desktop_status.h"
#include "focus_menu.h"
#include "focus_labels.inc"
#include "focus_numbers.inc"

#include <algorithm>
#include <array>
#include <bit>
#include <charconv>
#include <cmath>
#include <optional>
#include <string_view>

namespace vp8_daily {
constexpr uint16_t focus_rgb565(unsigned r, unsigned g, unsigned b) {
  const auto rgb = uint16_t((r >> 3) << 11 | (g >> 2) << 5 | (b >> 3));
  return uint16_t(rgb >> 8 | rgb << 8);
}

class FocusCanvas {
 public:
  explicit FocusCanvas(uint16_t *pixels, int stride = focus_canvas, int first = 0, int rows = focus_canvas)
      : pixels_(pixels), stride_(stride), first_(first), end_(first + rows) {}

  void draw(FocusPage page, int remaining, bool running, std::optional<bool> online = std::nullopt) {
    box({0, 0, focus_canvas, focus_canvas}, black);
    if (page == FocusPage::launcher) {
      label(U"功能菜单", 200, 66, white);
      box(pet_card, card, 25);
      box(focus_card, card, 25);
      box({68, pet_card.y + 14, 43, 42}, amber_card, 15);
      box({68, focus_card.y + 14, 43, 42}, green_card, 15);
      circle(90, pet_card.y + 42, 8, amber);
      for (int i = 0; i < 4; ++i)
        circle(79 + 7 * i, pet_card.y + (i == 0 || i == 3 ? 31 : 26), 3, amber);
      clock(90, focus_card.y + 35);
      label(U"宠物桌面", 177, pet_card.y + 23, white);
      label(U"专注", 153, focus_card.y + 23, white);
      chevron(319, pet_card.y + 35);
      chevron(319, focus_card.y + 35);
      if (running) circle(296, focus_card.y + 35, 4, mint);
      if (online.has_value()) network_mode(*online);
      return;
    }

    constexpr int duration = FocusTimer::seconds_per_session;
    const int ticks = running ? std::clamp(remaining, 0, duration) * 178 / duration : 178;
    for (int tick = 0; tick < 178; ++tick) {
      constexpr double step = 3.141592653589793 / 90;
      circle(200 + int(std::sin(step * tick) * 111), 173 - int(std::cos(step * tick) * 111),
             3, tick < ticks ? mint : track);
    }
    label(U"专注", 200, 120, soft);
    time(remaining / 60, remaining % 60, 200, 159, timer_advance, white, timer_glyphs);
    box(timer_button, running ? card : green_card, 25);
    label(running ? U"取消" : U"开始", 200, timer_button.y + 14, running ? soft : mint);
  }

 private:
  friend class DesktopArc;
  static constexpr auto black = focus_rgb565(0, 0, 0);
  static constexpr auto card = focus_rgb565(20, 27, 24);
  static constexpr auto amber_card = focus_rgb565(43, 36, 26);
  static constexpr auto green_card = focus_rgb565(24, 50, 40);
  static constexpr auto white = focus_rgb565(239, 245, 239);
  static constexpr auto soft = focus_rgb565(167, 185, 178);
  static constexpr auto amber = focus_rgb565(235, 199, 144);
  static constexpr auto mint = focus_rgb565(146, 224, 192);
  static constexpr auto track = focus_rgb565(36, 57, 49);

  void box(FocusBox area, uint16_t value, int radius = 0) {
    for (int y = std::max(area.y, first_); y < std::min(area.y + area.h, end_); ++y) {
      const int dy = std::max({area.y + radius - y, y - (area.y + area.h - 1 - radius), 0});
      int inset = 0;
      while (inset < radius && (radius - inset) * (radius - inset) + dy * dy > radius * radius) ++inset;
      auto *row = pixels_ + (y - first_) * stride_;
      std::fill_n(row + area.x + inset, std::max(0, area.w - 2 * inset), value);
    }
  }
  void circle(int cx, int cy, int radius, uint16_t value) {
    for (int y = std::max(cy - radius, first_); y <= std::min(cy + radius, end_ - 1); ++y) {
      int x = radius;
      while (x * x + (y-cy) * (y-cy) > radius * radius) --x;
      std::fill_n(pixels_ + (y - first_) * stride_ + cx - x, 2 * x + 1, value);
    }
  }
  void clock(int x, int y) {
    circle(x, y + 1, 12, mint);
    circle(x, y + 1, 10, green_card);
    box({x - 1, y - 6, 2, 9}, mint);
    box({x, y + 1, 6, 2}, mint);
    box({x - 3, y - 15, 7, 2}, mint);
  }
  void chevron(int x, int y) {
    for (int i = -6; i <= 6; ++i)
      box({x + 6 - std::abs(i), y + i, 2, 1}, soft);
  }
  void network_mode(bool online) {
    box(network_card, card, 23);
    const auto ink = online ? mint : soft;
    for (int y = -14; y <= -4; ++y) {
      for (int x = -13; x <= 13; ++x) {
        const int r = x * x + y * y;
        if (std::abs(x) <= -y && ((r >= 155 && r <= 201) || (r >= 70 && r <= 102) || (r >= 21 && r <= 36)))
          box({117 + x, 335 + y, 1, 1}, ink);
      }
    }
    circle(117, 336, 2, ink);
    label(online ? U"在线" : U"离线", 164, 317, ink);
    box({245, 315, 52, 26}, online ? green_card : track, 13);
    circle(online ? 284 : 258, 328, 9, ink);
  }
  void weather_icon(Weather weather, int x, int y) {
    if (weather == Weather::clear) {
      circle(x, y, 5, amber);
      for (const auto &p : std::array{std::array{0, -9}, std::array{0, 9}, std::array{-9, 0},
          std::array{9, 0}, std::array{-6, -6}, std::array{6, -6}, std::array{-6, 6}, std::array{6, 6}})
        circle(x + p[0], y + p[1], 1, amber);
      return;
    }
    circle(x - 4, y, 4, soft);
    circle(x + 1, y - 2, 6, soft);
    circle(x + 6, y, 4, soft);
    box({x - 5, y + 1, 13, 4}, soft);
    if (weather == Weather::rain) {
      box({x - 3, y + 7, 2, 3}, mint);
      box({x + 4, y + 7, 2, 3}, mint);
    } else if (weather == Weather::snow) {
      circle(x - 3, y + 9, 1, white);
      circle(x + 4, y + 9, 1, white);
    }
  }
  void battery_icon(int percent) {
    box({0, 2, 20, 11}, soft, 3);
    box({2, 4, 16, 7}, black, 1);
    box({3, 5, percent * 14 / 100, 5}, soft);
    box({21, 5, 2, 5}, soft);
  }
  template <size_t Count, size_t Height>
  void time(int a, int b, int x, int y, int advance, uint16_t ink, const uint64_t (&glyphs)[Count][Height]) {
    const auto digit = [](int n) { return char('0' + n); };
    const char value[]{digit(a / 10), digit(a % 10), ':', digit(b / 10), digit(b % 10)};
    digits({value, sizeof(value)}, x, y, advance, ink, glyphs);
  }
  template <size_t Count, size_t Height>
  void digits(std::string_view value, int cx, int y, int advance, uint16_t ink,
              const uint64_t (&glyphs)[Count][Height]) {
    const int first_row = std::max(0, first_ - y);
    const int end_row = std::min(int(Height), end_ - y);
    if (first_row >= end_row) return;
    int x = cx - int(value.size()) * advance / 2;
    for (const auto ch : value) {
      const auto glyph = focus_digits.find(ch);
      if (glyph < Count) {
        for (int row = first_row; row < end_row; ++row) {
          auto bits = glyphs[glyph][row];
          int column = x;
          while (bits) {
            const int skipped = std::countr_zero(bits);
            bits >>= skipped;
            column += skipped;
            const int length = std::countr_one(bits);
            auto *dest = pixels_ + (y + row - first_) * stride_;
            std::fill_n(dest + column, length, ink);
            bits >>= length;
            column += length;
          }
        }
      }
      x += advance;
    }
  }
  void label(std::u32string_view value, int cx, int y, uint16_t ink) {
    int x = cx - int(value.size()) * 24 / 2;
    for (const auto ch : value) {
      const auto index = focus_characters.find(ch);
      if (index != std::u32string_view::npos) {
        for (int row = 0; row < 24; ++row)
          for (int col = 0; col < 24; ++col)
            if (focus_labels[index][row] & (1u << (23 - col))) box({x + col, y + row, 1, 1}, ink);
      }
      x += 24;
    }
  }

  uint16_t *pixels_;
  int stride_, first_, end_;
};
} // namespace vp8_daily

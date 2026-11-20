#pragma once

#include "daily_policy.h"
#include "touch_gesture.h"

#include <algorithm>
#include <array>
#include <optional>

namespace vp8_ota {
constexpr std::array<uint16_t, 8> automatic_idle_actions{6, 13, 17, 39, 59, 62, 64, 77};

// Horizontal swipes keep the broader library in its existing order.
constexpr std::array<uint16_t, 37> swipe_actions{
  5, 6, 9, 10, 13, 14, 17, 19, 21, 24, 25, 26, 27, 28, 29, 30, 31, 32, 34,
  36, 38, 39, 44, 47, 49, 50, 51, 52, 59, 62, 63, 64, 70, 73, 74, 76, 77,
};

template<class Installed>
std::optional<uint16_t> browse_action(uint16_t from, vp8_daily::Input input, Installed installed) {
  constexpr auto size = swipe_actions.size();
  const auto next = input == vp8_daily::Input::next;
  const auto found = std::find(swipe_actions.begin(), swipe_actions.end(), from);
  const auto unselected = found == swipe_actions.end();
  const auto start = unselected ? (next ? size - 1 : 0) : std::size_t(found - swipe_actions.begin());
  const auto count = unselected ? size : size - 1;
  for (std::size_t offset = 1; offset <= count; ++offset) {
    const auto index = (start + (next ? offset : size - offset)) % size;
    const auto action = swipe_actions[index];
    if (installed(action)) return action;
  }
  return std::nullopt;
}

struct IdlePolicy {
  static constexpr unsigned choose_idle = vp8_daily::first_auto;
  unsigned idle_loops{};
  std::optional<uint16_t> previous{};

  unsigned next(unsigned current, bool touch) {
    if (touch && current != vp8_daily::wave) {
      idle_loops = 0;
      return vp8_daily::wave;
    }
    if (current != vp8_daily::idle) {
      idle_loops = 0;
      return vp8_daily::idle;
    }
    if (++idle_loops < 3) return vp8_daily::idle;
    idle_loops = 0;
    return choose_idle;
  }

  template<class Installed>
  std::optional<uint16_t> pick(uint32_t entropy, Installed installed) {
    std::array<uint16_t, automatic_idle_actions.size()> other;
    std::size_t count = 0;
    bool previous_available = false;
    for (const auto id : automatic_idle_actions) {
      if (!installed(id)) continue;
      if (id == previous) previous_available = true;
      else other[count++] = id;
    }
    if (!count) return previous_available ? previous : std::nullopt;
    previous = other[entropy % count];
    return previous;
  }
};
} // namespace vp8_ota

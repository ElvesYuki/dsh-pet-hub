#pragma once

#include "round_battery.h"
#include "touch_gesture.h"
#include <array>
#include <optional>

namespace vp8_ota {
using vp8_daily::Input;

class PlugReaction {
public:
  bool observe(std::optional<bool> plugged) {
    if (!plugged || proposed_ != plugged) {
      proposed_ = plugged;
      return false;
    }
    const bool inserted = stable_ == false && *plugged;
    stable_ = plugged;
    return inserted;
  }

private:
  std::optional<bool> proposed_, stable_;
};

class PowerReactions {
public:
  Input observe(const std::optional<RoundBatteryReading> &reading) {
    if (!reading || !reading->present) {
      proposed_.reset();
      return Input::none;
    }
    const auto &sample = *reading;
    const bool full = sample.phase == RoundChargePhase::full || (stable_ && stable_->full);
    const State next{sample.usb_power, sample.usb_power && full,
        sample.percent ? *sample.percent <= (stable_ && stable_->low ? 20 : 15) : stable_ && stable_->low};
    if (proposed_ != next) {
      proposed_ = next;
      return Input::none;
    }
    const auto old = stable_;
    stable_ = next;
    if (!old) return Input::none;
    if (next.full && old->plugged && !old->full) return Input::battery_full;
    if (!next.plugged && next.low && (old->plugged || !old->low)) return Input::battery_low;
    return Input::none;
  }

private:
  struct State {
    bool plugged, full, low;
    bool operator==(const State &) const = default;
  };
  std::optional<State> proposed_, stable_;
};

inline uint16_t power_action(Input input) {
  switch (input) {
    case Input::usb_connected: return 25; // Breakfast
    case Input::battery_full: return 74; // Stretch
    case Input::battery_low: return 36; // Yawn
    default: return 0;
  }
}

template<class Installed>
std::optional<uint16_t> pick_petting(Installed installed) {
  for (const uint16_t action : {58, 56}) // Giggle, then shy surprise.
    if (installed(action)) return action;
  return std::nullopt;
}

template<class Installed>
std::optional<uint16_t> pick_motion(Input input, Installed installed) {
  if (input == Input::motion_tilt && installed(57)) return 57; // Happy bounce.
  if (input == Input::motion_shake && installed(71)) return 71; // Startled.
  return std::nullopt;
}

template<class Installed>
std::optional<uint16_t> pick_surprise(uint32_t entropy, std::optional<uint16_t> previous, Installed installed) {
  constexpr std::array<uint16_t, 5> regular{5, 19, 44, 49, 67};
  std::array<uint16_t, regular.size()> available;
  std::size_t count = 0;
  std::optional<uint16_t> repeat;
  for (const auto action : regular) {
    if (!installed(action)) continue;
    if (action == previous) repeat = action;
    else available[count++] = action;
  }
  return count ? std::optional(available[entropy % count]) : repeat;
}
} // namespace vp8_ota

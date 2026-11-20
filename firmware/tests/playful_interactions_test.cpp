#include "playful_interactions.h"
#include "sleep_wake.h"

#include <cassert>

using vp8_daily::Input;

int main() {
  vp8_daily::TouchGesture gesture;
  assert(gesture.observe(true, true, 200, 300, 1000) == Input::none);
  assert(gesture.observe(true, true, 205, 195, 150000) == Input::none);
  assert(gesture.observe(true, false, 0, 0, 200000) == Input::surprise);
  assert(gesture.observe(true, false, 0, 0, 250000) == Input::none);
  assert(gesture.observe(true, true, 200, 100, 300000) == Input::none);
  assert(gesture.observe(true, true, 200, 225, 400000) == Input::none);
  assert(gesture.observe(true, false, 0, 0, 500000) == Input::none);

  assert(gesture.observe(true, true, 210, 210, 1000000) == Input::none);
  assert(gesture.observe(true, true, 230, 230, 1399000) == Input::none);
  assert(gesture.observe(true, false, 0, 0, 1400000) == Input::wave);

  assert(gesture.observe(true, true, 210, 210, 2000000) == Input::none);
  assert(gesture.observe(true, true, 230, 230, 2899999) == Input::none);
  assert(gesture.observe(true, true, 230, 230, 2900000) == Input::petting);
  assert(gesture.pressed());
  assert(gesture.observe(false, false, 0, 0, 2950000) == Input::none);
  assert(gesture.pressed());
  assert(gesture.observe(true, true, 300, 210, 3000000) == Input::none);
  assert(gesture.observe(true, false, 0, 0, 3050000) == Input::none);
  assert(!gesture.pressed());
  assert(gesture.observe(true, false, 0, 0, 3100000) == Input::none);
  assert(gesture.observe(true, true, 210, 210, 3200000) == Input::none);
  assert(gesture.observe(true, false, 0, 0, 3300000) == Input::wave);

  assert(gesture.observe(true, true, 210, 210, 4000000) == Input::none);
  assert(gesture.observe(true, true, 210, 210, 4899999) == Input::none);
  assert(gesture.observe(true, false, 0, 0, 4900000) == Input::none);
  assert(gesture.observe(true, true, 250, 250, 5000000) == Input::none);
  assert(gesture.observe(true, true, 172, 250, 5970000) == Input::none);
  assert(gesture.observe(true, false, 0, 0, 6000000) == Input::next);
  assert(gesture.observe(true, true, 210, 210, 6100000) == Input::none);
  assert(gesture.observe(true, true, 210, 189, 6300000) == Input::none);
  assert(gesture.observe(true, true, 210, 210, 7050000) == Input::none);
  assert(gesture.observe(true, false, 0, 0, 7100000) == Input::none);

  vp8_daily::WakeContact wake;
  using Contact = vp8_daily::WakeContact::Result;
  const auto touch_after_wake = [&](bool sleeping, bool pressed, int64_t at) {
    return wake.observe(sleeping, true, pressed, at) == Contact::pass
        ? gesture.observe(true, pressed, 210, 210, at) : Input::none;
  };
  assert(touch_after_wake(true, true, 8000000) == Input::none);
  assert(touch_after_wake(false, true, 9000000) == Input::none);
  assert(touch_after_wake(false, false, 9100000) == Input::none);
  assert(touch_after_wake(false, true, 9400000) == Input::none);
  assert(touch_after_wake(false, true, 10400000) == Input::petting);
  assert(touch_after_wake(false, false, 10500000) == Input::none);

  const auto all = [](uint16_t) { return true; };
  assert(vp8_ota::pick_petting(all) == 58);
  assert(vp8_ota::pick_petting([](auto id) { return id == 56; }) == 56);
  assert(!vp8_ota::pick_petting([](auto id) { return id == 57; }));
  assert(vp8_ota::pick_motion(Input::motion_tilt, all) == 57);
  assert(vp8_ota::pick_motion(Input::motion_shake, all) == 71);
  assert(!vp8_ota::pick_motion(Input::motion_shake, [](auto id) { return id == 57; }));
  assert(!vp8_ota::pick_motion(Input::surprise, all));

  const auto sample = [](bool plugged, std::optional<uint8_t> percent, auto phase) {
    return RoundBatteryReading{true, plugged, RoundBatteryFlow::standby, phase, percent, {}};
  };
  const auto offline = sample(false, 40, RoundChargePhase::idle);
  const auto charging = sample(true, 40, RoundChargePhase::cc);
  const auto full = sample(true, 100, RoundChargePhase::full);
  const auto low = sample(false, 15, RoundChargePhase::idle);
  vp8_ota::PlugReaction plug;
  assert(!plug.observe(true) && !plug.observe(true)); // Boot while charging.
  assert(!plug.observe(false) && !plug.observe(true)); // Dropped contact for one sample.
  assert(!plug.observe(false) && !plug.observe(false));
  assert(!plug.observe(true) && !plug.observe(std::nullopt));
  assert(!plug.observe(true) && plug.observe(true) && !plug.observe(true));
  assert(!plug.observe(false) && !plug.observe(false));
  assert(!plug.observe(true) && plug.observe(true));
  vp8_ota::PowerReactions power;
  const auto confirm = [&](const RoundBatteryReading &reading, Input expected) {
    assert(power.observe(reading) == Input::none);
    assert(power.observe(reading) == expected);
    assert(power.observe(reading) == Input::none);
  };
  confirm(offline, Input::none);
  assert(power.observe(charging) == Input::none);
  assert(power.observe(std::nullopt) == Input::none);
  confirm(charging, Input::none);
  confirm(full, Input::battery_full);
  confirm(sample(true, std::nullopt, RoundChargePhase::unknown), Input::none);
  confirm(sample(true, 100, RoundChargePhase::idle), Input::none);
  confirm(full, Input::none);
  confirm(low, Input::battery_low);
  confirm(sample(false, 18, RoundChargePhase::idle), Input::none);
  confirm(low, Input::none);
  confirm(sample(false, 21, RoundChargePhase::idle), Input::none);
  confirm(low, Input::battery_low);
  confirm(full, Input::none);
  assert(vp8_ota::power_action(Input::usb_connected) == 25);
  assert(vp8_ota::power_action(Input::battery_full) == 74);
  assert(vp8_ota::power_action(Input::battery_low) == 36);

  const auto has = [](uint16_t action) { return action == 19 || action == 44 || action == 57; };
  assert(vp8_ota::pick_surprise(0, {}, has) == 19);
  assert(vp8_ota::pick_surprise(1, {}, has) == 44);
  assert(vp8_ota::pick_surprise(0, 19, has) == 44);
  assert(vp8_ota::pick_surprise(0, 67, [](auto id) { return id == 67; }) == 67);
  assert(!vp8_ota::pick_surprise(0, 57, [](auto id) { return id == 57; }));
  for (uint32_t i = 0; i < 5; ++i)
    assert(vp8_ota::pick_surprise(i, {}, all) == (std::array{5, 19, 44, 49, 67})[i]);
  assert(!vp8_ota::pick_surprise(1, {}, [](uint16_t) { return false; }));
}

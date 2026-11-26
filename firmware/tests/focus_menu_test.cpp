#include "desktop_arc.h"

#include <cassert>
#include <vector>

int main() {
  using namespace vp8_daily;
  constexpr int64_t start = 42, end = start + 1500000000;
  FocusTimer timer;
  assert(!timer.active() && timer.remaining(0) == 1500);
  timer.start(start);
  timer.start(start + 20000000);
  assert(timer.remaining(start + 999999) == 1500 && timer.remaining(start + 1000000) == 1499);
  assert(timer.remaining(end - 1) == 1 && !timer.take_completion(end - 1));
  assert(timer.remaining(end) == 0 && timer.take_completion(end) && !timer.take_completion(end));
  timer.start(end);
  timer.cancel();
  assert(!timer.take_completion(end * 2));

  FocusTouch touch;
  constexpr auto apps = FocusPage::launcher, focus = FocusPage::timer;
  constexpr auto none = FocusControl::none;
  const auto contact = [&](FocusPage page, bool down, int x, int y) {
    return touch.observe(page, true, down, x + focus_origin, y + focus_origin);
  };
  assert(contact(apps, true, 110, 165) == none);
  assert(contact(apps, false, 0, 0) == none);
  assert(contact(apps, true, 110, 165) == none);
  assert(contact(apps, true, 200, 203) == none);
  assert(contact(apps, true, 110, 165) == none);
  assert(contact(apps, false, 0, 0) == none);
  assert(contact(apps, true, 110, 165) == none);
  assert(contact(apps, false, 0, 0) == FocusControl::pet);
  assert(contact(apps, true, 285, 242) == none);
  assert(contact(apps, false, 0, 0) == FocusControl::focus);
  assert(contact(focus, true, 200, 340) == none);
  assert(touch.observe(focus, false, false, 0, 0) == none);
  assert(contact(focus, false, 0, 0) == FocusControl::timer_button);
  assert(contact(focus, false, 0, 0) == none);
  assert(touch.observe(apps, true, true, 233, 360, true) == none);
  assert(touch.observe(apps, true, false, 0, 0, true) == FocusControl::network);
  assert(touch.observe(apps, true, true, 233, 360) == none);
  assert(touch.observe(apps, true, false, 0, 0) == none);

  std::vector<uint16_t> pixels(focus_canvas * focus_canvas + 2, 0xf1a2);
  FocusCanvas screen(pixels.data() + 1);
  screen.draw(apps, 1500, false);
  assert(pixels[1 + 160 * focus_canvas + 55] != pixels[1]);
  assert(pixels[1 + 240 * focus_canvas + 55] != pixels[1]);
  assert(pixels[1 + 205 * focus_canvas + 230] == pixels[1]);
  screen.draw(apps, 1500, false, true);
  const auto online_menu = pixels;
  screen.draw(apps, 1500, false, false);
  assert(pixels != online_menu);
  screen.draw(focus, 1500, false);
  const auto stopped = pixels;
  screen.draw(focus, 1499, true);
  assert(pixels != stopped && pixels.front() == 0xf1a2 && pixels.back() == 0xf1a2);

  DesktopFocusTouch shortcut;
  const auto press = [&](bool active, int x, int y) {
    return shortcut.observe(active, true, true, x, y, 100);
  };
  const auto release = [&](bool active, int64_t now = 4000) {
    return shortcut.observe(active, true, false, 0, 0, now);
  };
  assert(!press(false, 233, 394) && !shortcut.captured() && !release(false));
  assert(!press(true, 233, 265) && !press(true, 233, 394) && !shortcut.captured() && !release(true));
  assert(!press(true, 233, 394) && shortcut.captured());
  assert(!shortcut.observe(true, false, false, 0, 0, 300) && shortcut.captured());
  assert(release(true) && !shortcut.captured() && !release(true));
  assert(!press(true, 233, 394) && !press(true, 233, 334) && shortcut.captured());
  assert(!press(true, 233, 394) && !release(true));
  assert(!press(true, 233, 394) && !press(true, 262, 394) && shortcut.captured() && !release(true));
  assert(!press(true, 233, 394) && !release(true, 400101));
  assert(!press(true, 233, 394) && !release(false));
  assert(!press(true, 233, 429) && shortcut.captured() && release(true));
  assert(!press(true, 233, 438) && !shortcut.captured() && !release(true));

  DesktopStatusCache status;
  assert(status.snapshot(1).minute == -1 && status.snapshot(1).battery == -1);
  status.sync(0, 86399, Weather::rain, -90);
  status.battery(0, 83, true);
  assert(status.snapshot(999999).minute == 1439 && status.snapshot(1000000).minute == 0);
  const auto last_power = status.snapshot(DesktopStatusCache::battery_lifetime - 1);
  assert(last_power.battery == 83 && last_power.usb_power);
  const auto expired = status.snapshot(DesktopStatusCache::battery_lifetime);
  assert(expired.battery == -1 && !expired.usb_power);
  status.sync(2000000, 42, Weather::keep, 0);
  assert(status.snapshot(DesktopStatusCache::weather_lifetime - 1).celsius == -90);
  assert(status.snapshot(DesktopStatusCache::weather_lifetime).weather == Weather::none);
  status.sync(DesktopStatusCache::weather_lifetime, 500, Weather::none, 0);
  assert(status.snapshot(DesktopStatusCache::weather_lifetime).minute == 8);
  status.battery(DesktopStatusCache::weather_lifetime, 42, false);
  status.clear_network();
  assert(status.snapshot(DesktopStatusCache::weather_lifetime).minute == -1 &&
         status.snapshot(DesktopStatusCache::weather_lifetime).battery == 42);
  assert(status.snapshot(0).wifi == WifiLink::off);
  status.wifi(WifiLink::connecting);
  assert(status.snapshot(0).wifi == WifiLink::connecting);
  status.wifi(WifiLink::online);
  assert(status.snapshot(0).wifi == WifiLink::online);

  DesktopSync sync;
  assert(sync.parse("9a234fff 86399 snow -90") && sync.weather == Weather::snow && sync.celsius == -90);
  assert(sync.parse("9a234fff 8644 keep") && sync.weather == Weather::keep);
  assert(sync.parse("9a234fff 1 none"));
  for (auto bad : {"9A234fff 0 keep", "9a234fff -1 keep", "9a234fff 86400 keep", "9a234fff 0 rain",
                   "9a234fff 0 clear 61", "9a234fff 0 rain -91", "9a234fff 0 clear 2 extra",
                   "9a234fff 0 keep 1", "9a234fff 0 sunny 2", "9a234fff  0 keep"})
    assert(!sync.parse(bad));

  constexpr int transfer = focus_canvas + 2;
  constexpr uint16_t sentinel = 0xf1a2;
  std::vector<uint16_t> stripes(transfer * transfer, sentinel);
  std::vector<uint16_t> whole(focus_canvas * focus_canvas, sentinel);
  const DesktopStatus actual{624, 100, Weather::snow, -90};
  DesktopArc desktop;
  desktop.update({}, 0);
  desktop.draw(whole.data(), focus_canvas, 0, focus_canvas);
  const auto placeholders = whole;
  constexpr int wifi_left = 127, wifi_right = 149;
  bool clock_placeholder = false, weather_placeholder = false, wifi_placeholder = false;
  for (int y = 0; y < focus_canvas; ++y) {
    for (int x = 0; x < focus_canvas; ++x) {
      if (whole[y * focus_canvas + x] == sentinel) continue;
      assert(y < 90 && x < 282);
      if (x < wifi_left) weather_placeholder = true;
      else if (x < wifi_right) wifi_placeholder = true;
      else clock_placeholder = true;
    }
  }
  assert(clock_placeholder && weather_placeholder && wifi_placeholder);
  const auto top_pixels = [&](DesktopStatus value) {
    std::fill(whole.begin(), whole.end(), sentinel);
    desktop.update(value, 0);
    desktop.draw(whole.data(), focus_canvas, 0, focus_canvas);
    return whole;
  };
  const auto connecting = top_pixels({.wifi = WifiLink::connecting});
  const auto online = top_pixels({.wifi = WifiLink::online});
  assert(connecting != placeholders && online != connecting && online != placeholders);
  const auto with_clock = top_pixels({624});
  assert(with_clock != placeholders);
  const auto full_status = top_pixels(actual);
  const auto battery_view = [&](int percent, bool usb_power) {
    auto reading = actual;
    reading.battery = percent;
    reading.usb_power = usb_power;
    return top_pixels(reading);
  };
  constexpr auto warning = focus_rgb565(255, 209, 74);
  constexpr auto bolt = focus_rgb565(239, 245, 239);
  const auto battery_ink = [&](const auto &pixels, uint16_t color) {
    for (int y = 0; y < 90; ++y)
      for (int x = 265; x < focus_canvas; ++x)
        if (pixels[y * focus_canvas + x] == color) return true;
    return false;
  };
  for (int percent : {0, 19, 20, 100}) {
    const auto unplugged = battery_view(percent, false);
    const auto plugged = battery_view(percent, true);
    assert(battery_ink(unplugged, warning) == (percent < 20));
    assert(battery_ink(plugged, warning) == (percent < 20));
    assert(!battery_ink(unplugged, bolt) && battery_ink(plugged, bolt));
    for (int i = 0; i < int(plugged.size()); ++i)
      if (plugged[i] != unplugged[i]) assert(i / focus_canvas < 90 && i % focus_canvas >= 265 && i % focus_canvas < 300);
  }
  assert(battery_ink(battery_view(-1, true), bolt));
  assert(!battery_ink(battery_view(-1, false), bolt));
  auto online_status = actual;
  online_status.wifi = WifiLink::online;
  const auto full_online = top_pixels(online_status);
  for (int y = 0; y < focus_canvas; ++y) {
    for (int x = 0; x < focus_canvas; ++x) {
      const auto i = y * focus_canvas + x;
      if (x < wifi_left) assert(with_clock[i] == placeholders[i]);
      if (connecting[i] != placeholders[i] || online[i] != placeholders[i]) {
        assert(x >= wifi_left && x < wifi_right && y < 90);
        assert(with_clock[i] == placeholders[i]);
        assert(full_status[i] == placeholders[i] && full_online[i] == online[i]);
      } else {
        assert(full_status[i] == full_online[i]);
      }
    }
  }
  std::fill(whole.begin(), whole.end(), sentinel);
  auto wired_status = actual;
  wired_status.usb_power = true;
  desktop.update(wired_status, 1122);
  desktop.draw(whole.data(), focus_canvas, 0, focus_canvas);
  for (int y = 0; y < transfer; y += 20)
    desktop.draw(stripes.data() + y * transfer + 1, transfer, y - 1, std::min(20, transfer - y));
  for (int y = 0; y < transfer; ++y) {
    for (int x = 0; x < transfer; ++x) {
      const bool padding = x == 0 || x == transfer - 1 || y == 0 || y == transfer - 1;
      const auto expected = padding ? sentinel : whole[(y - 1) * focus_canvas + x - 1];
      assert(stripes[y * transfer + x] == expected);
      if (!padding && expected != sentinel)
        assert((y <= 90 || y >= 345) && (x - 201) * (x - 201) + (y - 201) * (y - 201) < 233 * 233);
    }
  }
  const auto at = [&](int x, int y) { return whole[y * focus_canvas + x]; };
  assert(at(200, 396) != sentinel && at(113, 376) != sentinel && at(286, 376) != sentinel);
  for (int remaining : {1500, 1122, 599, 1}) {
    std::fill(whole.begin(), whole.end(), sentinel);
    desktop.update(actual, remaining);
    desktop.draw(whole.data(), focus_canvas, 0, focus_canvas);
    for (int x = 150; x <= 250; ++x) {
      const int dx = x - 200;
      const int progress_top = 199 + int(std::lround(std::sqrt(float(196 * 196 - dx * dx))));
      assert(at(x, progress_top) != sentinel);
      for (int y = progress_top - 3; y < progress_top; ++y) assert(at(x, y) == sentinel);
    }
  }
  std::fill(whole.begin(), whole.end(), sentinel);
  desktop.update(actual, 1122);
  desktop.draw(whole.data(), focus_canvas, 0, focus_canvas);
  const auto first_draw = whole;
  std::fill(whole.begin(), whole.end(), sentinel);
  desktop.update(actual, 1121);
  desktop.draw(whole.data(), focus_canvas, 0, focus_canvas);
  assert(std::equal(whole.begin(), whole.begin() + focus_canvas * 100, first_draw.begin()));
  assert(whole != first_draw);
  std::fill(whole.begin(), whole.end(), sentinel);
  desktop.update(actual, 0);
  desktop.draw(whole.data(), focus_canvas, 0, focus_canvas);
  assert(std::all_of(whole.begin() + focus_canvas * 345, whole.end(),
                     [](auto pixel) { return pixel == sentinel; }));
  std::fill(whole.begin(), whole.end(), sentinel);
  desktop.update({}, 0);
  desktop.draw(whole.data(), focus_canvas, 0, focus_canvas);
  assert(whole == placeholders);
}

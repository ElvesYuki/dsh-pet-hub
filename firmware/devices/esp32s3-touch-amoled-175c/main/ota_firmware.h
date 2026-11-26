#pragma once
#include "cache_firmware.h"
#include "touch_gesture.h"
#if VP8_VPC1_USB_PROBE || VP8_VPC1_LAN
#include "playback_control.h"
#endif
#if VP8_FOCUS_MENU
#include "desktop_status.h"
#include "focus_menu.h"
#endif

namespace vp8_ota {
using Playback = bool (*)(unsigned index, vp8_cache::Clip data, bool verify, bool automatic_idle);
bool begin_boot();
bool checking();
void fail_boot();
bool run(Playback playback, vp8_daily::Input (*take_input)()
#if VP8_FOCUS_MENU
         , void (*show_menu)(vp8_daily::FocusTimer &, vp8_daily::FocusPage)
#endif
         );
bool take_wave();
#if VP8_DESKTOP_INTERNET
bool menu_network_online();
void toggle_menu_network();
#endif
#if VP8_VPC1_USB_PROBE || VP8_VPC1_LAN
void control_contact(bool valid, bool pressed);
bool control_turn(bool background);
std::optional<vp8_control::Ticket> control_ticket();
bool control_can_submit(const vp8_control::Ticket &ticket);
void control_first_dma(const vp8_control::Ticket &ticket);
#endif
#if VP8_FOCUS_MENU
bool take_menu_key();
bool focus_due(int64_t now);
int focus_seconds(int64_t now);
vp8_daily::DesktopStatus desktop_status();
#endif
#if VP8_SENSOR_QUERY
void observe_touch(bool valid, bool pressed, unsigned x, unsigned y, int64_t now);
#endif
#if VP8_LOCAL_MOTION
vp8_daily::Input take_local_motion(bool eligible);
#endif
#if VP8_SLEEP_WAKE
struct WakeTiming {
  int64_t detected_us = -1, brightness_us = -1, poll_gap_us = -1;
};
void note_sleep_activity(int64_t now);
void request_wake_preload(int64_t now);
void note_wake_touch(int64_t now, int64_t poll_gap);
#if VP8_LIFT_WAKE
void arm_lift_wake();
bool take_lift_wake();
#endif
WakeTiming take_wake_timing();
bool sleep_external_wake();
#endif
#if VP8_PLAYFUL_INTERACTIONS
vp8_daily::Input take_power_reaction(bool include_background);
#endif
#if VP8_BOOT_PAIRING
uint32_t pairing_prompt();
void pairing_prompt_drawn(uint32_t reference);
#endif
}

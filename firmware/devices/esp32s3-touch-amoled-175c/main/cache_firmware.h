#pragma once

#include <cstdint>
#include <span>

namespace vp8_cache {
using Clip = std::span<const uint8_t>;
using Playback = bool (*)(unsigned index, Clip data, bool verify);
#if VP8_ACTION_UPDATE
bool take_serial_wave();
#endif
#if VP8_RETAINED
using TakeTouch = bool (*)();
bool run_from_flash(Playback playback, TakeTouch take_touch);
#else
bool run_from_flash(Playback playback);
#endif
}

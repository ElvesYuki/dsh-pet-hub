#!/bin/sh
set -eu
if [ "$#" -ne 1 ]; then
  echo 'Usage: sh firmware/tools/test-host.sh WORK_DIR' >&2
  exit 2
fi
: "${IDF_PATH:?Activate ESP-IDF 6.0.2}"
firmware=$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)
main="$firmware/devices/esp32s3-touch-amoled-175c/main"
board="$firmware/devices/esp32s3-touch-amoled-175c/board/round_display"
tests="$firmware/tests"
host_cxx=${CXX:-clang++}
if [ -z "${CXX:-}" ] && [ "$(uname -s)" = Darwin ]; then
  host_cxx=/usr/bin/clang++
fi
mkdir -p -- "$1"
work=$(mktemp -d "$1/firmware-host.XXXXXX")
trap 'rm -rf -- "$work"' EXIT
# The SDK error types need a config header even when testing only host policy.
printf '%s\n' '#pragma once' > "$work/sdkconfig.h"
for name in daily_policy device_lan_address_lookup device_lan_discovery focus_menu lift_wake motion_gesture \
  playful_interactions sleep_wake touch_gesture; do
  "$host_cxx" -std=c++20 -O1 -Wall -Wextra -Werror -fsanitize=address,undefined \
    -DVP8_PLAYFUL_INTERACTIONS=1 \
    -I "$main" -I "$board/include" -I "$firmware/components/protocol/include" -I "$firmware/components/playback/include" \
    -I "$work" -I "$IDF_PATH/components/esp_common/include" -I "$tests/fixtures" \
    "$tests/${name}_test.cpp" -o "$work/$name"
  "$work/$name"
  printf '%s\n' "$name passed"
done

for name in playback_control_test playback_loopback; do
  "$host_cxx" -std=c++20 -O1 -Wall -Wextra -Werror -fsanitize=address,undefined \
    -I "$main" -I "$firmware/components/protocol/include" \
    "$main/playback_control.cpp" "$tests/$name.cpp" -o "$work/$name"
done
"$work/playback_control_test"
python3 "$tests/test_playback_loopback.py" "$work/playback_loopback"

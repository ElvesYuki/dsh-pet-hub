#!/bin/sh
set -eu

if [ "$#" -ne 3 ]; then
  echo 'Usage: sh firmware/tools/build-device.sh BUILD_DIR MUSE_CHECKOUT FIRMWARE_VERSION' >&2
  exit 2
fi
firmware=$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)
require_dir() {
  CDPATH='' cd -- "$1" && pwd
}
mkdir -p "$1"
build_dir=$(require_dir "$1")
muse=$(require_dir "$2")
version=$3
if [ -n "${IDF_PATH:-}" ]; then
  PATH="$IDF_PATH/tools:$PATH"
  export PATH
fi
exec idf.py -C "$firmware/devices/esp32s3-touch-amoled-175c" -B "$build_dir" \
  -D IDF_TARGET=esp32s3 -D "VP8_MUSE=$muse" -D "VP8_OTA_VERSION=$version" \
  -D VP8_PIPELINE=ON -D VP8_VISUAL_PROBE=ON -D VP8_FLASH_PROBE=ON -D VP8_RETAINED=ON -D VP8_FAST_TOUCH=ON \
  -D VP8_OTA=ON -D VP8_BOOT_PAIRING=ON -D VP8_USB_ENROLL=ON -D VP8_BATTERY_QUERY=ON -D VP8_SENSOR_QUERY=ON \
  -D VP8_LOCAL_MOTION=ON -D VP8_SLEEP_WAKE=ON -D VP8_LIFT_WAKE=ON -D VP8_FOCUS_MENU=ON \
  -D VP8_DESKTOP_INTERNET=ON -D VP8_VPC1_LAN=ON -D VP8_TOUCH_SWIPE=ON -D VP8_PLAYFUL_INTERACTIONS=ON build

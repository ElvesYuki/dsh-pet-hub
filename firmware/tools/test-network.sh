#!/bin/sh
set -eu
if [ "$#" -ne 1 ]; then
  echo 'Usage: sh firmware/tools/test-network.sh WORK_DIR' >&2
  exit 2
fi
: "${IDF_PATH:?Activate ESP-IDF 6.0.2}"
: "${IDF_PYTHON_ENV_PATH:?Activate the ESP-IDF Python environment}"
firmware=$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)
main="$firmware/devices/esp32s3-touch-amoled-175c/main"
tests="$firmware/tests"
stack="$IDF_PATH/components/mbedtls/mbedtls"
psa="$stack/tf-psa-crypto"
host_cxx=${CXX:-clang++}
if [ -z "${CXX:-}" ] && [ "$(uname -s)" = Darwin ]; then
  host_cxx=/usr/bin/clang++
fi

mkdir -p -- "$1"
build=$(CDPATH='' cd -- "$1" && pwd)
mkdir -p "$build/compat/mbedtls"
for name in bignum ecp; do
  printf '%s\n' '#define MBEDTLS_DECLARE_PRIVATE_IDENTIFIERS' "#include \"mbedtls/private/$name.h\"" > "$build/compat/mbedtls/$name.h"
done
cmake -S "$psa" -B "$build/psa" -DCMAKE_BUILD_TYPE=Release -DENABLE_PROGRAMS=OFF -DENABLE_TESTING=OFF \
  -DPython3_EXECUTABLE="$IDF_PYTHON_ENV_PATH/bin/python" \
  -DCMAKE_C_FLAGS="-I\"$build/compat\" -I\"$stack/include\" -I\"$psa/drivers/builtin/include\""
cmake --build "$build/psa" -j 6
"$host_cxx" -std=c++20 -O1 -Wall -Wextra -Werror -fsanitize=address,undefined \
  -I "$main" -I "$firmware/components/protocol/include" \
  -I "$psa/include" -I "$psa/drivers/builtin/include" -I "$stack/include" "$tests/device_tcp_loopback.cpp" \
  "$main/playback_control.cpp" "$main/device_status.cpp" "$main/device_tcp_wire.cpp" "$main/device_tcp_session.cpp" \
  "$main/persistence/media_auth_psa.cpp" "$build/psa/core/libtfpsacrypto.a" \
  "$build/psa/drivers/builtin/libbuiltin.a" "$build/psa/utilities/libutilities.a" \
  "$build/psa/extras/libextras.a" "$build/psa/platform/libplatform.a" \
  "$build/psa/drivers/p256-m/libp256-m.a" "$build/psa/drivers/everest/libeverest.a" \
  -o "$build/device-tcp-loopback"
node "$tests/device-network.test.mjs" "$build/device-tcp-loopback"

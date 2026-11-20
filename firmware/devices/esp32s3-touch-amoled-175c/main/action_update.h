#pragma once

#include "cache_store.h"
#include <string_view>

namespace vp8_cache {
constexpr uint32_t update_size = 512 * 1024;
constexpr uint32_t update_capacity = update_size - sector;

template<class Flash, class Stop>
bool read_update_payload(Flash &flash, std::span<uint8_t> data, Stop stop) {
  for (size_t at = 0; at < data.size(); at += sector) {
    const auto block = data.subspan(at, std::min<size_t>(sector, data.size() - at));
    if (stop() || !flash.read(sector + at, block)) return false;
  }
  return true;
}

template<class Flash>
bool load_update(Flash &flash, const Asset &asset, std::span<uint8_t> buffer) {
  if (asset.bytes > update_capacity || buffer.size() < asset.bytes) return false;
  std::array<uint8_t, 16> marker;
  if (!flash.read(identity(asset).size(), marker) || marker != committed) return false;
  auto data = buffer.first(asset.bytes);
  return read_update_payload(flash, data, [] { return false; }) && mount(flash, 0, asset, data);
}

template<class Flash, class Stop>
bool seal_update(Flash &flash, const Asset &asset, std::span<uint8_t> buffer, Stop stop) {
  if (asset.bytes > update_capacity || buffer.size() != asset.bytes) return false;
  return read_update_payload(flash, buffer, stop) && commit(flash, 0, asset, buffer, [&] { return !stop(); });
}

// Feed just one serial owner. Discard a malformed or overlong line through its terminator.
template<size_t Capacity>
class BasicUpdateLines {
  std::array<char, Capacity> bytes{};
  size_t used = 0;
  bool malformed = false;
public:
  void clear() {
    volatile char *out = bytes.data();
    for (size_t i = 0; i < used; ++i) out[i] = 0;
    used = 0;
    malformed = false;
  }

  template<class Dispatch> void push(uint8_t c, Dispatch dispatch) {
    if (c == '\n') {
      bytes[used] = '\0';
      if (!malformed && used) dispatch(std::string_view(bytes.data(), used));
      clear();
    } else if (c < 32 || c > 126 || used + 1 >= bytes.size()) {
      malformed = true;
    } else if (!malformed) {
      bytes[used++] = char(c);
    }
  }
};
using UpdateLines = BasicUpdateLines<256>;
} // namespace vp8_cache

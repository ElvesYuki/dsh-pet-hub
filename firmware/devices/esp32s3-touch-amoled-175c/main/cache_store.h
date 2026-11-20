#pragma once

#include "pet_sha256.h"

#include <algorithm>
#include <array>
#include <cstdint>
#include <cstring>
#include <span>

namespace vp8_cache {

constexpr uint32_t sector = 4096;
#if VP8_RETAINED
constexpr uint32_t region = 0x19ff000;
constexpr uint32_t region_size = 2 * 1024 * 1024;
#else
constexpr uint32_t region = 0x1aff000;
constexpr uint32_t region_size = 1024 * 1024;
#endif
using Digest = std::array<uint8_t, 32>;

struct Asset {
  uint32_t id, bytes, frames;
  Digest sha;
};

inline uint32_t load32(const uint8_t *p) {
  return uint32_t(p[0]) | uint32_t(p[1]) << 8 | uint32_t(p[2]) << 16 | uint32_t(p[3]) << 24;
}

inline void store32(uint8_t *p, uint32_t v) {
  for (unsigned i = 0; i < 4; ++i) p[i] = uint8_t(v >> (8 * i));
}

constexpr uint32_t footprint(uint32_t bytes) {
  return bytes && bytes <= region_size - sector ? sector + ((bytes + sector - 1) / sector) * sector : 0;
}

inline bool fits(uint32_t offset, const Asset &asset) {
  const auto length = footprint(asset.bytes);
  return length && offset % sector == 0 && offset <= region_size - length;
}

inline Digest sha256(std::span<const uint8_t> data) {
  pet::Sha256 hash;
  hash.update(data.data(), data.size());
  Digest result;
  hash.finish(result.data());
  return result;
}

inline bool validate_ivf(std::span<const uint8_t> data, uint32_t frames) {
  if (data.size() < 32 || std::memcmp(data.data(), "DKIF", 4) || std::memcmp(data.data() + 8, "VP80", 4) ||
      load32(data.data() + 4) != 0x00200000 || load32(data.data() + 12) != 0x01900190 ||
      load32(data.data() + 16) != 24 || load32(data.data() + 20) != 1 ||
      !frames || load32(data.data() + 24) != frames) return false;
  size_t at = 32;
  unsigned latest_key = 0;
  for (uint32_t i = 0; i < frames; ++i) {
    if (data.size() - at < 12 || load32(data.data() + at + 4) != i || load32(data.data() + at + 8)) return false;
    const auto size = load32(data.data() + at);
    at += 12;
    if (size < 3 || size > 22000 || data.size() - at < size) return false;
    const auto tag = data[at];
    if ((tag & 0x1e) != 0x12) return false;
    if ((tag & 1) == 0) {
      if (size < 10 || std::memcmp(data.data() + at + 3, "\x9d\x01\x2a", 3) ||
          load32(data.data() + at + 6) != 0x01900190) return false;
      latest_key = i;
    } else if (i == 0 || i - latest_key >= 12) return false;
    at += size;
  }
  return at == data.size();
}

inline std::array<uint8_t, 64> identity(const Asset &asset) {
  std::array<uint8_t, 64> header{};
  std::memcpy(header.data(), "RPVP8IV1", 8);
  store32(header.data() + 8, asset.id);
  store32(header.data() + 12, asset.bytes);
  store32(header.data() + 16, asset.frames);
  std::copy(asset.sha.begin(), asset.sha.end(), header.begin() + 24);
  return header;
}

constexpr std::array<uint8_t, 16> committed{
  'R','P','V','P','8','C','O','M','M','I','T','1',0x42,0x9a,0xd5,0x6e};

template<class Flash> bool mount(Flash &flash, uint32_t offset, const Asset &asset, std::span<const uint8_t> data) {
  if (!fits(offset, asset) || data.size() != asset.bytes) return false;
  const auto expected = identity(asset);
  std::array<uint8_t, 80> header{};
  return flash.read(offset, header) && std::equal(expected.begin(), expected.end(), header.begin()) &&
         std::equal(committed.begin(), committed.end(), header.begin() + expected.size()) &&
         sha256(data) == asset.sha && validate_ivf(data, asset.frames);
}

template<class Flash, class Receive> bool stage(Flash &flash, uint32_t offset, const Asset &asset,
                                                std::span<uint8_t> buffer, Receive receive) {
  if (!fits(offset, asset) || buffer.size() < sector || !flash.erase(offset, footprint(asset.bytes))) return false;
  for (uint32_t at = 0; at < asset.bytes;) {
    const auto chunk = buffer.first(std::min(sector, asset.bytes - at));
    if (!receive(chunk) || !flash.write(offset + sector + at, chunk)) return false;
    at += chunk.size();
  }
  return true;
}

template<class Flash, class Validate> bool commit(Flash &flash, uint32_t offset, const Asset &asset,
                                                  std::span<const uint8_t> data, Validate validate) {
  if (!fits(offset, asset) || data.size() != asset.bytes || sha256(data) != asset.sha ||
      !validate_ivf(data, asset.frames) || !validate()) return false;
  const auto meta = identity(asset);
  return flash.write(offset, meta) && flash.write(offset + meta.size(), committed) && mount(flash, offset, asset, data);
}

}  // namespace vp8_cache

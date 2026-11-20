#pragma once
#include <cstddef>
#include <cstdint>
#include <cstring>
#include <array>
namespace pet {
inline uint16_t u16(const uint8_t *p) { return p[0] | uint16_t(p[1]) << 8; }
inline uint32_t u32(const uint8_t *p) {
  return u16(p) | uint32_t(u16(p + 2)) << 16;
}
// Standard CRC32 (same result as zlib.crc32), independent of target ROM APIs.
constexpr std::array<uint32_t, 256> make_crc_table() {
  std::array<uint32_t, 256> table{};
  for (unsigned i = 0; i < 256; ++i) {
    uint32_t c = i;
    for (int k = 0; k < 8; ++k)
      c = (c >> 1) ^ ((c & 1) ? 0xedb88320U : 0);
    table[i] = c;
  }
  return table;
}
inline constexpr auto crc_table = make_crc_table();
inline uint32_t crc32(const uint8_t *data, size_t n) {
  uint32_t c = ~0U;
  for (size_t i = 0; i < n; ++i)
    c = crc_table[(c ^ data[i]) & 255] ^ (c >> 8);
  return ~c;
}

} // namespace pet

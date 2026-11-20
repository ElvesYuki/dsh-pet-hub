#pragma once
#include "pet_bytes.h"
#include <cstddef>
#include <cstdint>
namespace pet_fast {
inline uint32_t crc_update(uint32_t crc, const uint8_t *data, uint32_t length) {
  crc = ~crc;
  for (uint32_t i = 0; i < length; ++i)
    crc = pet::crc_table[(crc ^ data[i]) & 255] ^ (crc >> 8);
  return ~crc;
}
// Immutable after construction. Four independent byte lookups per word avoid
// the serial dependency of the byte loop. Device storage is internal RAM.
struct Crc32 {
  uint32_t tables[4][256];
  Crc32() {
    for (unsigned i = 0; i < 256; ++i) {
      auto value = tables[0][i] = pet::crc_table[i];
      for (unsigned j = 1; j < 4; ++j) {
        value = pet::crc_table[value & 255] ^ (value >> 8);
        tables[j][i] = value;
      }
    }
  }
  uint32_t update(uint32_t crc, const uint8_t *data, uint32_t length) const {
    crc = ~crc;
    while (length >= 4) {
      using AliasWord = uint32_t __attribute__((may_alias));
      uint32_t word;
      if (uintptr_t(data) & 3)
        word = pet::u32(data);
      else {
        word = *reinterpret_cast<const AliasWord *>(data);
#if __BYTE_ORDER__ == __ORDER_BIG_ENDIAN__
        word = __builtin_bswap32(word);
#endif
      }
      crc ^= word;
      crc = tables[3][crc & 255] ^ tables[2][(crc >> 8) & 255] ^
            tables[1][(crc >> 16) & 255] ^ tables[0][crc >> 24];
      data += 4;
      length -= 4;
    }
    while (length--)
      crc = tables[0][(crc ^ *data++) & 255] ^ (crc >> 8);
    return ~crc;
  }
};
} // namespace pet_fast

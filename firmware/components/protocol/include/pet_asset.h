#pragma once
#include "pet_bytes.h"
namespace pet {
class FlashIO {
public:
  virtual ~FlashIO() = default;
  virtual size_t capacity() const = 0;
  virtual bool read(size_t, void *, size_t) = 0;
  virtual bool erase(size_t, size_t) = 0;
  virtual bool write(size_t, const void *, size_t) = 0;
};
inline void put32(uint8_t *p, uint32_t v) {
  for (int i = 0; i < 4; ++i)
    p[i] = uint8_t(v >> (i * 8));
}
inline void put64(uint8_t *p, uint64_t v) {
  put32(p, uint32_t(v));
  put32(p + 4, uint32_t(v >> 32));
}
inline uint64_t get64(const uint8_t *p) {
  return u32(p) | (uint64_t(u32(p + 4)) << 32);
}
struct Asset {
  uint32_t id = 0, length = 0;
  uint8_t sha[32]{};
};
} // namespace pet

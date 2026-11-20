#pragma once
#include <array>
#include <cstddef>
#include <cstdint>
#include <initializer_list>

namespace pet400_persist::media_auth {
using Digest = std::array<uint8_t, 32>;
struct Bytes {
  const uint8_t *data = nullptr;
  size_t size = 0;
  Bytes() = default;
  Bytes(const uint8_t *bytes, size_t count):data(bytes),size(count) {}
  template<size_t N> Bytes(const std::array<uint8_t, N> &bytes):Bytes(bytes.data(), N) {}
  bool valid() const { return !size || data; }
};

namespace crypto {
using Parts = std::initializer_list<Bytes>;
bool initialize();
bool sha256(Parts, Digest &);
bool hkdf(const Digest &secret, const Digest &salt, const char *info, Digest &);
bool tag(const Digest &key, Parts, Digest &);
bool verify(const Digest &key, Parts, const Digest &tag);

inline void erase(Digest &value) {
  auto *p = static_cast<volatile uint8_t *>(value.data());
  for (size_t i = 0; i < value.size(); ++i) p[i] = 0;
}
struct Secret {
  Digest bytes{};
  ~Secret() { erase(bytes); }
  Secret() = default;
  Secret(const Secret &) = delete;
  Secret &operator=(const Secret &) = delete;
};
}
} // namespace pet400_persist::media_auth

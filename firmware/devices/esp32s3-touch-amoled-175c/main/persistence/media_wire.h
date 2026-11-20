#pragma once
#include "pet_asset.h"
#include "pet_crc32.h"

namespace pet400_persist::media_wire {
constexpr size_t header_bytes = 16;
constexpr uint32_t payload_max = 4096;
constexpr uint32_t data_prefix = 20;
constexpr uint32_t block_max = payload_max - data_prefix;

enum class Kind : uint8_t { Hello = 1, Begin, Ready, Data, Ack, End, Cancel, Query, Result };
enum class Outcome : uint8_t { Saved = 1, Cancelled, Failed, Unknown };
using Job = std::array<uint8_t, 16>;
using Sha = std::array<uint8_t, 32>;

struct Header { Kind kind{}; uint32_t length = 0; };
struct Frame {
  Header header;
  const uint8_t *payload = nullptr;
};
struct Data {
  Job job{};
  uint32_t offset = 0;
  const uint8_t *bytes = nullptr;
  size_t count = 0;
};

namespace detail {
inline bool valid_length(Kind kind, uint32_t length) {
  constexpr uint32_t fixed[] = {32, 124, 16, 0, 20, 20, 16, 16, 68};
  const auto type = unsigned(kind);
  if (!type || type > sizeof(fixed) / sizeof(fixed[0])) return false;
  if (kind == Kind::Data) return length > data_prefix && length <= payload_max;
  return length == fixed[type - 1];
}

inline uint32_t checksum(const uint8_t *header, const uint8_t *payload, uint32_t length) {
  return pet_fast::crc_update(pet_fast::crc_update(0, header, 12), payload, length);
}

inline bool valid_result(Outcome status, uint64_t root, uint64_t generation, const Sha &sha) {
  if (status == Outcome::Saved) return true;
  return status >= Outcome::Cancelled && status <= Outcome::Unknown && !root && !generation && sha == Sha{};
}

template<size_t N> using Packet = std::array<uint8_t, header_bytes + N>;

inline void seal(uint8_t *packet, Kind kind, uint32_t length) {
  std::memcpy(packet, "PTM1", 4);
  packet[4] = 1;
  packet[5] = uint8_t(kind);
  pet::put32(packet + 8, length);
  pet::put32(packet + 12, checksum(packet, packet + header_bytes, length));
}
} // namespace detail

inline bool decode_header(const uint8_t *bytes, size_t count, Header &out) {
  out = {};
  if (!bytes || count != header_bytes || std::memcmp(bytes, "PTM1", 4) ||
      bytes[4] != 1 || pet::u16(bytes + 6)) return false;
  const auto kind = Kind(bytes[5]);
  const auto length = pet::u32(bytes + 8);
  if (!detail::valid_length(kind, length)) return false;
  out = {kind, length};
  return true;
}

// The caller owns the bytes and the lifetime of the returned payload view.
// Association, approved asset identity and offsets are connection-owner checks.
inline bool decode(const uint8_t *header, size_t head_count, const uint8_t *payload,
                   size_t payload_count, Frame &out) {
  out = {};
  Header h;
  if (!decode_header(header, head_count, h) || !payload || payload_count != h.length ||
      pet::u32(header + 12) != detail::checksum(header, payload, h.length)) return false;
  if (h.kind == Kind::Begin) {
    constexpr uint16_t encoding[] = {400, 400, 24, 1, 12, 20};
    for (size_t i = 0; i < sizeof(encoding) / sizeof(encoding[0]); ++i)
      if (pet::u16(payload + 48 + i * 2) != encoding[i]) return false;
  }
  if (h.kind == Kind::Result) {
    Sha sha;
    std::memcpy(sha.data(), payload + 36, sha.size());
    if (payload[17] || payload[18] || payload[19] ||
        !detail::valid_result(Outcome(payload[16]), pet::get64(payload + 20),
                              pet::get64(payload + 28), sha)) return false;
  }
  out = {h, payload};
  return true;
}

// DATA can be read straight into the existing Flash transfer workspace. Its
// 20-byte job/offset prefix can live beside the socket header instead.
inline bool decode_data(const uint8_t *header, size_t head_count,
                       const std::array<uint8_t, data_prefix> &prefix,
                       const uint8_t *bytes, size_t count, Data &out) {
  out = {};
  Header h;
  if (!decode_header(header, head_count, h) || h.kind != Kind::Data ||
      !bytes || count != h.length - data_prefix) return false;
  const auto prefix_crc = detail::checksum(header, prefix.data(), data_prefix);
  if (pet::u32(header + 12) != pet_fast::crc_update(prefix_crc, bytes, uint32_t(count))) return false;
  std::memcpy(out.job.data(), prefix.data(), out.job.size());
  out.offset = pet::u32(prefix.data() + out.job.size());
  out.bytes = bytes;
  out.count = count;
  return true;
}

inline detail::Packet<32> hello(uint64_t boot, uint64_t root, uint64_t generation1, uint64_t generation11) {
  detail::Packet<32> packet{};
  auto *payload = packet.data() + header_bytes;
  pet::put64(payload, boot);
  pet::put64(payload + 8, root);
  pet::put64(payload + 16, generation1);
  pet::put64(payload + 24, generation11);
  detail::seal(packet.data(), Kind::Hello, 32);
  return packet;
}

inline detail::Packet<16> ready(const Job &job) {
  detail::Packet<16> packet{};
  std::memcpy(packet.data() + header_bytes, job.data(), job.size());
  detail::seal(packet.data(), Kind::Ready, 16);
  return packet;
}

inline detail::Packet<20> ack(const Job &job, uint32_t accepted) {
  detail::Packet<20> packet{};
  auto *payload = packet.data() + header_bytes;
  std::memcpy(payload, job.data(), job.size());
  pet::put32(payload + 16, accepted);
  detail::seal(packet.data(), Kind::Ack, 20);
  return packet;
}

inline bool result(const Job &job, Outcome status, uint64_t root, uint64_t generation,
                   const Sha &sha, detail::Packet<68> &out) {
  out = {};
  if (!detail::valid_result(status, root, generation, sha)) return false;
  auto *payload = out.data() + header_bytes;
  std::memcpy(payload, job.data(), job.size());
  payload[16] = uint8_t(status);
  pet::put64(payload + 20, root);
  pet::put64(payload + 28, generation);
  std::memcpy(payload + 36, sha.data(), sha.size());
  detail::seal(out.data(), Kind::Result, 68);
  return true;
}
} // namespace pet400_persist::media_wire

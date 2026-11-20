#include "action_update.h"
#include "persistence/media_binding_wire.h"
#include <openssl/evp.h>
#include <cassert>
#include <iostream>
#include <string>
#include <vector>

namespace binding = pet400_persist::media_auth::persistent_binding;
namespace pairing = pet400_persist::media_auth::pairing;
using pairing::Type;

namespace {
constexpr std::string_view request_prefix = "VP8PAIR1 ";

std::string base64(const uint8_t *bytes, size_t size) {
  std::array<uint8_t, 265> text{};
  const int n = EVP_EncodeBlock(text.data(), bytes, static_cast<int>(size));
  return {reinterpret_cast<char *>(text.data()), static_cast<size_t>(n)};
}

void candidate_dispatch(std::string_view line) {
  if (line == "STATUS2") { std::cout << "status2 "; return; }
  if (!line.starts_with(request_prefix)) return;
  line.remove_prefix(request_prefix.size());
  if (line.empty() || line.size() > 264 || line.size() % 4 != 0) return;
  std::array<uint8_t, 198> packet{};
  const int decoded = EVP_DecodeBlock(packet.data(), reinterpret_cast<const uint8_t *>(line.data()), static_cast<int>(line.size()));
  if (decoded < 0) return;
  const size_t padding = line.ends_with("==") ? 2 : line.ends_with("=") ? 1 : 0;
  const size_t count = static_cast<size_t>(decoded) - padding;
  if (count < pairing::header_bytes || count > 196 || base64(packet.data(), count) != line ||
      std::memcmp(packet.data(), "PBP1", 4) != 0) return;
  const auto type = Type(packet[5]);
  if (type != Type::BindingInfo && type != Type::BindingChallenge && type != Type::BindingEnroll) return;
  if (pairing::binding_request_length(type) != count - pairing::header_bytes) return;
  pairing::BasicDecoder<false, true> decoder;
  decoder.feed(packet.data(), count, 1, [](Type request, auto body) {
    if (binding::valid_request(request, body) &&
        (request != Type::BindingChallenge || body.data[0] == 1))
      std::cout << static_cast<unsigned>(request) << ' ';
  });
}

void emit(binding::WireReply reply, Type type, bool candidate) {
  // Only the candidate fixture adds bit 2. Upstream status_reply emits 3.
  if (candidate) {
    reply.body()[2] |= 4;
    reply.finish(type, reply.size - pairing::header_bytes);
  }
  std::cout << "@VP8_PAIR1 " << base64(reply.bytes.data(), reply.size) << '\n';
}
}

int main() {
  constexpr uint64_t boot = 9007199254740999ULL, epoch = 9007199254740993ULL;
  binding::Record record{};
  record.binding.device.fill(0x11);
  const auto device = record.binding.device;
  emit(binding::status_reply(device, boot, binding::Result::Ok, &record, false), Type::BindingStatus, false);
  emit(binding::status_reply(device, boot, binding::Result::Ok, &record, false), Type::BindingStatus, true);
  emit(binding::status_reply(device, boot, binding::Result::Ok, &record, true, 42), Type::BindingEnrolled, true);
  record.binding.controller.fill(0x22);
  record.binding.pairing.fill(0x33);
  record.binding.epoch = epoch;
  record.key.fill(0x44);
  record.key[0] = 4; // Synthetic public metadata, never used for curve verification.
  emit(binding::status_reply(device, boot, binding::Result::Ok, &record, false), Type::BindingStatus, true);
  binding::Challenge challenge{};
  challenge.reference = 42;
  challenge.value.fill(0x55);
  emit(binding::challenge_reply(1, binding::Result::Ok, challenge), Type::BindingNonce, false);

  for (std::string hex; std::getline(std::cin, hex);) {
    assert(hex.size() % 2 == 0);
    vp8_cache::BasicUpdateLines<384> lines;
    for (size_t i = 0; i < hex.size(); i += 2)
      lines.push(static_cast<uint8_t>(std::stoul(hex.substr(i, 2), nullptr, 16)), candidate_dispatch);
    std::cout << '\n';
  }
}

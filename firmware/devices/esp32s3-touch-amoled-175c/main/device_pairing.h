#pragma once

#include "persistence/media_binding_wire.h"
#include "usb_base64.h"
#include <cstdio>
#include <span>
#include <string_view>

namespace vp8_pairing {
namespace auth = pet400_persist::media_auth;
namespace binding = auth::persistent_binding;
namespace pbp = auth::pairing;
using auth::Bytes;
using auth::Digest;
using auth::Identifier;
using binding::Result;
using pbp::Type;

constexpr std::string_view request_prefix = "VP8PAIR1 ", reply_prefix = "@VP8_PAIR1 ";
constexpr Type proof_request = Type(10), proof_response = Type(133);
constexpr size_t proof_request_bytes = 64, proof_response_bytes = 136;
constexpr uint8_t boot_enroll = 1, usb_enroll = 3;
constexpr size_t packet_limit = pbp::header_bytes + pbp::lan_arm_bytes;
constexpr size_t text_limit = 4 * ((packet_limit + 2) / 3);
using vp8_usb_base64::alphabet;

inline size_t encode(std::span<const uint8_t> packet, std::span<char> text) {
  return packet.size() <= packet_limit ? vp8_usb_base64::encode(packet, text) : 0;
}

inline size_t decode(std::string_view text, std::span<uint8_t> packet) {
  if (text.empty() || text.size() > text_limit || text.size() % 4) return 0;
  size_t out = 0;
  for (size_t i = 0; i < text.size(); i += 4) {
    const size_t a = alphabet.find(text[i]), b = alphabet.find(text[i + 1]);
    const bool second = text[i + 2] != '=', third = text[i + 3] != '=';
    const size_t c = second ? alphabet.find(text[i + 2]) : 0, d = third ? alphabet.find(text[i + 3]) : 0;
    if (a >= 64 || b >= 64 || c >= 64 || d >= 64 || (third && !second) ||
        ((!second || !third) && i + 4 != text.size()) ||
        (!second && (b & 15)) || (!third && (c & 3)) || out + 1 + second + third > packet.size()) return 0;
    packet[out++] = uint8_t(a << 2 | b >> 4);
    if (second) packet[out++] = uint8_t(b << 4 | c >> 2);
    if (third) packet[out++] = uint8_t(c << 6 | d);
  }
  return out;
}

inline bool valid_packet(std::span<const uint8_t> packet, Type &type) {
  if (packet.size() < pbp::header_bytes || packet.size() > packet_limit ||
      std::memcmp(packet.data(), "PBP1", 4) || packet[4] != 1 || packet[6] || packet[7]) return false;
  type = Type(packet[5]);
  const size_t length = packet.size() - pbp::header_bytes;
  const bool legacy = type == Type::BindingInfo || type == Type::BindingChallenge || type == Type::BindingEnroll;
  const size_t expected = legacy ? pbp::binding_request_length(type) :
    type == proof_request ? proof_request_bytes : SIZE_MAX;
  if (length != expected) return false;
  return pet::u32(packet.data() + 8) == length && pet::u32(packet.data() + 12) ==
    pbp::checksum(packet.data(), packet.data() + pbp::header_bytes, length);
}

enum class Mode : uint8_t { Poll, Fence };
enum class Phase : uint8_t { Unbound, Waiting, Bound, Fault };

class Session {
  binding::Lifecycle lifecycle_;
  const Identifier device_;
  const uint64_t boot_;
  const bool usb_enroll_enabled_;
  pbp::ShortClick click_;
  uint32_t reference_ = 0, usb_challenge_ = 0;
  Result settled_ = Result::Denied;

  binding::WireReply status(Result result, uint32_t reference = 0) const {
    const auto *record = lifecycle_.record();
    auto reply = binding::status_reply(device_, boot_, result, record, prompt() != 0, reference);
    reply.body()[2] |= 4;
    if (usb_enroll_enabled_) {
      reply.body()[2] |= 8;
      if (!reference && record && record->bound()) reply.body()[2] |= 16;
    }
    reply.finish(reference ? Type::BindingEnrolled : Type::BindingStatus, reply.size - pbp::header_bytes);
    return reply;
  }

  template<class Emit> void proof(Bytes request, bool idle, Emit emit) {
    const auto *in = request.data;
    const auto mode = Mode(in[0]);
    const auto reference = pet::u32(in + 60);
    if ((mode != Mode::Poll && mode != Mode::Fence) || in[1] || in[2] || in[3] ||
        pet::get64(in + 4) != boot_ || !std::equal(device_.begin(), device_.end(), in + 12) ||
        std::all_of(in + 28, in + 60, [](uint8_t value) { return value == 0; }) ||
        (mode == Mode::Poll ? !reference || reference != reference_ : reference != 0)) return;

    Result result = Result::Busy;
    if (idle) {
      if (mode == Mode::Fence) disconnect();
      result = mode == Mode::Fence || prompt() ? Result::Ok : settled_;
    }
    const auto *record = lifecycle_.record();
    Digest key_hash{};
    if (record && record->bound() && !auth::crypto::sha256({record->key}, key_hash)) record = nullptr;
    if (!record) result = Result::StorageFault;

    std::array<uint8_t, pbp::header_bytes + proof_response_bytes> packet{};
    auto *body = packet.data() + pbp::header_bytes;
    body[0] = uint8_t(result);
    body[1] = uint8_t(!record ? Phase::Fault : prompt() ? Phase::Waiting :
                      record->bound() ? Phase::Bound : Phase::Unbound);
    body[2] = uint8_t(mode);
    pet::put64(body + 4, boot_);
    std::copy(device_.begin(), device_.end(), body + 12);
    if (record) {
      const auto &entry = record->binding;
      pet::put64(body + 28, entry.epoch);
      std::copy(entry.controller.begin(), entry.controller.end(), body + 36);
      std::copy(entry.pairing.begin(), entry.pairing.end(), body + 52);
      std::copy(key_hash.begin(), key_hash.end(), body + 68);
    }
    std::copy_n(in + 28, 32, body + 100);
    pet::put32(body + 132, reference);
    pbp::seal(packet.data(), proof_response, proof_response_bytes);
    emit(std::span<const uint8_t>(packet));
  }

public:
  Session(binding::Storage &storage, binding::VerifySignature verify, uint64_t boot, const Identifier &device,
          bool usb_enroll_enabled = false)
    : lifecycle_(storage, verify, boot, device), device_(device), boot_(boot), usb_enroll_enabled_(usb_enroll_enabled) {}

  Result load() { return lifecycle_.load(); }
  const binding::Record *record() const { return lifecycle_.record(); }
  uint64_t boot() const { return boot_; }
  uint32_t prompt() const { return lifecycle_.pending() == binding::Lifecycle::Pending::Enroll ? reference_ : 0; }
  void disconnect() {
    lifecycle_.disconnect();
    reference_ = 0;
    usb_challenge_ = 0;
    settled_ = Result::Denied;
    click_.reset();
  }

  void tick(uint64_t now, uint32_t drawn, bool down, bool idle) {
    if (!prompt()) return;
    lifecycle_.expire_confirmation(now);
    if (!prompt()) settled_ = Result::Expired;
    else if (drawn == prompt() && idle && click_.update(down, now))
      settled_ = lifecycle_.confirm_local(now, true);
  }

  /** Same physical enrollment descriptor, separate versioned request and two signatures. */
  template<class Random, class BeforeCommit, class Emit>
  void receive_rotation(std::string_view request, uint64_t now, bool idle, Random random, BeforeCommit before_commit,
                        Emit emit) {
    if (!usb_enroll_enabled_ || !request.starts_with("1 ")) return;
    request.remove_prefix(2);
    if (request.size() <= 8 || request[8] != ' ') return;
    const auto id = request.substr(0, 8);
    if (id.find_first_not_of("0123456789abcdef") != id.npos) return;
    request.remove_prefix(9);
    Result result = Result::Denied;
    if (request == "BEGIN") {
      binding::Challenge challenge{};
      Digest nonce{};
      result = !idle ? Result::Busy : !random(nonce) ? Result::Denied :
          lifecycle_.issue(binding::Operation::Rotate, nonce, now, true, challenge);
      if (result == Result::Ok) {
        constexpr char digits[] = "0123456789abcdef";
        std::array<char, 64> text{};
        for (size_t i = 0; i < challenge.value.size(); ++i) {
          text[2 * i] = digits[challenge.value[i] >> 4];
          text[2 * i + 1] = digits[challenge.value[i] & 15];
        }
        char reply[160];
        const auto length = std::snprintf(reply, sizeof reply, "@BINDKEY 1 %.8s challenge %llu %lu %.64s",
            id.data(), static_cast<unsigned long long>(boot_), static_cast<unsigned long>(challenge.reference), text.data());
        if (length > 0 && size_t(length) < sizeof reply) emit(std::string_view(reply, length));
        return;
      }
    } else if (request.starts_with("COMMIT ")) {
      std::array<uint8_t, 197> packet{};
      if (decode(request.substr(7), packet) == packet.size()) {
        binding::PublicKey point{};
        binding::Signature old_signature{}, new_signature{};
        std::copy_n(packet.data() + 4, point.size(), point.begin());
        std::copy_n(packet.data() + 69, old_signature.size(), old_signature.begin());
        std::copy_n(packet.data() + 133, new_signature.size(), new_signature.begin());
        result = lifecycle_.rotate(pet::u32(packet.data()), point, old_signature, new_signature, now, idle, before_commit);
      }
    }
    constexpr const char *statuses[] {"committed", "denied", "busy", "expired", "storage_fault"};
    char reply[48];
    const auto length = std::snprintf(reply, sizeof reply, "@BINDKEY 1 %.8s %s", id.data(), statuses[uint8_t(result)]);
    if (length > 0 && size_t(length) < sizeof reply) emit(std::string_view(reply, length));
  }

  template<class Random, class Emit>
  void receive(std::string_view text, uint64_t now, bool idle, Random random, Emit emit) {
    std::array<uint8_t, packet_limit> packet{};
    const auto length = decode(text, packet);
    Type type{};
    if (!valid_packet({packet.data(), length}, type)) return;
    const Bytes body{packet.data() + pbp::header_bytes, length - pbp::header_bytes};
    if (type == proof_request) { proof(body, idle, emit); return; }

    binding::WireReply reply;
    if (type == Type::BindingInfo) reply = status(Result::Ok);
    else if (type == Type::BindingChallenge) {
      const uint8_t operation = body.data[0];
      if (operation != boot_enroll && (operation != usb_enroll || !usb_enroll_enabled_)) return;
      binding::Challenge challenge{};
      Digest nonce{};
      const auto result = !idle ? Result::Busy : !random(nonce) ? Result::Denied :
        lifecycle_.issue(binding::Operation::Enroll, nonce, now, true, challenge);
      if (result == Result::Ok) usb_challenge_ = operation == usb_enroll ? challenge.reference : 0;
      reply = binding::challenge_reply(operation, result, challenge);
    } else {
      if (!binding::valid_request(type, body)) return;
      const auto reference = pet::u32(body.data);
      const bool direct = reference == usb_challenge_;
      binding::Signature signature{};
      std::copy_n(body.data + 109, signature.size(), signature.begin());
      auto result = lifecycle_.enroll(reference, binding::enroll_record(body, device_), signature, now, idle);
      if (result == Result::Ok) {
        reference_ = reference;
        settled_ = Result::Denied;
        click_.reset();
        if (direct) {
          result = lifecycle_.confirm_local(now, true);
          settled_ = result;
        }
      }
      if (direct && result != Result::Busy) usb_challenge_ = 0;
      reply = status(result, reference);
    }
    emit(std::span<const uint8_t>(reply.bytes.data(), reply.size));
  }
};

} // namespace vp8_pairing

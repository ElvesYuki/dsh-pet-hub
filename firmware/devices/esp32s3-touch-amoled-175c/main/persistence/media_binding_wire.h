#pragma once
#include "media_binding.h"
#include "media_pairing.h"

namespace pet400_persist::media_auth::persistent_binding {
using pairing::Type;
using Reply = std::array<uint8_t, pairing::header_bytes + 88>;

struct WireReply {
  Reply bytes{};
  size_t size = 0;

  uint8_t *body() { return bytes.data() + pairing::header_bytes; }
  void finish(Type type, size_t length) {
    pairing::seal(bytes.data(), type, length);
    size = length + pairing::header_bytes;
  }
};

inline WireReply status_reply(const Identifier &device, uint64_t boot, Result result,
                              const Record *record, bool pending, uint32_t enroll_reference = 0) {
  WireReply reply;
  auto *body = reply.body();
  Digest key_hash{};
  if (record && record->bound() && !crypto::sha256({record->key}, key_hash)) {
    record = nullptr;
    result = Result::StorageFault;
  }
  body[0] = uint8_t(record ? result : Result::StorageFault);
  body[1] = !record ? 3 : pending ? 1 : record->bound() ? 2 : 0;
  body[2] = 3;
  pet::put64(body + 4, boot);
  std::copy(device.begin(), device.end(), body + 12);
  if (record) {
    const auto &binding = record->binding;
    pet::put64(body + 28, binding.epoch);
    std::copy(binding.controller.begin(), binding.controller.end(), body + 36);
    std::copy(binding.pairing.begin(), binding.pairing.end(), body + 52);
    std::copy_n(key_hash.begin(), 16, body + 68);
  }
  if (enroll_reference) pet::put32(body + 84, enroll_reference);
  reply.finish(enroll_reference ? Type::BindingEnrolled : Type::BindingStatus, enroll_reference ? 88 : 84);
  return reply;
}

inline WireReply challenge_reply(uint8_t operation, Result result, const Challenge &challenge) {
  WireReply reply;
  auto *body = reply.body();
  body[0] = uint8_t(result);
  body[1] = operation;
  if (result == Result::Ok) {
    pet::put32(body + 4, challenge.reference);
    std::copy(challenge.value.begin(), challenge.value.end(), body + 8);
  }
  reply.finish(Type::BindingNonce, 40);
  return reply;
}

inline WireReply active_reply(Result result, const ActiveProof &proof) {
  WireReply reply;
  auto *body = reply.body();
  body[0] = uint8_t(result);
  if (result == Result::Ok) {
    pet::put32(body + 4, proof.proposal);
    std::copy(proof.fingerprint.begin(), proof.fingerprint.end(), body + 8);
    std::copy(proof.tag.begin(), proof.tag.end(), body + 24);
  }
  reply.finish(Type::BindingActive, 56);
  return reply;
}

inline Record enroll_record(Bytes body, const Identifier &device) {
  Record record{};
  record.binding.device = device;
  std::copy_n(body.data + 4, 16, record.binding.controller.begin());
  std::copy_n(body.data + 20, 16, record.binding.pairing.begin());
  record.binding.epoch = pet::get64(body.data + 36);
  std::copy_n(body.data + 44, record.key.size(), record.key.begin());
  return record;
}

inline bool valid_request(Type type, Bytes body) {
  if (body.size != pairing::binding_request_length(type) || !body.valid()) return false;
  if (type == Type::BindingChallenge) return body.data[0] == 1 || body.data[0] == 2;
  if (type == Type::BindingEnroll || type == Type::BindingResume) return pet::u32(body.data) != 0;
  return type == Type::BindingInfo;
}
} // namespace pet400_persist::media_auth::persistent_binding

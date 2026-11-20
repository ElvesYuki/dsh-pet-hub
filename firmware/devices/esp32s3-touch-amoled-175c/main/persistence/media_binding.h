#pragma once

#include "media_auth.h"

namespace pet400_persist::media_auth::persistent_binding {

using PublicKey = std::array<uint8_t, 65>;
using Signature = std::array<uint8_t, 64>;
using Blob = std::array<uint8_t, 140>;
using VerifySignature = bool (*)(const PublicKey &, const Digest &, const Signature &);

enum class Load { Missing, Present, Failed };
enum class Result { Ok, Denied, Busy, Expired, StorageFault };

struct Storage {
  virtual ~Storage() = default;
  virtual Load read(Blob &) = 0;
  virtual bool commit(const Blob &) = 0;
};

struct Record {
  Binding binding{};
  PublicKey key{};
  bool bound() const { return binding.controller != Identifier{}; }
};

inline bool valid(const Record &record) {
  const auto &binding = record.binding;
  if (binding.device == Identifier{} || !binding.epoch) return false;
  if (record.bound()) return binding.pairing != Identifier{} && record.key[0] == 4;
  return binding.pairing == Identifier{} && record.key == PublicKey{};
}

inline bool encode(const Record &record, Blob &out) {
  if (!valid(record)) return false;
  out = {};
  const auto &binding = record.binding;
  std::memcpy(out.data(), "PBP1BND1", 8);
  out[8] = record.bound();
  std::copy_n(binding.device.begin(), 16, out.begin() + 12);
  std::copy_n(binding.controller.begin(), 16, out.begin() + 28);
  std::copy_n(binding.pairing.begin(), 16, out.begin() + 44);
  pet::put64(out.data() + 60, binding.epoch);
  std::copy(record.key.begin(), record.key.end(), out.begin() + 68);
  pet::put32(out.data() + 136, pet_fast::crc_update(0, out.data(), 136));
  return true;
}

inline bool decode(const Blob &blob, const Identifier &device, Record &out) {
  Record record{};
  std::copy_n(blob.begin() + 12, 16, record.binding.device.begin());
  std::copy_n(blob.begin() + 28, 16, record.binding.controller.begin());
  std::copy_n(blob.begin() + 44, 16, record.binding.pairing.begin());
  record.binding.epoch = pet::get64(blob.data() + 60);
  std::copy_n(blob.begin() + 68, record.key.size(), record.key.begin());
  Blob canonical;
  if (record.binding.device != device || !encode(record, canonical) || canonical != blob) return false;
  out = record;
  return true;
}

enum class Operation { Enroll, Resume };

inline Bytes domain(const char *value) {
  return {reinterpret_cast<const uint8_t *>(value), std::strlen(value)};
}

inline bool proof_digest(Operation operation, const Binding &binding, uint64_t boot,
                         const Digest &challenge, Bytes payload, Digest &out) {
  std::array<uint8_t, 16> counters{};
  pet::put64(counters.data(), binding.epoch);
  pet::put64(counters.data() + 8, boot);
  return crypto::sha256({domain(operation == Operation::Enroll ? "PBP1/persist/enroll/v1" : "PBP1/persist/resume/v1"),
                         binding.device, binding.controller, binding.pairing, counters, challenge, payload}, out);
}

struct ActiveProof {
  uint32_t proposal = 0;
  Identifier fingerprint{};
  Digest tag{};
};

inline bool active_proof(const Binding &binding, uint64_t boot, const Digest &transcript,
                         const Digest &psk, uint32_t proposal, ActiveProof &out) {
  std::array<uint8_t, 12> scope{};
  std::array<uint8_t, 8> epoch{};
  pet::put64(scope.data(), boot);
  pet::put32(scope.data() + 8, proposal);
  pet::put64(epoch.data(), binding.epoch);
  ActiveProof proof{};
  Digest fingerprint{};
  if (!crypto::tag(psk, {domain("PBP1/fingerprint/v1"), scope, binding.device,
                        binding.controller, binding.pairing, epoch}, fingerprint)) return false;
  std::copy_n(fingerprint.begin(), proof.fingerprint.size(), proof.fingerprint.begin());
  if (!crypto::tag(psk, {domain("PBP1/persist/active/v1"), transcript,
                        {scope.data() + 8, 4}, proof.fingerprint}, proof.tag)) return false;
  proof.proposal = proposal;
  out = proof;
  return true;
}

struct Challenge {
  Digest value{};
  uint32_t reference = 0;
};

class Lifecycle {
  enum class Confirmation { None, Enroll, Unbind };
  Storage &storage_;
  VerifySignature verify_;
  uint64_t boot_;
  Identifier device_;
  Record record_{}, pending_{};
  Challenge challenge_{};
  Operation operation_ = Operation::Enroll;
  Confirmation confirmation_ = Confirmation::None;
  uint64_t deadline_ = 0, last_ = 0;
  uint32_t issued_ = 0, proposal_ = 0;
  bool loaded_ = false, ready_ = false;

  void cancel() {
    confirmation_ = Confirmation::None;
    challenge_ = {};
    pending_ = {};
  }

  bool advance(uint64_t now) {
    const bool live = now >= last_ && now < deadline_;
    if (!live) cancel();
    last_ = std::max(last_, now);
    return live;
  }

  Result consume(Operation expected, uint32_t reference, uint64_t now, Digest &value) {
    if (!ready_) return Result::StorageFault;
    if (!challenge_.reference) return Result::Denied;
    if (!advance(now)) return Result::Expired;
    if (operation_ != expected || challenge_.reference != reference) return Result::Denied;
    value = challenge_.value;
    cancel();
    return Result::Ok;
  }

  Result save(const Record &record) {
    Blob next{}, readback{};
    if (!encode(record, next) || !storage_.commit(next) ||
        storage_.read(readback) != Load::Present || readback != next) {
      ready_ = false;
      return Result::StorageFault;
    }
    record_ = record;
    return Result::Ok;
  }

public:
  enum class Pending { None, Enroll, Unbind };
  static constexpr uint64_t challenge_us = 10000000, button_us = 15000000;
  Lifecycle(Storage &storage, VerifySignature verify, uint64_t boot, const Identifier &device)
    : storage_(storage), verify_(verify), boot_(boot), device_(device) {}

  Result load() {
    if (loaded_) return ready_ ? Result::Ok : Result::StorageFault;
    loaded_ = true;
    if (!boot_ || device_ == Identifier{} || !verify_) return Result::Denied;
    Blob bytes{};
    const auto read = storage_.read(bytes);
    if (read == Load::Failed || (read == Load::Present && !decode(bytes, device_, record_)))
      return Result::StorageFault;
    ready_ = true;
    return Result::Ok;
  }

  const Record *record() const { return ready_ ? &record_ : nullptr; }
  void disconnect() { cancel(); }
  void expire_confirmation(uint64_t now) {
    if (confirmation_ != Confirmation::None) advance(now);
  }
  Pending pending() const {
    if (confirmation_ == Confirmation::Enroll) return Pending::Enroll;
    if (confirmation_ == Confirmation::Unbind) return Pending::Unbind;
    return Pending::None;
  }

  // The caller supplies a fresh CSPRNG value and checks the PMA1 owner is idle.
  Result issue(Operation operation, const Digest &random, uint64_t now, bool idle, Challenge &out) {
    out = {};
    if (!ready_) return Result::StorageFault;
    if (!idle) return Result::Busy;
    if (now < last_) { cancel(); return Result::Expired; }
    advance(now);
    if (confirmation_ != Confirmation::None || challenge_.reference) return Result::Busy;
    if (record_.bound() != (operation == Operation::Resume) || random == Digest{} ||
        issued_ == UINT32_MAX || now > UINT64_MAX - challenge_us) return Result::Denied;
    challenge_ = out = {random, ++issued_};
    operation_ = operation;
    deadline_ = now + challenge_us;
    return Result::Ok;
  }

  Result enroll(uint32_t reference, const Record &record, const Signature &signature, uint64_t now, bool idle) {
    if (!idle) return Result::Busy;
    Digest challenge{}, transcript{};
    const auto result = consume(Operation::Enroll, reference, now, challenge);
    if (result != Result::Ok) return result;
    if (record_.bound() || record_.binding.epoch == UINT64_MAX ||
        !record.bound() || !valid(record) || record.binding.device != device_ ||
        record.binding.epoch != record_.binding.epoch + 1 || now > UINT64_MAX - button_us ||
        !proof_digest(Operation::Enroll, record.binding, boot_, challenge, record.key, transcript) ||
        !verify_(record.key, transcript, signature)) return Result::Denied;
    pending_ = record;
    confirmation_ = Confirmation::Enroll;
    deadline_ = now + button_us;
    return Result::Ok;
  }

  Result resume(uint32_t reference, const Digest &psk, const Signature &signature,
                uint64_t now, bool idle, ActiveProof &out) {
    out = {};
    if (!idle) return Result::Busy;
    Digest challenge{}, key_digest{}, transcript{};
    const auto result = consume(Operation::Resume, reference, now, challenge);
    if (result != Result::Ok) return result;
    if (!record_.bound() || psk == Digest{} || proposal_ == UINT32_MAX ||
        !crypto::sha256({psk}, key_digest) ||
        !proof_digest(Operation::Resume, record_.binding, boot_, challenge, key_digest, transcript) ||
        !verify_(record_.key, transcript, signature) ||
        !active_proof(record_.binding, boot_, transcript, psk, proposal_ + 1, out)) return Result::Denied;
    ++proposal_;
    return Result::Ok;
  }

  Result request_unbind(uint64_t now, bool idle) {
    if (!ready_) return Result::StorageFault;
    if (!idle) return Result::Busy;
    if (now < last_) { cancel(); return Result::Expired; }
    advance(now);
    if (!record_.bound() || confirmation_ != Confirmation::None || now > UINT64_MAX - button_us)
      return Result::Denied;
    cancel();
    pending_.binding.device = device_;
    pending_.binding.epoch = record_.binding.epoch;
    confirmation_ = Confirmation::Unbind;
    deadline_ = now + button_us;
    return Result::Ok;
  }

  // The UI caller must have observed a new debounced press after drawing the prompt.
  // For unbind, it also must have stopped and revoked the old maintenance lease.
  Result confirm_local(uint64_t now, bool idle) {
    if (!ready_) return Result::StorageFault;
    if (!idle) return Result::Busy;
    if (confirmation_ == Confirmation::None) return Result::Denied;
    if (!advance(now)) return Result::Expired;
    const auto record = pending_;
    cancel();
    return save(record);
  }
};

} // namespace pet400_persist::media_auth::persistent_binding

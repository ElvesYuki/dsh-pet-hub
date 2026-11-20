#include "device_tcp_session.h"
#include <cstring>

namespace vp8_lan {
namespace {
using Part = pet400_persist::media_auth::Bytes;
constexpr auto ecdsa = PSA_ALG_ECDSA(PSA_ALG_SHA_256);
constexpr auto p256_pair = PSA_KEY_TYPE_ECC_KEY_PAIR(PSA_ECC_FAMILY_SECP_R1);
constexpr auto p256_public = PSA_KEY_TYPE_ECC_PUBLIC_KEY(PSA_ECC_FAMILY_SECP_R1);

Part part(Bytes bytes) { return {bytes.data(), bytes.size()}; }
Part label(const char *text) { return {reinterpret_cast<const uint8_t *>(text), std::strlen(text)}; }
bool nonzero(Bytes bytes) { return std::any_of(bytes.begin(), bytes.end(), [](uint8_t b) { return b != 0; }); }
bool authenticated(Kind kind) {
  return kind == Kind::ready || kind == Kind::control || kind == Kind::status || kind == Kind::status_ack;
}

psa_key_attributes_t attributes(psa_key_type_t type, psa_algorithm_t alg, psa_key_usage_t usage) {
  auto result = psa_key_attributes_init();
  psa_set_key_type(&result, type);
  psa_set_key_bits(&result, 256);
  psa_set_key_usage_flags(&result, usage);
  psa_set_key_algorithm(&result, alg);
  return result;
}
} // namespace

bool Identity::valid() const {
  return device != Identifier{} && controller != Identifier{} && binding != Identifier{} && epoch &&
         controller_key[0] == 4;
}

bool Identity::scope(std::span<uint8_t, 88> out) const {
  Digest hash{};
  if (!valid() || !crypto::sha256({controller_key}, hash)) return false;
  std::copy(device.begin(), device.end(), out.begin());
  std::copy(controller.begin(), controller.end(), out.begin() + 16);
  std::copy(binding.begin(), binding.end(), out.begin() + 32);
  put64(out.data() + 48, epoch);
  std::copy(hash.begin(), hash.end(), out.begin() + 56);
  return true;
}

bool Key::generate(bool signing, bool exportable) {
  clear();
  const auto a = attributes(p256_pair, signing ? ecdsa : PSA_ALG_ECDH,
      (signing ? PSA_KEY_USAGE_SIGN_HASH : PSA_KEY_USAGE_DERIVE) | (exportable ? PSA_KEY_USAGE_EXPORT : 0));
  return psa_generate_key(&a, &id_) == PSA_SUCCESS;
}

bool Key::import_signing(const Digest &key) {
  clear();
  const auto a = attributes(p256_pair, ecdsa, PSA_KEY_USAGE_SIGN_HASH);
  return psa_import_key(&a, key.data(), key.size(), &id_) == PSA_SUCCESS;
}

bool Key::export_private(Digest &key) const {
  size_t used = 0;
  return psa_export_key(id_, key.data(), key.size(), &used) == PSA_SUCCESS && used == key.size();
}

bool Key::public_key(Pub &point) const {
  size_t used = 0;
  return psa_export_public_key(id_, point.data(), point.size(), &used) == PSA_SUCCESS &&
      used == point.size() && point[0] == 4;
}

bool Key::sign(const Digest &hash, Signature &signature) const {
  size_t used = 0;
  return psa_sign_hash(id_, ecdsa, hash.data(), hash.size(), signature.data(), signature.size(), &used) ==
      PSA_SUCCESS && used == signature.size();
}

bool Key::agree(Bytes peer, Digest &secret) const {
  size_t used = 0;
  return peer.size() == Pub{}.size() && peer[0] == 4 &&
      psa_raw_key_agreement(PSA_ALG_ECDH, id_, peer.data(), peer.size(), secret.data(), secret.size(), &used) ==
      PSA_SUCCESS && used == secret.size();
}

void Key::clear() {
  psa_destroy_key(id_);
  id_ = {};
}

bool verify_signature(const Pub &key, const Digest &hash, const Signature &signature) {
  const auto a = attributes(p256_public, ecdsa, PSA_KEY_USAGE_VERIFY_HASH);
  mbedtls_svc_key_id_t id{};
  if (psa_import_key(&a, key.data(), key.size(), &id) != PSA_SUCCESS) return false;
  const auto result = psa_verify_hash(id, ecdsa, hash.data(), hash.size(), signature.data(), signature.size());
  return psa_destroy_key(id) == PSA_SUCCESS && result == PSA_SUCCESS;
}

bool seal(Packet &packet, Kind kind, uint32_t counter, Bytes payload, const Digest &key) {
  if (!counter || !authenticated(kind) || !valid_length(kind, payload.size() + envelope_size)) return false;
  auto out = packet.begin(kind, payload.size() + envelope_size);
  put32(out.data(), counter);
  std::copy(payload.begin(), payload.end(), out.begin() + 4);
  Digest mac{};
  if (!crypto::tag(key, {label("VPL1/record"), part(packet.bytes().first(packet.size - tag_size))}, mac))
    return false;
  std::copy(mac.begin(), mac.end(), out.end() - tag_size);
  return true;
}

bool verify_record(Kind kind, Bytes frame, uint32_t counter, const Digest &key) {
  if (!counter || !authenticated(kind) || frame.size() < header_size + envelope_size ||
      std::memcmp(frame.data(), "VPL1\1", 5) || frame[5] != uint8_t(kind) ||
      u16(frame.data() + 6) != frame.size() - header_size ||
      !valid_length(kind, frame.size() - header_size) || u32(frame.data() + header_size) != counter) return false;
  Digest mac{};
  std::copy_n(frame.end() - tag_size, tag_size, mac.begin());
  return crypto::verify(key, {label("VPL1/record"), part(frame.first(frame.size() - tag_size))}, mac);
}

bool Session::start(const Identity &identity, const Key &device_key, uint64_t boot, uint64_t now) {
  close();
  Pub point{};
  if (!boot || !identity.scope(std::span<uint8_t, 88>(hello_.data(), 88)) ||
      psa_generate_random(hello_.data() + 96, 32) != PSA_SUCCESS ||
      !nonzero(Bytes(hello_).subspan(96, 32)) ||
      !ephemeral_.generate(false) || !ephemeral_.public_key(point)) {
    close();
    return false;
  }
  put64(hello_.data() + 88, boot);
  std::copy(point.begin(), point.end(), hello_.begin() + 128);
  hello_[193] = push_capability;
  auto out = pending_.begin(Kind::device_hello, hello_.size());
  std::copy(hello_.begin(), hello_.end(), out.begin());
  controller_key_ = identity.controller_key;
  device_key_ = &device_key;
  started_ = now;
  state_ = State::auth;
  return true;
}

bool Session::hub_auth(Bytes p) {
  if (p[97] != push_mode || latest_session_ == UINT32_MAX || !nonzero(p.first(32)) ||
      !crypto::sha256({hello_, part(p.first(auth_prefix_size))}, transcript_)) return false;
  Signature sig{};
  std::copy_n(p.begin() + auth_prefix_size, sig.size(), sig.begin());
  Digest hash{};
  if (!crypto::sha256({label("VPL1/hub-auth"), transcript_}, hash) ||
      !verify_signature(controller_key_, hash, sig)) return false;

  crypto::Secret shared;
  if (!ephemeral_.agree(p.subspan(32, 65), shared.bytes)) return false;
  ephemeral_.clear();
  if (!crypto::hkdf(shared.bytes, transcript_, "VPL1/device-to-hub", to_hub_.bytes) ||
      !crypto::hkdf(shared.bytes, transcript_, "VPL1/hub-to-device", to_device_.bytes)) return false;

  std::array<uint8_t, 4> serial{};
  put32(serial.data(), ++latest_session_);
  Digest confirmation{};
  if (!crypto::sha256({label("VPL1/device-auth"), transcript_, serial}, hash) ||
      !device_key_->sign(hash, sig) ||
      !crypto::tag(to_hub_.bytes, {label("VPL1/device-finish"), transcript_, serial}, confirmation)) return false;

  auto out = pending_.begin(Kind::device_finish, 100);
  std::copy(serial.begin(), serial.end(), out.begin());
  std::copy(sig.begin(), sig.end(), out.begin() + 4);
  std::copy(confirmation.begin(), confirmation.end(), out.begin() + 68);
  state_ = State::finish;
  return true;
}

bool Session::finish(Bytes p, uint64_t now) {
  std::array<uint8_t, 4> serial{};
  put32(serial.data(), latest_session_);
  Digest mac{};
  std::copy(p.begin(), p.end(), mac.begin());
  if (!crypto::verify(to_device_.bytes, {label("VPL1/hub-finish"), transcript_, serial}, mac) ||
      !send(pending_, Kind::ready, serial) || !port_.open(latest_session_, now)) return false;
  state_ = State::ready;
  next_status_at_ = now;
  return true;
}

bool Session::receive_record(Kind kind, Bytes frame, uint64_t now) {
  if (pending_.size) return false;
  const auto data = frame.subspan(header_size);
  if (state_ == State::auth) return kind == Kind::hub_auth && hub_auth(data);
  if (state_ == State::finish) return kind == Kind::hub_finish && finish(data, now);
  if ((kind != Kind::control && kind != Kind::status_ack) || rx_ == UINT32_MAX ||
      !verify_record(kind, frame, rx_ + 1, to_device_.bytes))
    return false;
  ++rx_;
  if (kind == Kind::status_ack) {
    const auto session = u32(data.data() + 4);
    const auto sequence = u32(data.data() + 8);
    if (session != latest_session_ || !sequence || sequence > sent_status_) return false;
    if (sequence <= acked_status_) return true;
    if (!port_.renew(now)) return false;
    acked_status_ = sequence;
    return true;
  }
  vp8_control::Frame control{};
  std::copy_n(data.begin() + 4, control.size(), control.begin());
  const auto message = vp8_control::decode(control);
  return message && message->kind == vp8_control::Kind::play && port_.receive(control, now);
}

bool Session::receive(Bytes data, uint64_t now) {
  if (!tick(now)) return false;
  if (framer_.push(data, [&](Kind kind, Bytes frame) { return receive_record(kind, frame, now); })) return true;
  close();
  return false;
}

bool Session::tick(uint64_t now) {
  if (state_ == State::closed) return false;
  if (state_ == State::ready ? port_.tick(now) : now >= started_ && now - started_ < handshake_ms) return true;
  close();
  return false;
}

bool Session::send(Packet &packet, Kind kind, Bytes payload) {
  return tx_ != UINT32_MAX && seal(packet, kind, ++tx_, payload, to_hub_.bytes);
}

bool Session::next(Packet &packet, uint64_t now) {
  if (pending_.size) {
    packet = pending_;
    pending_.size = 0;
    return true;
  }
  if (state_ != State::ready) return false;
  if (now >= next_status_at_) {
    const auto sequence = sent_status_ + 1;
    std::array<uint8_t, max_status_size> payload{};
    const auto length = encode_status(port_.snapshot(), latest_session_, sequence, payload);
    if (length && send(packet, Kind::status, Bytes(payload).first(length))) {
      sent_status_ = sequence;
      next_status_at_ = now + 3000;
      return true;
    }
    close();
    return false;
  }
  const auto reply = port_.pop();
  if (!reply) return false;
  vp8_control::Frame frame{};
  if (!vp8_control::encode(*reply, frame) || !send(packet, Kind::control, frame)) {
    close();
    return false;
  }
  return true;
}

void Session::close() {
  if (state_ == State::ready) port_.close();
  state_ = State::closed;
  framer_.reset();
  pending_.size = 0;
  ephemeral_.clear();
  crypto::erase(to_device_.bytes);
  crypto::erase(to_hub_.bytes);
  device_key_ = nullptr;
  rx_ = tx_ = sent_status_ = acked_status_ = 0;
}
} // namespace vp8_lan

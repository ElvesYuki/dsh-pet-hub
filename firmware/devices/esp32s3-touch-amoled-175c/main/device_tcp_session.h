#pragma once

#include "device_tcp_wire.h"
#include "persistence/media_auth_crypto.h"
#include "psa/crypto.h"

namespace vp8_lan {
namespace crypto = pet400_persist::media_auth::crypto;
using Digest = pet400_persist::media_auth::Digest;
using Pub = std::array<uint8_t, 65>;
using Signature = std::array<uint8_t, 64>;
using Identifier = std::array<uint8_t, 16>;

struct Identity {
  Identifier device{}, controller{}, binding{};
  uint64_t epoch{};
  Pub controller_key{};
  bool operator==(const Identity &) const = default;
  bool valid() const;
  bool scope(std::span<uint8_t, 88> out) const;
};

class Key {
 public:
  Key() = default;
  Key(const Key &) = delete;
  Key &operator=(const Key &) = delete;
  ~Key() { clear(); }
  bool generate(bool signing, bool exportable = false);
  bool import_signing(const Digest &key);
  bool export_private(Digest &key) const;
  bool public_key(Pub &point) const;
  bool sign(const Digest &hash, Signature &signature) const;
  bool agree(Bytes peer, Digest &secret) const;
  void clear();

 private:
  mbedtls_svc_key_id_t id_{};
};

bool verify_signature(const Pub &key, const Digest &hash, const Signature &signature);
bool seal(Packet &packet, Kind kind, uint32_t counter, Bytes payload, const Digest &key);
bool verify_record(Kind kind, Bytes frame, uint32_t counter, const Digest &key);

class ControlPort {
 public:
  virtual ~ControlPort() = default;
  virtual bool open(uint32_t session, uint64_t now) = 0;
  virtual void close() = 0;
  virtual bool receive(const vp8_control::Frame &frame, uint64_t now) = 0;
  virtual bool renew(uint64_t now) = 0;
  virtual bool tick(uint64_t now) = 0;
  virtual std::optional<vp8_control::Message> pop() = 0;
  virtual vp8_status::Status snapshot() = 0;
};

class Session {
 public:
  explicit Session(ControlPort &port) : port_(port) {}
  ~Session() { close(); }
  bool start(const Identity &identity, const Key &device_key, uint64_t boot, uint64_t now);
  bool receive(Bytes data, uint64_t now);
  bool tick(uint64_t now);
  bool next(Packet &packet, uint64_t now);
  bool authenticated() const { return state_ == State::ready; }
  void close();

 private:
  enum class State { closed, auth, finish, ready };
  bool receive_record(Kind kind, Bytes frame, uint64_t now);
  bool hub_auth(Bytes payload);
  bool finish(Bytes payload, uint64_t now);
  bool send(Packet &packet, Kind kind, Bytes payload);

  ControlPort &port_;
  State state_{State::closed};
  Framer framer_;
  Key ephemeral_;
  const Key *device_key_{};
  Pub controller_key_{};
  Packet pending_;
  std::array<uint8_t, hello_size> hello_{};
  Digest transcript_{};
  crypto::Secret to_hub_, to_device_;
  uint64_t started_{}, next_status_at_{};
  uint32_t latest_session_{}, tx_{}, rx_{}, sent_status_{}, acked_status_{};
};
} // namespace vp8_lan

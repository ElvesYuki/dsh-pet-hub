#pragma once
#include "media_auth_crypto.h"
#include "media_tail_timing.h"
#include "media_wire.h"
#include <algorithm>

namespace pet400_persist::media_auth {
using Identifier = std::array<uint8_t, 16>;
using Header = std::array<uint8_t, 16>;
using DeviceInit = std::array<uint8_t, 112>;
using Challenge = std::array<uint8_t, 80>;
using DeviceFinish = std::array<uint8_t, 48>;
using GrantBody = std::array<uint8_t, 116>;

enum class Mode : uint8_t { Repair = 1, Query = 2 };
enum class Type : uint8_t { Init = 1, Challenge = 2, Finish = 3, Grant = 16, Ptm = 17 };
struct Binding {
  Identifier device{}, controller{}, pairing{};
  uint64_t epoch = 0;
  bool operator==(const Binding &other) const {
    return device == other.device && controller == other.controller && pairing == other.pairing && epoch == other.epoch;
  }
};

struct Grant {
  Identifier decision{};
  Digest begin_sha{}, manifest_sha{}, index_sha{};
  uint32_t work_ms = 0;
};

namespace detail {
inline Header header(Type type, uint32_t sequence, uint32_t size) {
  Header bytes{};
  std::memcpy(bytes.data(), "PMA1", 4);
  bytes[4] = 1;
  bytes[5] = uint8_t(type);
  pet::put32(bytes.data() + 8, sequence);
  pet::put32(bytes.data() + 12, size);
  return bytes;
}
inline bool matches(Bytes bytes, Type type, uint32_t sequence, uint32_t size) {
  const auto expected = header(type, sequence, size);
  return bytes.size == expected.size() && bytes.valid() && !std::memcmp(bytes.data, expected.data(), expected.size());
}
}

// Device side of the proposal. The owner supplies a fresh nonce and previously
// paired identity/key. Once finish succeeds, send its proof before any record.
class DeviceSession {
  enum class State { New, Challenge, Records, Failed };
  State state_ = State::New;
  Mode mode_ = Mode::Repair;
  DeviceInit init_{};
  Digest transcript_{};
  crypto::Secret transmit_, receive_;
  uint32_t tx_seq_ = 0, rx_seq_ = 0;
  media_wire::Kind last_tx_{}, last_rx_{};
  bool granted_ = false;

  bool fail() {
    state_ = State::Failed;
    crypto::erase(transmit_.bytes);
    crypto::erase(receive_.bytes);
    return false;
  }

  bool outbound(media_wire::Kind kind) const {
    using K = media_wire::Kind;
    if (!tx_seq_) return kind == K::Hello;
    if (mode_ == Mode::Query) return last_tx_ == K::Hello && kind == K::Result;
    if (last_tx_ == K::Hello) return kind == K::Ready || kind == K::Result;
    return (last_tx_ == K::Ready || last_tx_ == K::Ack) && (kind == K::Ack || kind == K::Result);
  }

  bool inbound(media_wire::Kind kind) const {
    using K = media_wire::Kind;
    if (mode_ == Mode::Query) return !rx_seq_ && kind == K::Query;
    if (!granted_) return false;
    if (rx_seq_ == 1) return kind == K::Begin;
    if (last_rx_ == K::End) return kind == K::Cancel;
    return (last_rx_ == K::Begin || last_rx_ == K::Data) && (kind == K::Data || kind == K::End || kind == K::Cancel);
  }

  bool receive_tag(const Header &head, Type type, Bytes a, Bytes b, Bytes c, const Digest &tag) const {
    if (state_ != State::Records || rx_seq_ >= max_sequence || !a.valid() || !b.valid() || !c.valid() ||
        a.size > max_body || b.size > max_body || c.size > max_body) return false;
    const auto size = a.size + b.size + c.size;
    return size <= max_body && detail::matches(head, type, rx_seq_ + 1, uint32_t(size)) &&
      crypto::verify(receive_.bytes, {transcript_, head, a, b, c}, tag);
  }

public:
  static constexpr uint32_t max_sequence = 2048, max_work_ms = 30000;
  static constexpr size_t max_body = media_wire::header_bytes + media_wire::payload_max;

  DeviceSession() = default;
  DeviceSession(const DeviceSession &) = delete;
  DeviceSession &operator=(const DeviceSession &) = delete;

  bool begin(const Binding &binding, Mode mode, const Digest &fresh_nonce, DeviceInit &out) {
    out = {};
    if (state_ != State::New || !binding.epoch || (mode != Mode::Repair && mode != Mode::Query)) return fail();
    const auto head = detail::header(Type::Init, 0, 96);
    std::copy(head.begin(), head.end(), init_.begin());
    auto *body = init_.data() + head.size();
    std::memcpy(body, binding.device.data(), 16);
    std::memcpy(body + 16, binding.controller.data(), 16);
    std::memcpy(body + 32, binding.pairing.data(), 16);
    pet::put64(body + 48, binding.epoch);
    body[56] = uint8_t(mode);
    std::memcpy(body + 64, fresh_nonce.data(), fresh_nonce.size());
    mode_ = mode;
    state_ = State::Challenge;
    out = init_;
    return true;
  }

  bool finish(Bytes challenge, const Digest &paired_key, DeviceFinish &out) {
    out = {};
    if (state_ != State::Challenge || !challenge.valid() || challenge.size != Challenge{}.size() ||
        !detail::matches({challenge.data, Header{}.size()}, Type::Challenge, 0, 64) || !crypto::initialize() ||
        !crypto::sha256({init_, {challenge.data, 48}}, transcript_)) return fail();
    crypto::Secret proof;
    Digest received_proof;
    std::copy_n(challenge.data + 48, received_proof.size(), received_proof.begin());
    if (!crypto::hkdf(paired_key, transcript_, "PMA1/1/hub/proof", proof.bytes) ||
        !crypto::verify(proof.bytes, {transcript_}, received_proof) ||
        !crypto::hkdf(paired_key, transcript_, "PMA1/1/device/proof", proof.bytes) ||
        !crypto::tag(proof.bytes, {transcript_}, received_proof) ||
        !crypto::hkdf(paired_key, transcript_, "PMA1/1/device/record", transmit_.bytes) ||
        !crypto::hkdf(paired_key, transcript_, "PMA1/1/hub/record", receive_.bytes)) return fail();
    const auto head = detail::header(Type::Finish, 0, 32);
    std::copy(head.begin(), head.end(), out.begin());
    std::copy(received_proof.begin(), received_proof.end(), out.begin() + head.size());
    state_ = State::Records;
    return true;
  }

  const Digest &transcript() const { return transcript_; }
  void invalidate() { (void)fail(); }

  bool seal(Bytes frame, Header &head, Digest &tag) {
    head = {};
    tag = {};
    media_wire::Frame ptm;
    if (state_ != State::Records || tx_seq_ >= max_sequence || !frame.valid() ||
        frame.size < media_wire::header_bytes || frame.size > max_body ||
        !media_wire::decode(frame.data, media_wire::header_bytes, frame.data + media_wire::header_bytes,
                            frame.size - media_wire::header_bytes, ptm) || !outbound(ptm.header.kind)) return fail();
    const auto candidate = detail::header(Type::Ptm, tx_seq_ + 1, uint32_t(frame.size));
    if (!crypto::tag(transmit_.bytes, {transcript_, candidate, frame}, tag)) { tag = {}; return fail(); }
    head = candidate;
    ++tx_seq_;
    last_tx_ = ptm.header.kind;
    return true;
  }

  bool open_grant(const Header &head, const GrantBody &body, const Digest &tag, Grant &out) {
    out = {};
    if (mode_ != Mode::Repair || rx_seq_ || !receive_tag(head, Type::Grant, body, {}, {}, tag)) return fail();
    Grant candidate;
    std::copy_n(body.data(), 16, candidate.decision.begin());
    candidate.work_ms = pet::u32(body.data() + 112);
    if (candidate.decision == Identifier{} || !candidate.work_ms || candidate.work_ms > max_work_ms) return fail();
    std::copy_n(body.data() + 16, 32, candidate.begin_sha.begin());
    std::copy_n(body.data() + 48, 32, candidate.manifest_sha.begin());
    std::copy_n(body.data() + 80, 32, candidate.index_sha.begin());
    out = candidate;
    ++rx_seq_;
    granted_ = true;
    return true;
  }

  // Header, prefix and original transfer workspace may be discontiguous. A
  // control frame uses payload with an empty data span. Do not expose DATA
  // to the writer unless both the PMA1 tag and inner frame verify here.
  bool open_frame(const Header &head, const Header &ptm_head, Bytes payload, Bytes data,
                  const Digest &tag, media_wire::Kind &kind) {
    kind = {};
    if (!receive_tag(head, Type::Ptm, ptm_head, payload, data, tag)) return fail();
    media_wire::Header parsed;
    if (!media_wire::decode_header(ptm_head.data(), ptm_head.size(), parsed) || !inbound(parsed.kind)) return fail();
    if (parsed.kind == media_wire::Kind::Data) {
      std::array<uint8_t, media_wire::data_prefix> prefix;
      if (payload.size != prefix.size()) return fail();
      std::copy_n(payload.data, prefix.size(), prefix.begin());
      media_wire::Data block;
      if (!media_wire::decode_data(ptm_head.data(), ptm_head.size(), prefix, data.data, data.size, block)) return fail();
    } else {
      media_wire::Frame frame;
      if (data.size || !media_wire::decode(ptm_head.data(), ptm_head.size(), payload.data, payload.size, frame)) return fail();
    }
    ++rx_seq_;
    last_rx_ = kind = parsed.kind;
    return true;
  }
};

// A pre-armed, caller-local authorization. This is scoped to one binding, boot
// and exact authenticated BEGIN. The caller invokes it before RepairOwner.
class RepairPermit {
  const Binding binding_;
  const uint64_t boot_, arm_until_ms_;
  const Digest expected_begin_;
  const unsigned allowed_action_;
  uint64_t last_ms_ = 0, deadline_ms_ = 0;
  bool consumed_ = false, invalid_ = false;

public:
  RepairPermit(const Binding &binding, uint64_t boot, uint64_t arm_until_ms, const Digest &expected_begin,
               unsigned allowed_action = 0)
      :binding_(binding),boot_(boot),arm_until_ms_(arm_until_ms),expected_begin_(expected_begin),
       allowed_action_(allowed_action) {}
  RepairPermit(const RepairPermit &) = delete;
  RepairPermit &operator=(const RepairPermit &) = delete;

  bool consume(const Binding &binding, uint64_t boot, const Grant &grant, const Header &head, Bytes payload,
               uint64_t session_started_ms, uint64_t now_ms) {
    if (invalid_ || consumed_ || !boot_ || boot != boot_ || !(binding == binding_) || grant.decision == Identifier{} ||
        grant.begin_sha != expected_begin_ || !grant.work_ms || grant.work_ms > DeviceSession::max_work_ms) return false;
    if (now_ms < session_started_ms || grant.work_ms > UINT64_MAX - session_started_ms) {
      invalid_ = true;
      return false;
    }
    const auto deadline = std::min(arm_until_ms_, session_started_ms + grant.work_ms);
    if (now_ms >= deadline) { invalid_ = true; return false; }
    media_wire::Frame frame;
    Digest actual;
    if (!media_wire::decode(head.data(), head.size(), payload.data, payload.size, frame) ||
        frame.header.kind != media_wire::Kind::Begin || pet::get64(payload.data + 16) != boot ||
        (allowed_action_ && pet::u16(payload.data + 40) != allowed_action_) ||
        !crypto::sha256({head, payload}, actual) || actual != expected_begin_) return false;
    deadline_ms_ = deadline;
#if PET_PMA1_LAN_TIMING
    record_media_tail(MediaTail::PermitDeadline, deadline > UINT64_MAX / 1000 ? UINT64_MAX : deadline * 1000);
#endif
    last_ms_ = now_ms;
    consumed_ = true;
    return true;
  }

  bool live(uint64_t now_ms) {
    if (!consumed_ || invalid_) return false;
    if (now_ms < last_ms_ || now_ms >= deadline_ms_) { invalid_ = true; return false; }
    last_ms_ = now_ms;
    return true;
  }
};
} // namespace pet400_persist::media_auth

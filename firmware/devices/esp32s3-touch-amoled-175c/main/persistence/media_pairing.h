#pragma once
#include "media_auth.h"

namespace pet400_persist::media_auth::pairing {
enum class Type : uint8_t { Info = 1, Offer = 2, Confirm = 3, Cancel = 4, LanArm = 5, BindingInfo = 6, BindingChallenge = 7, BindingEnroll = 8, BindingResume = 9,
  State = 128, BindingStatus = 129, BindingNonce = 130, BindingActive = 131, BindingEnrolled = 132 };
enum class Phase : uint8_t { Empty, Pending, HostConfirmed, Active };
enum class Event : uint8_t { Ok, Rejected, TimedOut };
using Fingerprint = Identifier;
constexpr size_t header_bytes = 16, offer_bytes = 96, confirm_bytes = 28, state_bytes = 48;
constexpr size_t lan_arm_bytes = 180;

inline void erase(uint8_t *bytes, size_t count) {
  auto *out = static_cast<volatile uint8_t *>(bytes);
  for (size_t i = 0; i < count; ++i) out[i] = 0;
}

inline size_t request_length(Type type) {
  switch (type) {
    case Type::Info: return 0;
    case Type::Offer: return offer_bytes;
    case Type::Confirm:
    case Type::Cancel: return confirm_bytes;
    default: return SIZE_MAX;
  }
}

inline uint32_t checksum(const uint8_t *header, const uint8_t *body, size_t size) {
  return pet_fast::crc_update(pet_fast::crc_update(0, header, 12), body, size);
}

inline void seal(uint8_t *packet, Type type, size_t size) {
  std::memcpy(packet, "PBP1", 4);
  packet[4] = 1;
  packet[5] = uint8_t(type);
  packet[6] = packet[7] = 0;
  pet::put32(packet + 8, uint32_t(size));
  pet::put32(packet + 12, checksum(packet, packet + header_bytes, size));
}

inline size_t binding_request_length(Type type) {
  switch (type) {
    case Type::BindingInfo: return 0;
    case Type::BindingChallenge: return 1;
    case Type::BindingEnroll: return 173;
    case Type::BindingResume: return 100;
    default: return SIZE_MAX;
  }
}

template<bool AllowLanArm = false, bool AllowBinding = false> class BasicDecoder {
  std::array<uint8_t, header_bytes + (AllowLanArm || AllowBinding ? lan_arm_bytes : offer_bytes)> bytes_{};
  size_t used_ = 0, expected_ = header_bytes;
  uint64_t began_ = 0;

public:
  static constexpr uint64_t frame_us = 1000000;
  ~BasicDecoder() { clear(); }
  void clear() { erase(bytes_.data(), bytes_.size()); used_ = 0; expected_ = header_bytes; began_ = 0; }
  void expire(uint64_t now) {
    if (used_ && (now < began_ || now - began_ >= frame_us)) clear();
  }

  template<class Receive> void feed(const uint8_t *input, size_t count, uint64_t now, Receive receive) {
    expire(now);
    constexpr char magic[] = "PBP1";
    for (size_t i = 0; i < count; ++i) {
      const auto byte = input[i];
      if (used_ < 4 && byte != uint8_t(magic[used_])) {
        used_ = 0;
        if (byte != uint8_t(magic[0])) continue;
      }
      if (!used_) began_ = now;
      bytes_[used_++] = byte;
      const auto type = Type(bytes_[5]);
      if (used_ == header_bytes) {
        size_t body = AllowLanArm && type == Type::LanArm ? lan_arm_bytes : request_length(type);
        if constexpr (AllowBinding) {
          if (body == SIZE_MAX) body = binding_request_length(type);
        }
        if (bytes_[4] != 1 || bytes_[6] || bytes_[7] || body == SIZE_MAX || pet::u32(bytes_.data() + 8) != body) {
          clear();
          continue;
        }
        expected_ = header_bytes + body;
      }
      if (used_ == expected_) {
        const auto *body = bytes_.data() + header_bytes;
        const size_t size = expected_ - header_bytes;
        if (pet::u32(bytes_.data() + 12) == checksum(bytes_.data(), body, size)) receive(type, Bytes{body, size});
        clear();
      }
    }
  }
};
using Decoder = BasicDecoder<>;

struct State {
  uint64_t boot = 0;
  Identifier device{};
  uint32_t proposal = 0;
  Fingerprint fingerprint{};
  Phase phase = Phase::Empty;

  std::array<uint8_t, header_bytes + state_bytes> encode(Event event) const {
    std::array<uint8_t, header_bytes + state_bytes> packet{};
    auto *body = packet.data() + header_bytes;
    pet::put64(body, boot);
    std::memcpy(body + 8, device.data(), device.size());
    pet::put32(body + 24, proposal);
    std::memcpy(body + 28, fingerprint.data(), fingerprint.size());
    body[44] = uint8_t(phase);
    body[45] = uint8_t(event);
    seal(packet.data(), Type::State, state_bytes);
    return packet;
  }
};

class ShortClick {
  enum class Step { NeedRelease, Ready, Pressed };
  uint64_t sample_at_ = 0, stable_since_ = 0, pressed_at_ = 0;
  Step step_ = Step::NeedRelease;
  bool have_sample_ = false, sample_down_ = false;

public:
  static constexpr uint64_t debounce_us = 40000, sample_gap_us = 160000, max_press_us = 1000000;
  void reset() { have_sample_ = false; step_ = Step::NeedRelease; }
  bool update(bool down, uint64_t now) {
    if (have_sample_ && (now < sample_at_ || now - sample_at_ > sample_gap_us)) reset();
    sample_at_ = now;
    if (!have_sample_ || down != sample_down_) {
      have_sample_ = true;
      sample_down_ = down;
      stable_since_ = now;
      return false;
    }
    if (now - stable_since_ < debounce_us) return false;
    if (step_ == Step::NeedRelease) {
      if (!down) step_ = Step::Ready;
      return false;
    }
    if (step_ == Step::Ready) {
      if (down) { step_ = Step::Pressed; pressed_at_ = stable_since_; }
      return false;
    }
    if (down) {
      if (now - pressed_at_ > max_press_us) step_ = Step::NeedRelease;
      return false;
    }
    if (stable_since_ - pressed_at_ > max_press_us) { step_ = Step::Ready; return false; }
    reset();
    return true;
  }
};

class Credentials {
  State state_;
  Binding binding_{};
  crypto::Secret key_;
  uint32_t next_ = 0;
  uint64_t expires_ = 0, last_ = 0;
  ShortClick click_;

  void clear_pending() {
    crypto::erase(key_.bytes);
    binding_ = {};
    state_.proposal = 0;
    state_.fingerprint = {};
    state_.phase = Phase::Empty;
    click_.reset();
  }

  bool offer(Bytes body, uint64_t now) {
    if (state_.phase != Phase::Empty || next_ == UINT32_MAX || now > UINT64_MAX - offer_us ||
        pet::get64(body.data) != state_.boot) return false;
    Binding candidate;
    std::copy_n(body.data + 8, 16, candidate.device.begin());
    std::copy_n(body.data + 24, 16, candidate.controller.begin());
    std::copy_n(body.data + 40, 16, candidate.pairing.begin());
    candidate.epoch = pet::get64(body.data + 56);
    if (candidate.device != state_.device || candidate.controller == Identifier{} || candidate.pairing == Identifier{} ||
        !candidate.epoch) return false;

    std::copy_n(body.data + 64, key_.bytes.size(), key_.bytes.begin());
    constexpr char domain[] = "PBP1/fingerprint/v1";
    std::array<uint8_t, 12> scope{};
    pet::put64(scope.data(), state_.boot);
    pet::put32(scope.data() + 8, next_ + 1);
    Digest proof;
    if (key_.bytes == Digest{} || !crypto::tag(key_.bytes,
        {{reinterpret_cast<const uint8_t *>(domain), sizeof(domain) - 1}, scope, {body.data + 8, 56}}, proof)) {
      clear_pending();
      return false;
    }
    std::copy_n(proof.begin(), state_.fingerprint.size(), state_.fingerprint.begin());
    crypto::erase(proof);
    binding_ = candidate;
    state_.proposal = ++next_;
    state_.phase = Phase::Pending;
    expires_ = now + offer_us;
    last_ = now;
    return true;
  }

  bool match(Bytes body) const {
    return pet::get64(body.data) == state_.boot && pet::u32(body.data + 8) == state_.proposal &&
      !std::memcmp(body.data + 12, state_.fingerprint.data(), state_.fingerprint.size());
  }

public:
  static constexpr uint64_t offer_us = 60000000, confirm_us = 15000000;
  static constexpr uint64_t sample_gap_us = ShortClick::sample_gap_us;
  static constexpr uint64_t debounce_us = ShortClick::debounce_us;
  Credentials(uint64_t boot, const Identifier &device) { state_.boot = boot; state_.device = device; }
  const State &state() const { return state_; }
  bool pending() const { return state_.phase == Phase::Pending || state_.phase == Phase::HostConfirmed; }
  bool expire(uint64_t now) {
    if (!pending()) return false;
    if (now < last_ || now >= expires_) { clear_pending(); return true; }
    last_ = now;
    return false;
  }
  void disconnect() { if (pending()) clear_pending(); }

  Event command(Type type, Bytes body, uint64_t now) {
    const auto length = request_length(type);
    if (!state_.boot || state_.device == Identifier{} || !body.valid() || length == SIZE_MAX || length != body.size)
      return Event::Rejected;
    if (expire(now)) return Event::TimedOut;
    if (type == Type::Info) return Event::Ok;
    if (type == Type::Offer) return offer(body, now) ? Event::Ok : Event::Rejected;
    if (!pending() || !match(body)) return Event::Rejected;
    if (type == Type::Cancel) { clear_pending(); return Event::Ok; }
    if (type == Type::Confirm && state_.phase == Phase::Pending) {
      state_.phase = Phase::HostConfirmed;
      expires_ = now + std::min(expires_ - now, confirm_us);
      click_.reset();
      return Event::Ok;
    }
    return Event::Rejected;
  }

  // Called only after the confirmed prompt has been drawn. Require a stable
  // release, a new press, and a stable release within the short-click window.
  bool button(bool down, uint64_t now) {
    if (expire(now) || state_.phase != Phase::HostConfirmed) return false;
    if (!click_.update(down, now)) return false;
    state_.phase = Phase::Active;
    return true;
  }

  // Only the verified persistent resume path may call this.
  void activate(const Binding &binding, const Digest &key, uint32_t proposal, const Fingerprint &fingerprint) {
    binding_ = binding;
    key_.bytes = key;
    state_.proposal = proposal;
    state_.fingerprint = fingerprint;
    state_.phase = Phase::Active;
  }
  void revoke() { clear_pending(); }

  const Binding *active() const { return state_.phase == Phase::Active ? &binding_ : nullptr; }
  bool load(const Binding &wanted, Digest &out) const {
    if (!active() || !(wanted == binding_)) { crypto::erase(out); return false; }
    out = key_.bytes;
    return true;
  }
};

class NoncePool {
  std::array<Digest, 16> nonces_{};
  size_t next_ = nonces_.size();
  bool prepared_ = false;

public:
  template<class Fill> bool prepare(Fill fill) {
    if (prepared_) return false;
    prepared_ = true;
    for (size_t i = 0; i < nonces_.size(); ++i) {
      auto &nonce = nonces_[i];
      fill(nonce.data(), nonce.size());
      if (nonce == Digest{} || std::find(nonces_.begin(), nonces_.begin() + i, nonce) != nonces_.begin() + i) {
        for (auto &key : nonces_) crypto::erase(key);
        return false;
      }
    }
    next_ = 0;
    return true;
  }
  bool take(Digest &out) {
    if (next_ == nonces_.size()) { out = {}; return false; }
    out = nonces_[next_];
    crypto::erase(nonces_[next_++]);
    return true;
  }
};
} // namespace pet400_persist::media_auth::pairing

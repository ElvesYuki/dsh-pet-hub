#pragma once

#include <array>
#include <cstddef>
#include <cstdint>
#include <optional>
#include <span>

namespace vp8_control {
constexpr size_t frame_size = 24;
constexpr uint32_t maximum_ttl_ms = 30000;
constexpr uint64_t lease_ms = 15000;
using Frame = std::array<uint8_t, frame_size>;

enum class Kind : uint8_t {
  play = 1, ping = 2,
  accepted = 128, presented, missing, superseded, expired, pong, duplicate, cancelled,
};

struct Ticket {
  uint32_t session{}, sequence{};
  uint16_t role{}, action{};
  bool operator==(const Ticket &) const = default;
};

struct Message {
  Kind kind{};
  Ticket ticket{};
  uint32_t value{};
  bool operator==(const Message &) const = default;
};

bool encode(const Message &message, Frame &frame);
std::optional<Message> decode(const Frame &frame);

// Single-owner core. The caller provides an authenticated session identifier
// and forwards a presentation only after the matching first DMA completion.
class Control {
 public:
  bool begin_verified(uint32_t session, uint64_t now_ms);
  void close();
  bool tick(uint64_t now_ms);
  bool renew_verified(uint64_t now_ms);
  bool receive(std::span<const uint8_t> bytes, uint64_t now_ms);
  std::optional<Ticket> claim(uint64_t now_ms, bool local_busy);
  bool missing(const Ticket &ticket, uint64_t now_ms);
  bool cancel(const Ticket &ticket, uint64_t now_ms);
  bool presented(const Ticket &ticket, uint64_t now_ms, uint32_t display_sequence);
  std::optional<Message> pop();
  bool connected() const { return session_ != 0; }
  uint32_t session() const { return session_; }
  bool waiting() const { return pending_.has_value(); }
  bool owns(const Ticket &ticket) const { return in_flight_ && in_flight_->ticket == ticket; }

 private:
  struct Request {
    Ticket ticket;
    uint64_t received_at;
    uint32_t ttl_ms;
  };
  bool receive_frame(uint64_t now_ms);
  bool finish(const Ticket &ticket, uint64_t now_ms, Kind kind, uint32_t value = 0);
  bool emit(Kind kind, const Ticket &ticket, uint32_t value = 0);

  Frame input_{};
  size_t input_size_{};
  std::array<Message, 8> output_{};
  size_t first_{}, count_{};
  std::optional<Request> pending_, in_flight_;
  Message last_request_{};
  uint32_t session_{}, latest_session_{}, last_display_sequence_{};
  uint64_t now_{}, last_rx_{};
};
} // namespace vp8_control

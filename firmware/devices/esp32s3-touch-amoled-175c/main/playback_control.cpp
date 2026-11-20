#include "playback_control.h"
#include "pet_asset.h"

#include <algorithm>

namespace vp8_control {
static_assert(sizeof(Control) <= 384);

namespace {
constexpr std::array<uint8_t, 5> prefix{'V', 'P', 'C', '1', 1};

bool valid(const Message &message) {
  const auto &ticket = message.ticket;
  if (!ticket.session || !ticket.sequence || ticket.role == UINT16_MAX || ticket.action == UINT16_MAX) return false;
  switch (message.kind) {
    case Kind::play: return message.value && message.value <= maximum_ttl_ms;
    case Kind::ping: case Kind::pong: return !ticket.role && !ticket.action && !message.value;
    case Kind::presented: return message.value != 0;
    case Kind::accepted: case Kind::missing: case Kind::superseded: case Kind::expired:
    case Kind::duplicate: case Kind::cancelled: return message.value == 0;
  }
  return false;
}
} // namespace

bool encode(const Message &message, Frame &frame) {
  if (!valid(message)) return false;
  frame = {};
  std::copy(prefix.begin(), prefix.end(), frame.begin());
  frame[5] = uint8_t(message.kind);
  pet::put32(frame.data() + 8, message.ticket.session);
  pet::put32(frame.data() + 12, message.ticket.sequence);
  pet::put32(frame.data() + 16, uint32_t(message.ticket.role) | uint32_t(message.ticket.action) << 16);
  pet::put32(frame.data() + 20, message.value);
  return true;
}

std::optional<Message> decode(const Frame &frame) {
  if (!std::equal(prefix.begin(), prefix.end(), frame.begin()) || frame[6] || frame[7]) return std::nullopt;
  const uint32_t key = pet::u32(frame.data() + 16);
  const Message message{Kind(frame[5]), {pet::u32(frame.data() + 8), pet::u32(frame.data() + 12),
      uint16_t(key), uint16_t(key >> 16)}, pet::u32(frame.data() + 20)};
  if (!valid(message)) return std::nullopt;
  return message;
}

bool Control::begin_verified(uint32_t session, uint64_t now_ms) {
  if (!session || session <= latest_session_ || now_ms < now_) return false;
  close();
  session_ = latest_session_ = session;
  last_rx_ = now_ = now_ms;
  return true;
}

void Control::close() {
  session_ = 0;
  input_size_ = first_ = count_ = 0;
  last_request_ = {};
  pending_.reset();
  in_flight_.reset();
}

bool Control::emit(Kind kind, const Ticket &ticket, uint32_t value) {
  if (count_ == output_.size()) {
    close();
    return false;
  }
  output_[(first_ + count_) % output_.size()] = {kind, ticket, value};
  ++count_;
  return true;
}

std::optional<Message> Control::pop() {
  if (!count_) return std::nullopt;
  const auto reply = output_[first_];
  first_ = (first_ + 1) % output_.size();
  --count_;
  return reply;
}

bool Control::tick(uint64_t now_ms) {
  if (!connected()) return false;
  if (now_ms < now_) {
    close();
    return false;
  }
  now_ = now_ms;
  if (now_ms - last_rx_ >= lease_ms) {
    close();
    return false;
  }
  for (auto *request : {&pending_, &in_flight_}) {
    if (!*request || now_ms - (*request)->received_at < (*request)->ttl_ms) continue;
    const auto ticket = (*request)->ticket;
    request->reset();
    if (!emit(Kind::expired, ticket)) return false;
  }
  return true;
}

bool Control::renew_verified(uint64_t now_ms) {
  if (!tick(now_ms)) return false;
  last_rx_ = now_ms;
  return true;
}

bool Control::receive(std::span<const uint8_t> bytes, uint64_t now_ms) {
  if (!tick(now_ms)) return false;
  while (!bytes.empty()) {
    const auto size = std::min(bytes.size(), input_.size() - input_size_);
    std::copy_n(bytes.begin(), size, input_.begin() + input_size_);
    input_size_ += size;
    bytes = bytes.subspan(size);
    if (input_size_ != input_.size()) continue;
    input_size_ = 0;
    if (!receive_frame(now_ms)) {
      close();
      return false;
    }
  }
  return true;
}

bool Control::receive_frame(uint64_t now_ms) {
  const auto input = decode(input_);
  if (!input || input->ticket.session != session_ || (input->kind != Kind::play && input->kind != Kind::ping))
    return false;
  const auto &ticket = input->ticket;
  if (ticket.sequence < last_request_.ticket.sequence) return false;
  if (ticket.sequence == last_request_.ticket.sequence)
    return *input == last_request_ && emit(Kind::duplicate, ticket);
  last_request_ = *input;
  last_rx_ = now_ms;
  if (input->kind == Kind::ping) return emit(Kind::pong, ticket);
  if (pending_ && !emit(Kind::superseded, pending_->ticket)) return false;
  if (in_flight_ && !emit(Kind::superseded, in_flight_->ticket)) return false;
  in_flight_.reset();
  pending_ = Request{ticket, now_ms, input->value};
  return emit(Kind::accepted, ticket);
}

std::optional<Ticket> Control::claim(uint64_t now_ms, bool local_busy) {
  if (!tick(now_ms) || local_busy || !pending_) return std::nullopt;
  in_flight_ = pending_;
  pending_.reset();
  return in_flight_->ticket;
}

bool Control::finish(const Ticket &ticket, uint64_t now_ms, Kind kind, uint32_t value) {
  if (!tick(now_ms) || !owns(ticket)) return false;
  in_flight_.reset();
  return emit(kind, ticket, value);
}

bool Control::missing(const Ticket &ticket, uint64_t now_ms) {
  return finish(ticket, now_ms, Kind::missing);
}
bool Control::cancel(const Ticket &ticket, uint64_t now_ms) {
  return finish(ticket, now_ms, Kind::cancelled);
}
bool Control::presented(const Ticket &ticket, uint64_t now_ms, uint32_t display_sequence) {
  if (display_sequence <= last_display_sequence_ ||
      !finish(ticket, now_ms, Kind::presented, display_sequence)) return false;
  last_display_sequence_ = display_sequence;
  return true;
}
} // namespace vp8_control

#pragma once
// Shared P0 contract; included only by the explicit P1 firmware candidate.
#include <atomic>
#include <cstdint>
#include <limits>

namespace round_touch_event_model {
constexpr uint32_t max_pending = 64; // Software budget, not controller FIFO.
enum class Domain : uint32_t { None, Initialization, Ownership, Contract, Overflow, Read };
struct Error {
  Domain domain = Domain::None;
  int32_t code = 0;
};
enum class Contact : uint32_t { Unknown, Up, Down };
enum class Edge : uint32_t { None, Press, Release };
enum class Decision : uint32_t { NotReady, Read, Error, Stopped };
enum class Completion : uint32_t { Valid, Error, Cancelled };
inline bool pending_over_budget(uint32_t produced, uint32_t consumed) {
  return uint32_t(produced - consumed) > max_pending;
}

// Exactly one non-reentrant producer (future ISR). Never reset while active.
// A complete 2^32 lap between observations cannot be detected: integration
// must bound IRQ rate and consumer inactivity; half-lap/64+ deltas fail below.
class Counter {
 public:
  explicit Counter(uint32_t origin = 0) : origin_(origin), produced_(origin) {}
  void edge() noexcept {
    const auto old = produced_.load(std::memory_order_relaxed);
    produced_.store(old + 1, std::memory_order_release);
  }
  uint32_t load() const noexcept { return produced_.load(std::memory_order_acquire); }
  uint32_t origin() const noexcept { return origin_; }
 private:
  const uint32_t origin_;
  std::atomic<uint32_t> produced_;
};

struct Ticket {
  uint32_t generation = 0, sequence = 0;
  uint64_t id = 0;
  bool operator==(const Ticket &b) const {
    return generation == b.generation && sequence == b.sequence && id == b.id;
  }
};
struct Poll {
  Decision decision = Decision::Error;
  Ticket ticket{};
  Error error{};
};
struct Result {
  Completion completion = Completion::Error;
  Edge edge = Edge::None;
  bool publish = false, pressed = false;
  Error error{};
  int32_t io_error = 0; // Preserved even for a cancelled late completion.
};
struct Snapshot {
  uint32_t generation = 0, produced = 0, consumed = 0, startup_discarded = 0;
  uint32_t polls = 0, no_event = 0, error_polls = 0, stopped_polls = 0;
  uint32_t reads = 0, completed = 0, valid = 0, read_errors = 0;
  uint32_t cancelled = 0, suppressed = 0, coalesced = 0;
  uint32_t presses = 0, releases = 0;
  int32_t first_read_error = 0;
  bool armed = false, stopped = false, in_flight = false;
  Contact contact = Contact::Unknown;
  Error fault{};
};

// One worker owns this object. snapshot() is worker-only: cross-core coherent
// publication and GPIO/owner binding are P1 work, not provided by this model.
class Consumer {
 public:
  Consumer(Counter &counter, uint32_t generation) : source_(counter) {
    state_.generation = generation;
  }
  Consumer(const Consumer &) = delete;
  Consumer &operator=(const Consumer &) = delete;

  bool arm(int32_t initialization_error, bool owner_registered) {
    if (state_.armed || state_.stopped || faulted()) {
      fail(Domain::Contract, 1);
      return false;
    }
    if (initialization_error) {
      fail(Domain::Initialization, initialization_error);
      return false;
    }
    if (!owner_registered || !state_.generation) {
      fail(Domain::Ownership, 1);
      return false;
    }
    const auto now = source_.load();
    const auto startup = uint32_t(now - source_.origin());
    if (startup >= 0x80000000u) {
      fail(Domain::Overflow, 1);
      return false;
    }
    state_.startup_discarded = startup;
    state_.consumed = now;
    state_.armed = true;
    return true;
  }

  Poll poll() {
    ++state_.polls;
    if (faulted()) return error_poll();
    if (state_.stopped) {
      ++state_.stopped_polls;
      return {Decision::Stopped, {}, {}};
    }
    if (!state_.armed || state_.in_flight) {
      fail(Domain::Contract, 2);
      return error_poll();
    }
    const auto now = source_.load();
    const auto delta = uint32_t(now - state_.consumed);
    if (pending_over_budget(now, state_.consumed)) {
      fail(Domain::Overflow, 2);
      return error_poll();
    }
    if (!delta) {
      ++state_.no_event;
      return {Decision::NotReady, {}, {}};
    }
    if (next_id_ == std::numeric_limits<uint64_t>::max()) {
      fail(Domain::Overflow, 3);
      return error_poll();
    }
    active_ = {state_.generation, now, ++next_id_};
    state_.in_flight = true;
    ++state_.reads;
    return {Decision::Read, active_, {}};
  }

  // error==0 means the caller's original decoder/point API passed; this
  // model never changes the AB rule or interprets the controller's bytes.
  Result complete(Ticket ticket, int32_t error, bool pressed) {
    if (!state_.in_flight || !(ticket == active_)) {
      fail(Domain::Contract, 3);
      return {Completion::Error, Edge::None, false, false, state_.fault, error};
    }
    state_.in_flight = false;
    ++state_.completed;
    if (error) {
      ++state_.read_errors;
      if (!state_.first_read_error) state_.first_read_error = error;
      fail(Domain::Read, error);
    }
    if (state_.stopped) {
      ++state_.cancelled;
      return {Completion::Cancelled, Edge::None, false, false, state_.fault, error};
    }
    if (faulted()) {
      ++state_.suppressed;
      return {Completion::Error, Edge::None, false, false, state_.fault, error};
    }
    const auto represented = uint32_t(ticket.sequence - state_.consumed);
    state_.coalesced += represented - 1;
    state_.consumed = ticket.sequence; // Never clear events that arrived in I/O.
    ++state_.valid;
    Edge edge = Edge::None;
    if (pressed && state_.contact != Contact::Down) {
      edge = Edge::Press;
      ++state_.presses;
    } else if (!pressed && state_.contact == Contact::Down) {
      edge = Edge::Release;
      ++state_.releases;
    }
    state_.contact = pressed ? Contact::Down : Contact::Up;
    return {Completion::Valid, edge, true, pressed, {}, 0};
  }

  // Normal stop does not erase contact history or pending I/O. Caller must
  // drain an active ticket and quiesce the real ISR before destroying objects.
  void stop() { state_.stopped = true; }
  bool drained() const { return state_.stopped && !state_.in_flight; }
  Snapshot snapshot() const {
    auto out = state_;
    out.produced = source_.load();
    return out;
  }

 private:
  bool faulted() const { return state_.fault.domain != Domain::None; }
  void fail(Domain domain, int32_t code) {
    if (!faulted()) state_.fault = {domain, code};
  }
  Poll error_poll() {
    ++state_.error_polls;
    return {Decision::Error, {}, state_.fault};
  }
  Counter &source_;
  Snapshot state_{};
  Ticket active_{};
  uint64_t next_id_ = 0;
};
} // namespace round_touch_event_model

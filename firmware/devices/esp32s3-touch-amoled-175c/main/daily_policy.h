#pragma once

#include <cstdint>
#include <atomic>

namespace vp8_daily {
constexpr unsigned idle = 0, wave = 1, first_auto = 2, second_auto = 3;

struct Policy {
  unsigned idle_loops = 0;
  unsigned next(unsigned index, bool touch, uint32_t entropy) {
    if (touch && index != wave) {
      idle_loops = 0;
      return wave;
    }
    if (index != idle) return idle;
    if (++idle_loops < 3) return idle;
    idle_loops = 0;
    return entropy & 1 ? first_auto : second_auto;
  }
};

struct TouchEdge {
  bool down = false;
  int64_t last = -250000;
  bool observe(bool valid, bool pressed, int64_t now) {
    if (!valid) return false;
    const bool rising = pressed && !down && now - last >= 250000;
    down = pressed;
    if (rising) last = now;
    return rising;
  }
};

// Only a frame that claimed the panel before cancellation may continue.
class FrameGate {
  enum class State : uint8_t { Ready, InFlight, Cancelled };
  std::atomic<State> state{State::Ready};
public:
  bool cancelled() const { return state.load() == State::Cancelled; }
  void cancel() { state.store(State::Cancelled); }
  bool begin() {
    auto expected = State::Ready;
    return state.compare_exchange_strong(expected, State::InFlight);
  }
  void end() {
    auto expected = State::InFlight;
    state.compare_exchange_strong(expected, State::Ready);
  }
};
}  // namespace vp8_daily

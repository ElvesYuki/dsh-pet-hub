#pragma once

#include "device_tcp_session.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include <atomic>
#include <mutex>

namespace vp8_lan {
struct Target {
  std::array<uint8_t, 4> ip{};
  uint16_t port{};
};

// OTA worker publishes the route and identity. One low-priority task owns the
// NVS key and socket. ControlPort calls accepting() only from that task.
class Device {
 public:
  explicit Device(ControlPort &port) : port_(port) {}
  bool start();
  bool arm(const Identity &identity, uint64_t boot, Target target);
  void disarm();
  std::optional<Target> target();
  void publish_route(const Identity &identity, bool ready);
  bool accepting() const;

 private:
  struct Profile {
    Identity identity;
    uint64_t boot{};
    Target target;
  };
  static void worker(void *self);
  void run();

  ControlPort &port_;
  std::mutex mutex_;
  std::optional<Profile> profile_;
  std::atomic<uint32_t> revision_{1}, route_{1};
  std::atomic<bool> ready_{};
  TaskHandle_t task_{};
  uint32_t active_revision_{}, active_route_{};
};
} // namespace vp8_lan

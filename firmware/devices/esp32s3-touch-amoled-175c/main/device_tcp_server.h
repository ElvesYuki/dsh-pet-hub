#pragma once

#include "device_tcp_session.h"
#include "device_lan_candidates.h"
#include "esp_netif.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include <atomic>
#include <mutex>

namespace vp8_lan {
struct DiscoveryLink {
  esp_netif_t *interface{};
  Subnet subnet;
  bool operator==(const DiscoveryLink &) const = default;
};

// OTA worker publishes the route and identity. One low-priority task owns the
// NVS key and socket. ControlPort calls accepting() only from that task.
class Device {
 public:
  explicit Device(ControlPort &port) : port_(port) {}
  bool start();
  bool arm(const Identity &identity, uint64_t boot, Target target);
  enum class DiscoveryResult { enabled, disabled, unavailable, storage_failed };
  DiscoveryResult discovery(const Identity &identity, uint64_t boot, std::optional<Digest> key_hash);
  struct DiscoveryStats {
    uint32_t queries, completed, errors, hits, dials, cached, tcp, authenticated;
  };
  DiscoveryStats discovery_stats() const;
  void restore_discovery(const Identity &identity, uint64_t boot);
  void disarm();
  std::optional<Target> target();
  void publish_route(const Identity &identity, bool ready, DiscoveryLink link = {});
  bool accepting() const;

 private:
  struct Profile {
    Identity identity;
    uint64_t boot{};
    Target target{};
    std::optional<Digest> discovery;
  };
  bool replace(Profile profile);
  static void worker(void *self);
  void run();

  ControlPort &port_;
  std::mutex mutex_;
  std::optional<Profile> profile_;
  DiscoveryLink discovery_link_;
  std::atomic<uint32_t> revision_{1}, route_{1};
  std::atomic<bool> ready_{};
  std::atomic<uint32_t> queries_{}, completed_{}, errors_{}, hits_{}, dials_{}, cached_{}, tcp_{}, authenticated_{};
  TaskHandle_t task_{};
  uint32_t active_revision_{}, active_route_{};
};
} // namespace vp8_lan

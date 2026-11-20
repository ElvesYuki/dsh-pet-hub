#include "device_tcp_server.h"
#include "device_tcp_socket.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "nvs.h"
#include <cstdio>
#include <fcntl.h>
#include <unistd.h>

namespace vp8_lan {
namespace {
constexpr char nvs_namespace[] = "vp8_vpl1";
constexpr char nvs_key[] = "identity_v1";
constexpr uint64_t connect_limit_ms = 4000;
constexpr uint64_t retry_ms = 3000;
constexpr unsigned stack_bytes = 6144;
constexpr uint32_t tick_ms = 20;

struct NvsHandle {
  nvs_handle_t handle{};
  ~NvsHandle() { if (handle) nvs_close(handle); }
};
struct StoredIdentity {
  Digest scope{};
  crypto::Secret scalar;
};
static_assert(sizeof(StoredIdentity) == 64);

bool load_device_key(const Identity &identity, Key &key, Pub &public_key) {
  std::array<uint8_t, 88> scope{};
  Digest digest{};
  if (!identity.scope(scope) || !crypto::sha256({scope}, digest)) return false;
  NvsHandle nvs;
  if (nvs_open(nvs_namespace, NVS_READWRITE, &nvs.handle) != ESP_OK) return false;
  StoredIdentity entry;
  size_t size = sizeof(entry);
  const auto found = nvs_get_blob(nvs.handle, nvs_key, &entry, &size);
  if (found != ESP_ERR_NVS_NOT_FOUND && (found != ESP_OK || size != sizeof(entry))) return false;
  if (found == ESP_OK && entry.scope == digest)
    return key.import_signing(entry.scalar.bytes) && key.public_key(public_key);

  // Generated and persisted only after explicit USB ARM. The runtime PSA
  // key is reimported without export usage. The legacy bound controller is untouched.
  entry.scope = digest;
  if (!key.generate(true, true) || !key.export_private(entry.scalar.bytes) ||
      !key.import_signing(entry.scalar.bytes) || !key.public_key(public_key) ||
      nvs_set_blob(nvs.handle, nvs_key, &entry, sizeof(entry)) != ESP_OK || nvs_commit(nvs.handle) != ESP_OK)
    return false;
  StoredIdentity check;
  size = sizeof(check);
  return nvs_get_blob(nvs.handle, nvs_key, &check, &size) == ESP_OK && size == sizeof(check) &&
         entry.scope == check.scope && entry.scalar.bytes == check.scalar.bytes;
}

int dial(const Target &target) {
  const int fd = ::socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
  if (fd < 0) return -1;
  sockaddr_in address{};
  address.sin_family = AF_INET;
  address.sin_port = htons(target.port);
  std::copy(target.ip.begin(), target.ip.end(), reinterpret_cast<uint8_t *>(&address.sin_addr.s_addr));
  if (fcntl(fd, F_SETFL, O_NONBLOCK) == 0 &&
      (::connect(fd, reinterpret_cast<sockaddr *>(&address), sizeof(address)) == 0 || errno == EINPROGRESS))
    return fd;
  ::close(fd);
  return -1;
}

// -1 failed, 0 pending, 1 ready.
int connection(int fd) {
  fd_set writable;
  FD_ZERO(&writable);
  FD_SET(fd, &writable);
  timeval wait{};
  const int ready = ::select(fd + 1, nullptr, &writable, nullptr, &wait);
  if (!ready) return 0;
  int error{};
  socklen_t n = sizeof(error);
  return ready < 0 || getsockopt(fd, SOL_SOCKET, SO_ERROR, &error, &n) != 0 || error ? -1 : 1;
}

void report_key(const Pub &key) {
  constexpr char digits[] = "0123456789abcdef";
  char out[2 * Pub{}.size() + 1]{};
  for (size_t i = 0; i < key.size(); ++i) {
    out[2 * i] = digits[key[i] >> 4];
    out[2 * i + 1] = digits[key[i] & 15];
  }
  printf("@VP8_VPCNET1 ARMED key=%s\n", out);
}
} // namespace

bool Device::start() {
  return xTaskCreatePinnedToCore(worker, "vp8_vpl1", stack_bytes, this, tskIDLE_PRIORITY, &task_, 1) == pdPASS;
}

bool Device::arm(const Identity &identity, uint64_t boot, Target target) {
  if (!task_ || !identity.valid() || !boot || !target.port || revision_.load() == UINT32_MAX) return false;
  {
    std::lock_guard lock(mutex_);
    ready_.store(false);
    profile_ = Profile{identity, boot, target};
    ++revision_;
  }
  port_.close();
  xTaskNotifyGive(task_);
  return true;
}

void Device::disarm() {
  {
    std::lock_guard lock(mutex_);
    ready_.store(false);
    profile_.reset();
    if (revision_.load() < UINT32_MAX) ++revision_;
  }
  port_.close();
  if (task_) xTaskNotifyGive(task_);
}

std::optional<Target> Device::target() {
  std::lock_guard lock(mutex_);
  if (profile_) return profile_->target;
  return std::nullopt;
}

void Device::publish_route(const Identity &identity, bool ready) {
  bool invalidate = false;
  bool changed = false;
  {
    std::lock_guard lock(mutex_);
    if (profile_ && profile_->identity != identity) {
      profile_.reset();
      if (revision_.load() < UINT32_MAX) ++revision_;
      invalidate = true;
    }
    const bool route_up = profile_ && ready && route_.load() < UINT32_MAX;
    const bool was_ready = ready_.exchange(route_up);
    changed = was_ready != route_up;
    if (was_ready && !route_up) {
      ++route_;
      invalidate = true;
    }
  }
  if (invalidate) port_.close();
  if (task_ && (changed || invalidate)) xTaskNotifyGive(task_);
}

bool Device::accepting() const {
  return ready_.load() && revision_.load() == active_revision_ && route_.load() == active_route_;
}

void Device::worker(void *self) { static_cast<Device *>(self)->run(); }

void Device::run() {
  Key key;
  Session session(port_);
  Socket io;
  uint64_t next_dial{}, deadline{};
  bool has_key = false, connecting = false;
  int fd = -1;
  std::optional<Profile> profile;
  const auto disconnect = [&] {
    session.close();
    io.reset();
    if (fd >= 0) ::close(fd);
    fd = -1;
    connecting = false;
  };
  for (;;) {
    const uint64_t now = uint64_t(esp_timer_get_time() / 1000);
    if (active_revision_ != revision_.load()) {
      disconnect();
      key.clear();
      has_key = false;
      {
        std::lock_guard lock(mutex_);
        active_revision_ = revision_.load();
        profile = profile_;
      }
      if (profile) {
        Pub point{};
        has_key = load_device_key(profile->identity, key, point);
        if (active_revision_ == revision_.load()) {
          if (has_key) report_key(point);
          else puts("@VP8_VPCNET1 KEY_UNAVAILABLE");
        }
      }
      next_dial = now;
    }
    if (!accepting()) {
      disconnect();
      active_route_ = route_.load();
    }
    if (profile && has_key && accepting()) {
      if (fd < 0 && now >= next_dial) {
        fd = dial(profile->target);
        connecting = fd >= 0;
        deadline = now + connect_limit_ms;
        next_dial = now + retry_ms;
      }
      if (connecting) {
        const int result = connection(fd);
        if (result < 0 || now >= deadline) disconnect();
        else if (result > 0) {
          connecting = false;
          if (!session.start(profile->identity, key, profile->boot, now)) disconnect();
        }
      } else if (fd >= 0 && !io.step(fd, session, now)) {
        disconnect();
        next_dial = now + retry_ms;
      }
    }
    if (!profile || !has_key || !accepting()) {
      ulTaskNotifyTake(pdTRUE, portMAX_DELAY);
    } else {
      const auto current = uint64_t(esp_timer_get_time() / 1000);
      const auto delay = fd < 0 && next_dial > current ? next_dial - current : tick_ms;
      ulTaskNotifyTake(pdTRUE, std::max(TickType_t(1), pdMS_TO_TICKS(delay)));
    }
  }
}
} // namespace vp8_lan

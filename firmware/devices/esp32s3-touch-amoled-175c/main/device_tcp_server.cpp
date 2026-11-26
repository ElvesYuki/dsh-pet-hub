#include "device_tcp_server.h"
#include "device_lan_discovery.h"
#include "device_tcp_socket.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "nvs.h"
#include <cstdio>
#include <cstring>
#include <fcntl.h>
#include <unistd.h>

namespace vp8_lan {
namespace {
constexpr char nvs_namespace[] = "vp8_vpl1";
constexpr char nvs_key[] = "identity_v1";
constexpr char discovery_key[] = "discovery";
constexpr uint64_t connect_limit_ms = 4000;
constexpr uint64_t retry_ms = 3000;
constexpr uint64_t candidate_delay_ms = 200;
constexpr uint64_t discovery_retry_limit_ms = 30000;
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
struct StoredDiscovery {
  uint8_t version{1};
  Digest scope{}, key_hash{};
  bool operator==(const StoredDiscovery &) const = default;
};
static_assert(sizeof(StoredDiscovery) == 65);

bool identity_digest(const Identity &identity, Digest &digest) {
  std::array<uint8_t, 88> scope{};
  return identity.scope(scope) && crypto::sha256({scope}, digest);
}

bool load_device_key(const Identity &identity, Key &key, Pub &public_key, bool allow_create) {
  Digest digest{};
  if (!identity_digest(identity, digest)) return false;
  NvsHandle nvs;
  if (nvs_open(nvs_namespace, allow_create ? NVS_READWRITE : NVS_READONLY, &nvs.handle) != ESP_OK) return false;
  StoredIdentity entry;
  size_t size = sizeof(entry);
  const auto found = nvs_get_blob(nvs.handle, nvs_key, &entry, &size);
  if (found != ESP_ERR_NVS_NOT_FOUND && (found != ESP_OK || size != sizeof(entry))) return false;
  if (found == ESP_OK && entry.scope == digest)
    return key.import_signing(entry.scalar.bytes) && key.public_key(public_key);
  if (!allow_create) return false;

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

bool key_matches(const Pub &point, const Digest &expected) {
  Digest hash{};
  return crypto::sha256({point}, hash) && hash == expected;
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
  return target.port && replace(Profile{identity, boot, target, std::nullopt});
}

bool Device::replace(Profile profile) {
  if (!task_ || !profile.identity.valid() || !profile.boot || revision_.load() == UINT32_MAX) return false;
  {
    std::lock_guard lock(mutex_);
    ready_.store(false);
    profile_ = profile;
    ++revision_;
  }
  port_.close();
  xTaskNotifyGive(task_);
  return true;
}

Device::DiscoveryResult Device::discovery(const Identity &identity, uint64_t boot, std::optional<Digest> key_hash) {
  using Result = DiscoveryResult;
  StoredDiscovery record;
  if (!task_ || !boot || !identity_digest(identity, record.scope)) return Result::unavailable;
  if (key_hash) {
    Pub point{};
    Key key;
    if (!load_device_key(identity, key, point, false) || !key_matches(point, *key_hash)) return Result::unavailable;
    record.key_hash = *key_hash;
  } else disarm();

  NvsHandle nvs;
  if (nvs_open(nvs_namespace, NVS_READWRITE, &nvs.handle) != ESP_OK) return Result::storage_failed;
  if (!key_hash) {
    const auto erased = nvs_erase_key(nvs.handle, discovery_key);
    if ((erased != ESP_OK && erased != ESP_ERR_NVS_NOT_FOUND) || nvs_commit(nvs.handle) != ESP_OK)
      return Result::storage_failed;
    size_t size = sizeof(record);
    return nvs_get_blob(nvs.handle, discovery_key, &record, &size) == ESP_ERR_NVS_NOT_FOUND ? Result::disabled :
        Result::storage_failed;
  }
  StoredDiscovery saved;
  size_t size = sizeof(saved);
  const auto found = nvs_get_blob(nvs.handle, discovery_key, &saved, &size);
  if (found != ESP_ERR_NVS_NOT_FOUND && (found != ESP_OK || size != sizeof(saved) || saved.version != record.version))
    return Result::storage_failed;
  if (found != ESP_OK || saved != record) {
    if (nvs_set_blob(nvs.handle, discovery_key, &record, sizeof(record)) != ESP_OK || nvs_commit(nvs.handle) != ESP_OK)
      return Result::storage_failed;
    size = sizeof(saved);
    if (nvs_get_blob(nvs.handle, discovery_key, &saved, &size) != ESP_OK || size != sizeof(saved) || saved != record)
      return Result::storage_failed;
  }
  return replace(Profile{identity, boot, {}, key_hash}) ? Result::enabled : Result::unavailable;
}

void Device::restore_discovery(const Identity &identity, uint64_t boot) {
  NvsHandle nvs;
  StoredDiscovery record;
  Digest scope{};
  size_t size = sizeof(record);
  if (identity_digest(identity, scope) && nvs_open(nvs_namespace, NVS_READONLY, &nvs.handle) == ESP_OK &&
      nvs_get_blob(nvs.handle, discovery_key, &record, &size) == ESP_OK && size == sizeof(record) && record.version == 1 &&
      record.scope == scope) replace(Profile{identity, boot, {}, record.key_hash});
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
  if (profile_ && !profile_->discovery) return profile_->target;
  return std::nullopt;
}

void Device::publish_route(const Identity &identity, bool ready, DiscoveryLink link) {
  bool invalidate = false;
  bool changed = false;
  {
    std::lock_guard lock(mutex_);
    if (profile_ && profile_->identity != identity) {
      profile_.reset();
      if (revision_.load() < UINT32_MAX) ++revision_;
      invalidate = true;
    }
    if (!profile_ || !profile_->discovery) link = {};
    const bool route_up = profile_ && (profile_->discovery ? bool(link.interface) : ready) && route_.load() < UINT32_MAX;
    const bool was_ready = ready_.exchange(route_up);
    changed = was_ready != route_up;
    if (was_ready && (!route_up || discovery_link_ != link)) {
      ++route_;
      invalidate = true;
    }
    discovery_link_ = link;
  }
  if (invalidate) port_.close();
  if (task_ && (changed || invalidate)) xTaskNotifyGive(task_);
}

bool Device::accepting() const {
  return ready_.load() && revision_.load() == active_revision_ && route_.load() == active_route_;
}

Device::DiscoveryStats Device::discovery_stats() const {
  return {queries_.load(), completed_.load(), errors_.load(), hits_.load(), dials_.load(), cached_.load(),
          tcp_.load(), authenticated_.load()};
}

void Device::worker(void *self) { static_cast<Device *>(self)->run(); }

void Device::run() {
  Key key;
  Session session(port_);
  Socket io;
  uint64_t next_dial{}, deadline{}, discovery_retry = retry_ms;
  bool has_key = false, connecting = false, authenticated = false, mdns_initialized = false;
  int fd = -1;
  std::optional<Profile> profile;
  Candidates candidates;
  DiscoveryReconnect reconnect;
  Target dialed{};
  const auto disconnect = [&] {
    session.close();
    io.reset();
    if (fd >= 0) ::close(fd);
    fd = -1;
    connecting = false;
    authenticated = false;
  };
  const auto stop_discovery = [&] {
    if (mdns_initialized) mdns_free();
    mdns_initialized = false;
  };
  for (;;) {
    uint64_t now = uint64_t(esp_timer_get_time() / 1000);
    if (active_revision_ != revision_.load()) {
      disconnect();
      stop_discovery();
      key.clear();
      has_key = false;
      {
        std::lock_guard lock(mutex_);
        active_revision_ = revision_.load();
        profile = profile_;
      }
      if (profile) {
        Pub point{};
        has_key = load_device_key(profile->identity, key, point, !profile->discovery) &&
            (!profile->discovery || key_matches(point, *profile->discovery));
        if (!profile->discovery && active_revision_ == revision_.load()) {
          if (has_key) report_key(point);
          else puts("@VP8_VPCNET1 KEY_UNAVAILABLE");
        }
      }
      candidates = {};
      reconnect.clear();
      discovery_retry = retry_ms;
      next_dial = now;
    }
    if (!accepting()) {
      disconnect();
      if (!ready_.load()) stop_discovery();
      active_route_ = route_.load();
      candidates = {};
      reconnect.clear();
      discovery_retry = retry_ms;
      next_dial = now;
    }
    if (profile && has_key && accepting()) {
      const auto retry = [&] {
        disconnect();
        if (!profile->discovery) next_dial = now + retry_ms;
        else if (candidates.pending()) next_dial = now + candidate_delay_ms;
        else {
          next_dial = now + discovery_retry;
          discovery_retry = std::min(discovery_retry * 2, discovery_retry_limit_ms);
        }
      };
      const auto connect_failed = [&] { if (profile->discovery) retry(); else disconnect(); };
      if (fd < 0 && now >= next_dial) {
        std::optional<Target> target = profile->target;
        if (profile->discovery) {
          if (!candidates.pending()) {
            DiscoveryLink link;
            {
              std::lock_guard lock(mutex_);
              if (!accepting()) continue;
              link = discovery_link_;
            }
            target = reconnect.take(link.subnet);
            if (target) ++cached_;
            else {
              ++queries_;
              if (link.interface && !mdns_initialized) mdns_initialized = mdns_init() == ESP_OK;
              const auto found = link.interface && mdns_initialized ?
                  discovery::query(link.interface, link.subnet, [this] { return accepting(); }) : std::nullopt;
              if (!found) ++errors_;
              if (found && found->pending()) ++hits_;
              ++completed_;
              candidates = found.value_or(Candidates{});
              target = candidates.next();
              now = uint64_t(esp_timer_get_time() / 1000);
            }
            if (!accepting()) continue;
          } else target = candidates.next();
        }
        if (target) {
          dialed = *target;
          if (profile->discovery) ++dials_;
          fd = dial(dialed);
        }
        connecting = fd >= 0;
        deadline = now + connect_limit_ms;
        if (!profile->discovery) next_dial = now + retry_ms;
        else if (!connecting) retry();
      }
      if (connecting) {
        const int result = connection(fd);
        if (result < 0 || now >= deadline) connect_failed();
        else if (result > 0) {
          connecting = false;
          if (profile->discovery) ++tcp_;
          if (!session.start(profile->identity, key, profile->boot, now)) connect_failed();
        }
      } else if (fd >= 0) {
        if (!io.step(fd, session, now)) retry();
        else if (profile->discovery && !authenticated && session.authenticated()) {
          authenticated = true;
          ++authenticated_;
          reconnect.remember(dialed);
          candidates = {};
          discovery_retry = retry_ms;
        }
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

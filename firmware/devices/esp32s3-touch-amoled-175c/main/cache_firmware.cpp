#include "cache_firmware.h"
#include "cache_expected.h"
#include "control_socket.h"
#include "persistence/http_asset_headers.h"
#include "station_driver.h"
#if VP8_RETAINED
#include "daily_policy.h"
#include "esp_random.h"
#endif
#if VP8_ACTION_UPDATE
#include "action_update.h"
#include "action_update_expected.h"
#include <atomic>
#endif

#include "driver/usb_serial_jtag.h"
#include "esp_heap_caps.h"
#include "esp_partition.h"
#include "esp_system.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

#include <cstdio>

namespace vp8_cache {
namespace {
constexpr uint32_t partition_address = 0x400000, partition_size = 0x1c00000;
constexpr size_t asset_count = std::size(assets);
constexpr auto offsets = [] {
  std::array<uint32_t, asset_count> result{};
  for (size_t i = 1; i < result.size(); ++i) result[i] = result[i - 1] + footprint(assets[i - 1].bytes);
  return result;
}();
static_assert(region + region_size < partition_size);
#if VP8_ACTION_UPDATE
constexpr uint32_t installed_update_base = region - update_size;
#if VP8_POWER_CUT_PROBE
constexpr uint32_t update_base = installed_update_base - update_size;
constexpr const Asset &update_target = assets[2];
static_assert(update_base == 0x18ff000);
#else
constexpr uint32_t update_base = installed_update_base;
constexpr const Asset &update_target = replacement;
#endif
#endif
static_assert([] {
  for (const auto &asset : assets) if (!footprint(asset.bytes)) return false;
  return offsets.back() + footprint(assets[asset_count - 1].bytes) <= region_size;
}());
#if VP8_RETAINED
static_assert(asset_count == 4 && assets[0].id == 0 && assets[1].id == 4 && assets[2].id == 1 && assets[3].id == 11);
#endif
alignas(4) std::array<uint8_t, sector> io_buffer{};

struct Flash {
  const esp_partition_t *part;
  uint32_t base = region;
  uint32_t size = region_size;
  bool read(uint32_t at, std::span<uint8_t> data) const {
    return at <= size && data.size() <= size - at &&
           esp_partition_read(part, base + at, data.data(), data.size()) == ESP_OK;
  }
  bool write(uint32_t at, Clip data) const {
    const bool written = at <= size && data.size() <= size - at &&
           esp_partition_write(part, base + at, data.data(), data.size()) == ESP_OK;
#if VP8_POWER_CUT_PROBE
    if (written && base == update_base && at == sector && data.size() == sector)
      puts("@VP8_UPDATE POWER_CUT_READY bytes=4096");
#endif
    return written;
  }
  bool erase(uint32_t at, uint32_t size) const {
    return at <= this->size && size <= this->size - at &&
           esp_partition_erase_range(part, base + at, size) == ESP_OK;
  }
};

struct ClipBuffer {
  static constexpr size_t capacity = [] {
    size_t result = 0;
    for (const auto &asset : assets) result = std::max(result, size_t(asset.bytes));
#if VP8_ACTION_UPDATE
    result = std::max(result, size_t(replacement.bytes));
#endif
    return result;
  }();
  explicit ClipBuffer(size_t size = capacity) : available(size), bytes(size ?
    static_cast<uint8_t *>(heap_caps_aligned_alloc(16, size, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT)) : nullptr) {}
  const size_t available;
  uint8_t *const bytes;
  ~ClipBuffer() { heap_caps_free(bytes); }
  bool load(const Flash &flash, unsigned index) const {
    if (!bytes || assets[index].bytes > available) return false;
    // The installed bootloader maps only the low 16 MiB; the scratch is above that.
    const uint32_t offset = offsets[index] + sector;
    for (uint32_t at = 0; at < assets[index].bytes; at += sector) {
      const auto chunk = std::min(sector, assets[index].bytes - at);
      if (!flash.read(offset + at, {bytes + at, chunk})) return false;
    }
    return true;
  }
  Clip data(unsigned index) const { return {bytes, assets[index].bytes}; }
};

struct StationObserver {
  esp_netif_t *netif = nullptr;
  esp_err_t start(esp_netif_t *value) { netif = value; return ESP_OK; }
  esp_err_t stop() { netif = nullptr; return ESP_OK; }
  bool ready() const {
    esp_netif_ip_info_t ip{};
    return netif && esp_netif_is_netif_up(netif) && esp_netif_get_ip_info(netif, &ip) == ESP_OK && ip.ip.addr;
  }
};

using Station = pet400_transport::BasicStationDriver<StationObserver>;
using pet400_transport::Endpoint;
using pet400_transport::Credentials;
using pet400_transport::scrub;

bool line(std::span<char> buffer, int64_t deadline) {
  size_t len = 0;
  while (esp_timer_get_time() < deadline) {
    uint8_t c = 0;
    if (usb_serial_jtag_read_bytes(&c, 1, pdMS_TO_TICKS(40)) != 1) continue;
    if (c == '\n') { buffer[len] = '\0'; return len != 0; }
    if (len + 1 >= buffer.size() || c < 32 || c > 126) return false;
    buffer[len++] = char(c);
  }
  return false;
}

int hex(char c) {
  if (c >= '0' && c <= '9') return c - '0';
  if (c >= 'a' && c <= 'f') return c - 'a' + 10;
  return -1;
}

bool unhex(std::string_view input, std::span<char> output) {
  if (input == "-") return true;
  if (input.size() % 2 || input.size() / 2 >= output.size()) return false;
  for (size_t i = 0; i < input.size() / 2; ++i) {
    const int hi = hex(input[2 * i]), lo = hex(input[2 * i + 1]);
    if (hi < 0 || lo < 0 || (hi == 0 && lo == 0)) return false;
    output[i] = char((hi << 4) | lo);
  }
  return true;
}

bool install_usb() {
  usb_serial_jtag_driver_config_t usb{256, 256};
  return usb_serial_jtag_driver_install(&usb) == ESP_OK;
}

bool parse_endpoint(const char *arguments, Endpoint &endpoint, Credentials &wifi) {
  char ssid[65]{}, password[127]{};
  unsigned a, b, c, d, port;
  char extra;
  const bool got = std::sscanf(arguments, "%3u.%3u.%3u.%3u %5u %64s %126s %c", &a, &b, &c, &d, &port,
                ssid, password, &extra) == 7 &&
    a <= 255 && b <= 255 && c <= 255 && d <= 255 && port > 0 && port <= 65535 &&
    unhex(ssid, wifi.ssid) && unhex(password, wifi.password) && pet400_transport::valid(wifi);
  scrub(ssid, sizeof(ssid));
  scrub(password, sizeof(password));
  if (!got) return false;
  endpoint = {{uint8_t(a), uint8_t(b), uint8_t(c), uint8_t(d)}, uint16_t(port)};
  return endpoint.valid();
}

bool configure(Endpoint &endpoint, Credentials &wifi) {
  if (!install_usb()) return false;
  char command[256]{};
  puts("@VP8_CACHE WAIT_INSTALL");
  const bool got = line(command, esp_timer_get_time() + 90000000) && std::string_view(command).starts_with("INSTALL ") &&
    parse_endpoint(command + 8, endpoint, wifi);
  scrub(command, sizeof(command));
  return got;
}

bool on_link(Station &station, const Endpoint &endpoint) {
  esp_netif_ip_info_t ip{};
  if (esp_netif_get_ip_info(station.netif(), &ip) != ESP_OK || !ip.netmask.addr) return false;
  const auto [a, b, c, d] = endpoint.ip;
  const uint32_t host = htonl(uint32_t(a) << 24 | uint32_t(b) << 16 | uint32_t(c) << 8 | d);
  return (ip.ip.addr & ip.netmask.addr) == (host & ip.netmask.addr);
}

struct Socket {
  pet400_transport::SocketOps ops;
  int fd = -1;
  ~Socket() { if (fd >= 0) ops.close(fd); }
  bool close() {
    if (fd < 0) return false;
    const bool closed = ops.close(fd);
    fd = -1;
    return closed;
  }
  bool (*stop)() = nullptr;
  bool stopped() const { return stop && stop(); }
  bool connect(const Endpoint &endpoint, int64_t deadline) {
    fd = ops.dial(endpoint);
    if (fd < 0) return false;
    while (!stopped() && esp_timer_get_time() < deadline) {
      const int result = ops.connected(fd);
      if (result) return result > 0;
      vTaskDelay(1);
    }
    return false;
  }
  template<class Move> bool exact(size_t bytes, int64_t deadline, Move move) {
    for (size_t at = 0; at < bytes;) {
      if (stopped() || esp_timer_get_time() >= deadline) return false;
      const int n = move(at, bytes - at);
      if (n < 0 || size_t(n) > bytes - at) return false;
      if (n) at += n;
      else vTaskDelay(1);
    }
    return true;
  }
};

bool download(Flash &flash, uint32_t offset, const Asset &asset, const Endpoint &endpoint, std::span<uint8_t> work,
              bool update = false, bool (*stop)() = nullptr) {
  Socket conn;
  conn.stop = stop;
#if VP8_POWER_CUT_PROBE
  constexpr int64_t transfer_budget = 150000000;
#else
  constexpr int64_t transfer_budget = 30000000;
#endif
  const auto deadline = esp_timer_get_time() + (update ? transfer_budget : 30000000);
  if (!conn.connect(endpoint, esp_timer_get_time() + 4000000)) return false;
  const auto [a, b, c, d] = endpoint.ip;
  char request[176];
  const int length = std::snprintf(request, sizeof(request),
    "GET /%s%lu-400.ivf HTTP/1.1\r\nHost: %u.%u.%u.%u:%u\r\nConnection: close\r\nAccept-Encoding: identity\r\n\r\n",
    update ? "vp8/update/" : "", (unsigned long)asset.id, unsigned(a), unsigned(b), unsigned(c), unsigned(d),
    unsigned(endpoint.port));
  if (length <= 0 || size_t(length) >= sizeof(request) || !conn.exact(length, deadline, [&](size_t at, size_t bytes) {
    return conn.ops.write(conn.fd, reinterpret_cast<const uint8_t *>(request) + at, bytes);
  })) return false;
  const auto read = [&](std::span<uint8_t> out) {
    return conn.exact(out.size(), deadline, [&](size_t at, size_t bytes) {
      return conn.ops.read(conn.fd, out.data() + at, bytes);
    });
  };
  uint8_t headers[512];
  for (size_t i = 0; i < sizeof(headers); ++i) {
    if (!read({headers + i, 1})) return false;
    if (i < 3 || std::memcmp(headers + i - 3, "\r\n\r\n", 4)) continue;
    if (!pet400_persist::http_asset_headers({reinterpret_cast<const char *>(headers), i + 1}, asset.bytes))
      return false;
    return !conn.stopped() && stage(flash, offset, asset, work, read) && conn.close();
  }
  return false;
}

bool install(Flash &flash, const ClipBuffer &clip, std::array<bool, asset_count> cached, Playback playback) {
  Endpoint endpoint;
  Credentials wifi{};
  if (!configure(endpoint, wifi)) { scrub(&wifi, sizeof(wifi)); return false; }
  Station station;
  const bool started = station.start(wifi);
  scrub(&wifi, sizeof(wifi));
  bool ok = started;
  const auto deadline = esp_timer_get_time() + 15000000;
  while (ok && !station.ready() && esp_timer_get_time() < deadline) {
    ok = station.poll(esp_timer_get_time());
    vTaskDelay(pdMS_TO_TICKS(10));
  }
  ok = ok && station.ready() && on_link(station, endpoint);
  if (ok) puts("@VP8_CACHE STA_READY");
  for (unsigned i = 0; ok && i < cached.size(); ++i) {
    if (cached[i]) continue;
    const auto began = esp_timer_get_time();
    ok = download(flash, offsets[i], assets[i], endpoint, io_buffer);
    if (ok) printf("@VP8_CACHE STAGED id=%lu bytes=%lu us=%lld\n", (unsigned long)assets[i].id,
                   (unsigned long)assets[i].bytes, esp_timer_get_time() - began);
  }
  const bool clean = station.cleanup();
  if (!ok || !clean) {
    printf("@VP8_CACHE NETWORK_ERROR sta=%ld cleanup=%ld\n", long(station.error()), long(station.cleanup_error()));
    return false;
  }
  puts("@VP8_CACHE STA_STOPPED");
  for (unsigned i = 0; i < cached.size(); ++i) {
    if (cached[i]) continue;
    if (!clip.load(flash, i) || !commit(flash, offsets[i], assets[i], clip.data(i),
        [&] { return playback(i, clip.data(i), true); })) return false;
    printf("@VP8_CACHE SAVED id=%lu\n", (unsigned long)assets[i].id);
  }
  puts("@VP8_CACHE WAIT_REBOOT");
  char cmd[24];
  if (!line(cmd, esp_timer_get_time() + 60000000) || std::strcmp(cmd, "REBOOT") != 0) return false;
  puts("@VP8_CACHE REBOOT");
  vTaskDelay(pdMS_TO_TICKS(200));
  esp_restart();
}

#if VP8_ACTION_UPDATE
static_assert(installed_update_base == 0x197f000 && replacement.id == assets[2].id &&
              replacement.bytes > 0 && replacement.bytes <= update_capacity && replacement.frames == 241 &&
              replacement.sha != assets[2].sha && update_target.bytes <= update_capacity);
std::atomic<bool> replacement_active{}, show_requested{}, serial_wave{};
Flash update_flash{};
UpdateLines update_lines;
Endpoint update_endpoint{};
Credentials update_wifi{};
bool busy = false, cancelled = false;

void update_status() {
  printf("@VP8_UPDATE STATUS committed=%u busy=%u\n", unsigned(replacement_active.load()), unsigned(busy));
}

void update_input() {
  // Limit work in the transfer loop even if the USB host floods commands.
  std::array<uint8_t, 64> bytes{};
  const int size = usb_serial_jtag_read_bytes(bytes.data(), bytes.size(), 0);
  for (int i = 0; i < size; ++i) {
    update_lines.push(bytes[i], [](std::string_view command) {
      if (command == "WAVE") serial_wave.store(true);
      else if (command == "SHOW1") show_requested.store(true);
      else if (command == "STATUS1") update_status();
      else if (command == "CANCEL1" && busy) cancelled = true;
      else if (command.starts_with("UPDATE1 ")) {
        if (busy) {
          puts("@VP8_UPDATE BUSY");
        } else if (parse_endpoint(command.data() + 8, update_endpoint, update_wifi)) {
          busy = true;
          cancelled = false;
          puts("@VP8_UPDATE ACCEPTED");
        } else {
          scrub(&update_wifi, sizeof(update_wifi));
          puts("@VP8_UPDATE FAILED reason=request");
        }
      }
    });
  }
  scrub(bytes.data(), bytes.size());
}

bool update_stopped() {
  update_input();
  return cancelled;
}

const char *perform_update() {
  if (cancelled) return "CANCELLED";
  if (replacement_active.load()) return "SAVED id=1 existing=1";
  const ClipBuffer scratch(update_target.bytes);
  if (!scratch.bytes) return "FAILED reason=memory";
  Station station;
  bool ready = station.start(update_wifi);
  scrub(&update_wifi, sizeof(update_wifi));
  const auto deadline = esp_timer_get_time() + 15000000;
  while (ready && !station.ready() && esp_timer_get_time() < deadline && !update_stopped()) {
    ready = station.poll(esp_timer_get_time());
    vTaskDelay(pdMS_TO_TICKS(10));
  }
  ready = ready && station.ready() && on_link(station, update_endpoint) && !update_stopped();
  if (ready) {
    puts("@VP8_UPDATE STA_READY");
    ready = download(update_flash, 0, update_target, update_endpoint, io_buffer, true, update_stopped);
  }
  if (!station.cleanup()) return "FAILED reason=network_cleanup";
  if (update_stopped()) return "CANCELLED";
  if (!ready) return "FAILED reason=download";
  puts("@VP8_UPDATE VERIFY");
  if (!seal_update(update_flash, update_target, {scratch.bytes, scratch.available}, update_stopped))
    return cancelled ? "CANCELLED" : "FAILED reason=validation_or_flash";
  replacement_active.store(true);
  return "SAVED id=1 existing=0";
}

void update_task(void *) {
  for (;;) {
    update_input();
    if (busy) {
      const auto *result = perform_update();
      scrub(&update_wifi, sizeof(update_wifi));
      busy = false;
      printf("@VP8_UPDATE %s\n", result);
      printf("@VP8_UPDATE MEMORY internal_min=%zu psram_min=%zu internal_block=%zu psram_block=%zu\n",
        heap_caps_get_minimum_free_size(MALLOC_CAP_INTERNAL | MALLOC_CAP_8BIT),
        heap_caps_get_minimum_free_size(MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT),
        heap_caps_get_largest_free_block(MALLOC_CAP_INTERNAL | MALLOC_CAP_8BIT),
        heap_caps_get_largest_free_block(MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT));
    }
    vTaskDelay(pdMS_TO_TICKS(10));
  }
}
#endif
}  // namespace

#if VP8_ACTION_UPDATE
bool take_serial_wave() { return serial_wave.exchange(false); }
#endif

#if VP8_RETAINED
bool run_from_flash(Playback playback, TakeTouch take_touch) {
#else
bool run_from_flash(Playback playback) {
#endif
  const auto *part = esp_partition_find_first(ESP_PARTITION_TYPE_DATA, esp_partition_subtype_t(0x41), "pet_assets360");
  if (!part || part->address != partition_address || part->size != partition_size || part->encrypted || part->readonly)
    return false;
  Flash flash{part};
  for (unsigned i = 0; i < std::size(approved_roots); ++i) {
    if (esp_partition_read(part, i * sector, io_buffer.data(), io_buffer.size()) != ESP_OK ||
        sha256(io_buffer) != approved_roots[i]) return false;
  }
  const ClipBuffer clip;
#if VP8_FAST_TOUCH
  const ClipBuffer idle(assets[vp8_daily::idle].bytes);
  const ClipBuffer wave(assets[vp8_daily::wave].bytes);
  const auto hot = [&](unsigned index) -> const ClipBuffer * {
    if (index == vp8_daily::idle && idle.bytes) return &idle;
    if (index == vp8_daily::wave && wave.bytes) return &wave;
    return nullptr;
  };
#endif
  std::array<bool, asset_count> cached{};
  for (unsigned i = 0; i < cached.size(); ++i) {
#if VP8_FAST_TOUCH
    const auto *candidate = hot(i);
    const auto &buffer = candidate ? *candidate : clip;
#else
    const auto &buffer = clip;
#endif
    if (!buffer.load(flash, i)) return false;
    cached[i] = mount(flash, offsets[i], assets[i], buffer.data(i));
  }
  if (!std::all_of(cached.begin(), cached.end(), [](bool found) { return found; }))
    return install(flash, clip, cached, playback);
  puts("@VP8_CACHE OFFLINE");
#if VP8_RETAINED
  if (!install_usb()) return false;
#if VP8_ACTION_UPDATE
  update_flash = {part, update_base, update_size};
  replacement_active.store(clip.bytes && load_update(update_flash, update_target, {clip.bytes, clip.available}));
#if VP8_POWER_CUT_PROBE
  Flash installed_update{part, installed_update_base, update_size};
  bool installed_valid = clip.bytes && load_update(installed_update, replacement, {clip.bytes, clip.available});
  printf("@VP8_UPDATE PREVIOUS committed=%u\n", unsigned(installed_valid));
#endif
  update_status();
  if (xTaskCreatePinnedToCore(update_task, "vp8_update", 5632, nullptr, 2, nullptr, 1) != pdPASS)
    puts("@VP8_UPDATE FAILED reason=task");
#endif
#if VP8_FAST_TOUCH
  printf("@VP8_DAILY HOT idle=%u wave=%u\n", unsigned(idle.bytes != nullptr), unsigned(wave.bytes != nullptr));
#endif
  vp8_daily::Policy policy;
  enum class MediaVersion { Original, Candidate, Installed };
  auto loaded_version = MediaVersion::Original;
  unsigned current = vp8_daily::idle;
  unsigned loaded = asset_count;
  for (;;) {
    const ClipBuffer *on_screen = &clip;
#if VP8_FAST_TOUCH
    if (const auto *preloaded = hot(current)) on_screen = preloaded;
#endif
    const Asset *selected = &assets[current];
    auto version = MediaVersion::Original;
#if VP8_ACTION_UPDATE
    Flash *source = nullptr;
    if (current == vp8_daily::first_auto && replacement_active.load()) {
      version = MediaVersion::Candidate;
      source = &update_flash;
      selected = &update_target;
    }
#if VP8_POWER_CUT_PROBE
    else if (current == vp8_daily::first_auto && installed_valid) {
      version = MediaVersion::Installed;
      source = &installed_update;
      selected = &replacement;
    }
#endif
    const auto reject = [&](const char *reason) {
      if (version == MediaVersion::Candidate) replacement_active.store(false);
#if VP8_POWER_CUT_PROBE
      if (version == MediaVersion::Installed) installed_valid = false;
#endif
      loaded = asset_count;
      printf("@VP8_UPDATE FAILED reason=%s\n", reason);
    };
    if (source && (loaded != current || loaded_version != version)) {
      if (!load_update(*source, *selected, {clip.bytes, clip.available})) {
        reject("readback");
        continue;
      }
      loaded = current;
      loaded_version = version;
    }
#endif
    if (version == MediaVersion::Original && on_screen == &clip &&
        (loaded != current || loaded_version != version)) {
      if (!clip.load(flash, current) || !mount(flash, offsets[current], assets[current], clip.data(current))) return false;
      loaded = current;
      loaded_version = version;
    }
    printf("@VP8_DAILY ACTION id=%lu\n", (unsigned long)assets[current].id);
#if VP8_ACTION_UPDATE
    if (version == MediaVersion::Candidate) puts("@VP8_UPDATE PLAY id=1 committed=1");
    if (version == MediaVersion::Installed) puts("@VP8_UPDATE PLAY id=1 previous=1");
#endif
    const Clip media{on_screen->bytes, selected->bytes};
    if (!playback(current, media, false)) {
#if VP8_ACTION_UPDATE
      if (version != MediaVersion::Original) {
        reject("decoder");
        continue;
      }
#endif
      return false;
    }
    current = policy.next(current, take_touch(), esp_random());
#if VP8_ACTION_UPDATE
    if (current != vp8_daily::wave && show_requested.exchange(false)) current = vp8_daily::first_auto;
#endif
  }
#else
  for (unsigned i = 0; i < cached.size(); ++i) {
    if (!clip.load(flash, i) || !playback(i, clip.data(i), false)) return false;
  }
  puts("@VP8_CACHE OFFLINE_DONE");
  return true;
#endif
}
}  // namespace vp8_cache

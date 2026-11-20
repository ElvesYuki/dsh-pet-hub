#include "ota_firmware.h"
#include "action_update.h"
#include "ota_cache.h"
#include "ota_idle_policy.h"
#include "ota_transfer.h"
#include "usb_status.h"
#include "daily_policy.h"
#include "control_socket.h"
#include "persistence/http_asset_headers.h"
#include "station_driver.h"
#if VP8_VPC1_USB_PROBE || VP8_VPC1_LAN
#include "playback_control_policy.h"
#endif
#if VP8_VPC1_LAN
#include "device_tcp_server.h"
#endif
#if VP8_BATTERY_QUERY
#include "round_battery.h"
#endif
#if VP8_SENSOR_QUERY
#include "round_motion.h"
#endif
#if VP8_LOCAL_MOTION
#include "motion_gesture.h"
#endif
#if VP8_LIFT_WAKE
#include "lift_wake.h"
#endif
#if VP8_PLAYFUL_INTERACTIONS
#include "playful_interactions.h"
#endif
#if VP8_SLEEP_WAKE
#include "sleep_wake.h"
#endif
#if VP8_FOCUS_MENU
#include "round_power_key.h"
#endif
#if VP8_DESKTOP_INTERNET
#include "desktop_network_profiles.h"
#include "nvs.h"
#include "nvs_flash.h"
#endif
#if VP8_BOOT_PAIRING
#include "device_pairing.h"
#include "persistence/media_binding_sdk.h"
#include "bootloader_random.h"
#include "esp_mac.h"
#include "round_boot_key.h"
#endif

#include "driver/usb_serial_jtag.h"
#include "esp_app_desc.h"
#include "esp_heap_caps.h"
#include "esp_ota_ops.h"
#include "esp_random.h"
#include "esp_system.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

#include <atomic>
#include <charconv>
#include <cstdio>
#include <mutex>
#include <new>
#include <optional>

#if !CONFIG_BOOTLOADER_APP_ROLLBACK_ENABLE || !CONFIG_SECURE_SIGNED_ON_UPDATE_NO_SECURE_BOOT || CONFIG_SECURE_BOOT || CONFIG_BOOTLOADER_APP_ANTI_ROLLBACK
#error "OTA candidate requires signed updates, software rollback and recoverable USB provisioning"
#endif

namespace vp8_ota {
namespace {
using namespace pet400_transport;
constexpr Key idle_key{0, 0}, wave_key{0, 4};
constexpr unsigned extra_index = 4;
constexpr uint32_t no_request = UINT32_MAX;
uint32_t pack(Key key) { return key.role << 16 | key.action; }
Key unpack(uint32_t value) { return {value >> 16, value & 0xffff}; }

std::atomic<bool> pending_boot{}, serial_wave{};
std::atomic<uint32_t> play_request{no_request}, playing{no_request}, cache_revision{};
esp_timer_handle_t boot_timer{};
#if VP8_VPC1_USB_PROBE || VP8_VPC1_LAN
std::mutex control_mutex;
vp8_control::Playback control_playback;
std::atomic<bool> control_connected{};
std::atomic<bool> control_selected{};
std::atomic<bool> control_contact_down{};
#if VP8_VPC1_USB_PROBE
int64_t control_usb_lost{};
#endif

uint64_t control_now() { return uint64_t(esp_timer_get_time() / 1000); }

bool control_waiting() {
  if (!control_connected.load(std::memory_order_relaxed)) return false;
  std::lock_guard lock(control_mutex);
  return control_playback.control().tick(control_now()) && control_playback.control().waiting();
}

void control_finished(bool missing = false) {
  if (!control_selected.load(std::memory_order_relaxed)) return;
  std::lock_guard lock(control_mutex);
  control_playback.finish(control_now(), missing);
  control_selected.store(false, std::memory_order_relaxed);
}
#endif


struct Flash {
  const esp_partition_t *partition;
  bool read(uint32_t offset, std::span<uint8_t> dest) const {
    if (offset > media_bytes || dest.size() > media_bytes - offset) return false;
    for (size_t at = 0; at < dest.size(); at += sector)
      if (esp_partition_read(partition, offset + at, dest.data() + at,
                             std::min<size_t>(sector, dest.size() - at)) != ESP_OK) return false;
    return true;
  }
  bool write(uint32_t offset, Clip bytes) const {
    return offset <= media_bytes && bytes.size() <= media_bytes - offset &&
           esp_partition_write(partition, offset, bytes.data(), bytes.size()) == ESP_OK;
  }
  bool erase(uint32_t offset, uint32_t bytes) const {
    return offset <= media_bytes && bytes <= media_bytes - offset &&
           esp_partition_erase_range(partition, offset, bytes) == ESP_OK;
  }
};
Cache<Flash> *cache{};
std::mutex cache_mutex;
alignas(4) std::array<uint8_t, sector> work{};

struct Buffer {
  uint8_t *bytes = static_cast<uint8_t *>(
    heap_caps_aligned_alloc(16, object_capacity, MALLOC_CAP_8BIT | MALLOC_CAP_SPIRAM));
  Object object{};
  ~Buffer() { heap_caps_free(bytes); }
  std::span<uint8_t> storage() const { return {bytes, bytes ? object_capacity : 0}; }
  Clip media() const { return {bytes, object.bytes}; }
  void swap(Buffer &other) {
    std::swap(bytes, other.bytes);
    std::swap(object, other.object);
  }
};

bool load(Key key, Buffer &dest, const Object *except = nullptr) {
  for (bool previous : {false, true}) {
    const auto *o = cache->find(key, previous);
    if (o && (!except || *o != *except) && cache->load(*o, dest.storage())) {
      dest.object = *o;
      return true;
    }
  }
  return false;
}

void refresh(Key key, Buffer &hot, Buffer &scratch) {
  const auto *current = cache->find(key);
  if (current && *current != hot.object && cache->load(*current, scratch.storage())) {
    scratch.object = *current;
    hot.swap(scratch);
  }
}

#if VP8_SLEEP_WAKE
vp8_daily::Inactivity sleep_clock;
WakeTiming wake_timing;
#if VP8_LIFT_WAKE
vp8_daily::LiftWakeEvent lift_wake_event;
#endif
constexpr Key wake_key{0, vp8_daily::sleep_actions[2]};
std::atomic<bool> wake_preload_requested{};
std::optional<Buffer> wake_buffer;
bool wake_buffer_ready{}; // Published with its object under cache_mutex.

void poll_wake_preload() {
  if (!wake_preload_requested.load(std::memory_order_relaxed)) return;
  std::unique_lock lock(cache_mutex, std::try_to_lock);
  if (!lock.owns_lock() || playing.load() == pack(wake_key) ||
      !wake_preload_requested.exchange(false, std::memory_order_relaxed)) return;
  const auto *current = cache->find(wake_key);
  if (!current || (wake_buffer_ready && wake_buffer->object == *current)) return;
  const auto object = *current;
  wake_buffer_ready = false;
  lock.unlock();

  // This task owns all writes. With publication cleared, playback can use its Flash fallback.
  const auto start = esp_timer_get_time();
  if (!wake_buffer) wake_buffer.emplace();
  if (!wake_buffer->bytes) {
    wake_buffer.reset();
    puts("@VP8_SLEEP WAKE_PRELOAD_NO_MEMORY");
    return;
  }
  if (!cache->load(object, wake_buffer->storage())) {
    puts("@VP8_SLEEP WAKE_PRELOAD_FAILED");
    return;
  }
  lock.lock();
  wake_buffer->object = object;
  wake_buffer_ready = true;
  lock.unlock();
  const auto finished = esp_timer_get_time();
  printf("@VP8_SLEEP WAKE_PRELOAD bytes=%u elapsed_us=%lld boot_us=%lld\n", unsigned(object.bytes),
      finished - start, finished);
}

Clip preloaded_wake() {
  std::unique_lock lock(cache_mutex, std::try_to_lock);
  if (!lock.owns_lock() || !wake_buffer_ready) return {};
  const auto *current = cache->find(wake_key);
  if (!current || wake_buffer->object != *current) return {};
  // The worker checks playing under this mutex before touching the buffer again.
  playing.store(pack(wake_key));
  return wake_buffer->media();
}

vp8_daily::Input sleep_cycle(Playback playback, vp8_daily::Input (*take_input)(), Buffer &buffer) {
  using namespace vp8_daily;
  auto load_sleep = [&](unsigned step) {
    std::unique_lock lock(cache_mutex, std::try_to_lock);
    if (!lock.owns_lock() || (step == 0 && !std::all_of(sleep_actions.begin(), sleep_actions.end(),
        [](auto action) { return cache->find({0, action}) != nullptr; })) ||
        !load({0, sleep_actions[step]}, buffer)) {
      printf("@VP8_SLEEP ASSET_UNAVAILABLE id=%u\n", unsigned(sleep_actions[step]));
      return false;
    }
    playing.store(pack(buffer.object.key));
    return true;
  };
  if (!load_sleep(0)) return Input::none;
  wake_timing = {};
  puts("@VP8_SLEEP ENTER");
  const bool entered = playback(sleep_start_index, buffer.media(), false);
  auto input = take_input();
  if (!entered) puts("@VP8_SLEEP ENTER_FAILED");
  if (entered && input == Input::none && load_sleep(1)) {
    puts("@VP8_SLEEP ASLEEP");
    while (playback(sleep_loop_index, buffer.media(), false)) {
      input = take_input();
      if (input != Input::none) break;
    }
    if (input == Input::none) input = take_input();
    if (input == Input::none) puts("@VP8_SLEEP LOOP_FAILED");
  }
#if VP8_LIFT_WAKE
  lift_wake_event.end();
#endif
  if (input != Input::wake_touch && input != Input::wake_lift) return input;
  puts(input == Input::wake_lift ? "@VP8_SLEEP WAKE_LIFT" : "@VP8_SLEEP WAKE_TOUCH");
  auto clip = preloaded_wake();
  puts(clip.empty() ? "@VP8_SLEEP WAKE_SOURCE flash" : "@VP8_SLEEP WAKE_SOURCE psram");
  if (clip.empty()) {
    if (!load_sleep(2)) return Input::none;
    clip = buffer.media();
  }
  if (!playback(sleep_end_index, clip, false)) puts("@VP8_SLEEP WAKE_PLAY_FAILED");
  return take_input();
}
#endif

struct StationObserver {
  esp_netif_t *netif{};
  esp_err_t start(esp_netif_t *value) { netif = value; return ESP_OK; }
  esp_err_t stop() { netif = nullptr; return ESP_OK; }
  bool ready() const {
    esp_netif_ip_info_t ip{};
    return netif && esp_netif_is_netif_up(netif) && esp_netif_get_ip_info(netif, &ip) == ESP_OK && ip.ip.addr;
  }
};
using NetworkStation = BasicStationDriver<StationObserver>;

bool on_link(esp_netif_t *netif, const Endpoint &endpoint) {
  esp_netif_ip_info_t ip{};
  if (!netif || esp_netif_get_ip_info(netif, &ip) != ESP_OK || !ip.netmask.addr) return false;
  const auto [a, b, c, d] = endpoint.ip;
  const uint32_t host = htonl(uint32_t(a) << 24 | uint32_t(b) << 16 | uint32_t(c) << 8 | d);
  return (ip.ip.addr & ip.netmask.addr) == (host & ip.netmask.addr);
}

struct Request {
  bool firmware{};
  Endpoint endpoint{};
  Credentials wifi{};
  Object object{};
};
Request request{};
std::atomic<bool> running{}, reboot_ready{};
bool cancelled{}, station_fault{};
std::array<char, 32> status_version{};
uint8_t status_slot{};
#if VP8_BATTERY_QUERY || VP8_SENSOR_QUERY
portMUX_TYPE status_snapshot_lock = portMUX_INITIALIZER_UNLOCKED;
template<class T> struct TimedReading {
  std::optional<T> value;
  int64_t at{};
};
#endif
BasicUpdateLines<384> commands;
vp8_status::UsbSubscription usb_status_subscription;
#if VP8_BATTERY_QUERY
TimedReading<RoundBatteryReading> battery_status;
#endif
#if VP8_SENSOR_QUERY
TimedReading<RoundMotion> motion_status;
vp8_status::Contact touch_cache;
portMUX_TYPE touch_cache_lock = portMUX_INITIALIZER_UNLOCKED;

vp8_status::Contact touch_snapshot() {
  portENTER_CRITICAL(&touch_cache_lock);
  const auto snapshot = touch_cache;
  portEXIT_CRITICAL(&touch_cache_lock);
  return snapshot;
}

#endif
#if VP8_LOCAL_MOTION
std::atomic<uint32_t> pending_motion{};
std::atomic<bool> motion_allowed{}, motion_retry_tilt{};
vp8_daily::MotionGesture motion_gesture;
#if VP8_LIFT_WAKE
vp8_daily::LiftWake lift_detector;
#endif
#endif
#if VP8_SENSOR_QUERY
void poll_motion(bool busy, int64_t now) {
  static int64_t motion_due = 0;
  static bool motion_started = false;
  if (busy) {
    if (motion_started && !round_motion_stop()) puts("@VP8_MOTION STOP_FAILED");
    motion_started = false;
    motion_due = 0;
    portENTER_CRITICAL(&status_snapshot_lock);
    motion_status.value.reset();
    portEXIT_CRITICAL(&status_snapshot_lock);
#if VP8_LOCAL_MOTION
    motion_gesture = {};
#if VP8_LIFT_WAKE
    lift_detector = {};
    lift_wake_event.discard();
#endif
    pending_motion.store(0, std::memory_order_relaxed);
    motion_retry_tilt.store(false, std::memory_order_relaxed);
#endif
    return;
  }
  if (now < motion_due) return;
  if (!motion_started) {
    motion_started = round_motion_start();
    motion_due = esp_timer_get_time() + (motion_started ? 220000 : 5000000);
    if (!motion_started) puts("@VP8_MOTION_INIT_UNAVAILABLE");
    return;
  }
#if VP8_LOCAL_MOTION
  motion_due = now + 40000;
#else
  motion_due = now + 100000;
#endif
  const auto sample = round_motion_read();
  if (sample) {
    portENTER_CRITICAL(&status_snapshot_lock);
    motion_status = {sample, now};
    portEXIT_CRITICAL(&status_snapshot_lock);
  }
#if VP8_LOCAL_MOTION
  if (motion_retry_tilt.exchange(false, std::memory_order_relaxed)) motion_gesture.retry_tilt();
#if VP8_LIFT_WAKE
  const auto window = lift_wake_event.window();
  if (lift_detector.observe(sample, now, window) && lift_wake_event.publish(window, uint32_t(now / 1000))) {
    // The new resting pose should not start a second tilt animation after wake.
    motion_gesture = {};
    pending_motion.store(0, std::memory_order_relaxed);
    return;
  }
#endif
  const auto event = motion_gesture.observe(sample, now, motion_allowed.load(std::memory_order_relaxed));
  if (event != vp8_daily::Input::none) {
    pending_motion.store(vp8_daily::motion_event_stamp(event, uint32_t(now / 1000)), std::memory_order_relaxed);
  }
#endif
}
#endif
#if VP8_FOCUS_MENU
// Only the playback owner accesses the timer. The maintenance task posts the key event.
vp8_daily::FocusTimer focus_timer;
std::atomic<bool> menu_key{};
bool menu_key_ready{};
portMUX_TYPE desktop_lock = portMUX_INITIALIZER_UNLOCKED;
vp8_daily::DesktopStatusCache desktop_cache;

void publish_desktop(int64_t now, int local, vp8_daily::Weather weather, int celsius) {
  portENTER_CRITICAL(&desktop_lock);
  desktop_cache.sync(now, local, weather, celsius);
  portEXIT_CRITICAL(&desktop_lock);
}

void poll_menu_key(bool allow, bool drain = false) {
  if (!menu_key_ready) return;
  static int64_t next_sample{};
  static bool error_logged{};
  const auto now = esp_timer_get_time();
  if (!drain && now < next_sample) return;
  next_sample = now + 50000;
  bool pressed{};
  const auto result = round_power_key_take_short_press(pressed);
  if (result != ESP_OK && !error_logged) {
    printf("@VP8_MENU KEY_ERROR error=%s\n", esp_err_to_name(result));
    error_logged = true;
  } else if (result == ESP_OK) {
    error_logged = false;
  }
  if (!allow) menu_key.store(false, std::memory_order_relaxed);
  else if (pressed) menu_key.store(true, std::memory_order_relaxed);
}
#endif
#if VP8_DESKTOP_INTERNET
struct DesktopNetworkConfig {
  Credentials wifi{};
  vp8_daily::InternetSettings internet{};
  bool valid() const { return pet400_transport::valid(wifi) && vp8_daily::internet_settings_valid(internet); }
};
constexpr char desktop_namespace[] = "vp8_desktop";
constexpr char desktop_config_key[] = "net_v1";
constexpr char desktop_profiles_key[] = "net_v2";
constexpr char desktop_mode_key[] = "mode_v1";
constexpr char desktop_weather_key[] = "weather_v1";
bool parse_desktop_network(std::string_view fields, DesktopNetworkConfig &config);
using vp8_daily::DesktopNetworks;
DesktopNetworks desktop_network{};
static_assert(sizeof(DesktopNetworks) == 532);
vp8_daily::WeatherSelection desktop_weather{};
bool desktop_reconfigure{};
bool desktop_storage_ready{};
bool desktop_weather_storage_ready{};
std::optional<NetworkStation> desktop_station;
vp8_daily::WifiRetryRound desktop_retry;
std::atomic<bool> desktop_online_mode{true}, desktop_mode_toggle{};
bool desktop_clock_reconfigure{};

void load_desktop_network() {
  if (nvs_flash_init() != ESP_OK) {
    puts("@VP8_DESKNET1 STORAGE_UNAVAILABLE");
    return;
  }
  desktop_storage_ready = true;
  nvs_handle_t handle;
  const auto opened = nvs_open(desktop_namespace, NVS_READONLY, &handle);
  if (opened == ESP_ERR_NVS_NOT_FOUND) return;
  if (opened != ESP_OK) {
    desktop_storage_ready = false;
    puts("@VP8_DESKNET1 STORAGE_UNAVAILABLE");
    return;
  }
  uint8_t mode_value{};
  const auto mode = nvs_get_u8(handle, desktop_mode_key, &mode_value);
  if (mode != ESP_ERR_NVS_NOT_FOUND) {
    desktop_online_mode.store(mode == ESP_OK && mode_value == 1, std::memory_order_relaxed);
    if (mode != ESP_OK || mode_value > 1) puts("@VP8_DESKNET3 MODE_UNAVAILABLE");
  }
  size_t stored = sizeof(desktop_network);
  auto result = nvs_get_blob(handle, desktop_profiles_key, &desktop_network, &stored);
  bool valid = result == ESP_OK && stored == sizeof(desktop_network) && desktop_network.valid();
  if (result == ESP_ERR_NVS_NOT_FOUND) {
    char fields[384]{};
    size_t bytes = sizeof(fields);
    result = nvs_get_str(handle, desktop_config_key, fields, &bytes);
    DesktopNetworkConfig legacy{};
    valid = result == ESP_OK && bytes > 1 && bytes <= sizeof(fields) && fields[bytes - 1] == '\0' &&
        parse_desktop_network({fields, bytes - 1}, legacy) && desktop_network.upsert(legacy.wifi, legacy.internet);
    scrub(&legacy, sizeof(legacy));
    scrub(fields, sizeof(fields));
  }
  nvs_close(handle);
  if (!valid) {
    scrub(&desktop_network, sizeof(desktop_network));
    if (result != ESP_ERR_NVS_NOT_FOUND) {
      desktop_storage_ready = false;
      puts("@VP8_DESKNET1 INVALID_SAVED_CONFIG");
    }
  } else {
    if (vp8_daily::internet_settings_valid(desktop_network.internet) &&
        vp8_daily::internet_restore_clock(desktop_network.internet, publish_desktop))
      puts("@VP8_DESKNET1 CLOCK_RETAINED");
    desktop_retry.reset(esp_timer_get_time() + 15'000'000);
  }
}

void load_desktop_weather() {
  using Mode = vp8_daily::WeatherSelection::Mode;
  nvs_handle_t handle;
  const auto opened = nvs_open(desktop_namespace, NVS_READONLY, &handle);
  desktop_weather_storage_ready = opened == ESP_ERR_NVS_NOT_FOUND;
  if (opened == ESP_OK) {
    char fields[24]{};
    size_t bytes = sizeof(fields);
    const auto result = nvs_get_str(handle, desktop_weather_key, fields, &bytes);
    nvs_close(handle);
    desktop_weather_storage_ready = result == ESP_ERR_NVS_NOT_FOUND;
    if (result == ESP_OK || result == ESP_ERR_NVS_INVALID_LENGTH || result == ESP_ERR_NVS_TYPE_MISMATCH) {
      const auto setting = result == ESP_OK && bytes > 1 && bytes <= sizeof(fields) && fields[bytes - 1] == '\0'
          ? vp8_daily::decode_saved_weather({fields, bytes - 1}) : std::nullopt;
      desktop_weather = setting.value_or(vp8_daily::WeatherSelection{Mode::corrupt});
      desktop_weather_storage_ready = true;
      if (!setting) puts("@VP8_DESKWEATHER1 INVALID_SAVED_CONFIG");
    }
  }
  if (!desktop_weather_storage_ready) {
    desktop_weather = {Mode::disabled};
    puts("@VP8_DESKWEATHER1 CONFIG_UNAVAILABLE");
  }
}

bool save_desktop_weather(vp8_daily::WeatherSelection setting) {
  if (desktop_weather_storage_ready && setting == desktop_weather) return true;
  char fields[24] = "-";
  if (setting.mode == vp8_daily::WeatherSelection::Mode::selected) {
    const int size = std::snprintf(fields, sizeof(fields), "%ld %ld",
        long(setting.location.latitude_e4), long(setting.location.longitude_e4));
    if (size <= 0 || size >= int(sizeof(fields))) return false;
  }
  nvs_handle_t handle;
  if (nvs_open(desktop_namespace, NVS_READWRITE, &handle) != ESP_OK) return false;
  const bool saved = nvs_set_str(handle, desktop_weather_key, fields) == ESP_OK && nvs_commit(handle) == ESP_OK;
  nvs_close(handle);
  if (saved) {
    desktop_weather = setting;
    desktop_weather_storage_ready = true;
    vp8_daily::internet_refresh_weather();
    portENTER_CRITICAL(&desktop_lock);
    desktop_cache.clear_weather();
    portEXIT_CRITICAL(&desktop_lock);
  }
  return saved;
}

bool save_desktop_profiles(const DesktopNetworks &next) {
  nvs_handle_t handle;
  if (nvs_open(desktop_namespace, NVS_READWRITE, &handle) != ESP_OK) return false;
  const auto result = nvs_set_blob(handle, desktop_profiles_key, &next, sizeof(next));
  const bool saved = result == ESP_OK && nvs_commit(handle) == ESP_OK;
  nvs_close(handle);
  if (saved) {
    desktop_storage_ready = true;
    const auto &a = desktop_network.internet;
    const auto &b = next.internet;
    const bool clock_changed = a.utc_minutes != b.utc_minutes || std::strcmp(a.time_host, b.time_host);
    const bool weather_changed = a.latitude_e4 != b.latitude_e4 || a.longitude_e4 != b.longitude_e4 ||
        std::strcmp(a.weather_host, b.weather_host);
    scrub(&desktop_network, sizeof(desktop_network));
    desktop_network = next;
    desktop_reconfigure = true;
    desktop_clock_reconfigure |= clock_changed;
    portENTER_CRITICAL(&desktop_lock);
    if (clock_changed) desktop_cache.clear_network();
    else if (weather_changed) desktop_cache.clear_weather();
    portEXIT_CRITICAL(&desktop_lock);
    if (weather_changed) vp8_daily::internet_refresh_weather();
  }
  return saved;
}

bool clear_desktop_profiles() {
  DesktopNetworks empty;
  empty.internet = desktop_network.internet;
  return save_desktop_profiles(empty);
}

void apply_desktop_mode_toggle() {
  if (!desktop_mode_toggle.exchange(false, std::memory_order_relaxed)) return;
  const bool online = !desktop_online_mode.load(std::memory_order_relaxed);
  nvs_handle_t handle;
  if (nvs_open(desktop_namespace, NVS_READWRITE, &handle) != ESP_OK) {
    puts("@VP8_DESKNET3 MODE_STORAGE_FAILED");
    return;
  }
  const bool saved = nvs_set_u8(handle, desktop_mode_key, online) == ESP_OK && nvs_commit(handle) == ESP_OK;
  nvs_close(handle);
  if (saved) {
    desktop_online_mode.store(online, std::memory_order_relaxed);
    desktop_reconfigure = true;
    puts(online ? "@VP8_DESKNET3 MODE_ONLINE" : "@VP8_DESKNET3 MODE_OFFLINE");
  } else puts("@VP8_DESKNET3 MODE_STORAGE_FAILED");
}

vp8_daily::WifiLink desktop_wifi_link() {
  using vp8_daily::WifiLink;
  if (!desktop_online_mode.load(std::memory_order_relaxed)) return WifiLink::off;
  if (!desktop_storage_ready || station_fault) return WifiLink::unavailable;
  if (!desktop_network.count) return WifiLink::off;
  if (!desktop_reconfigure && desktop_station && desktop_station->ready()) return WifiLink::online;
  return WifiLink::connecting;
}

const char *desktop_network_link() {
  constexpr const char *labels[]{"off", "connecting", "online", "unavailable"};
  return labels[static_cast<unsigned>(desktop_wifi_link())];
}

void publish_desktop_wifi() {
  static auto published = vp8_daily::WifiLink::off;
  const auto link = desktop_wifi_link();
  if (published == link) return;
  portENTER_CRITICAL(&desktop_lock);
  desktop_cache.wifi(link);
  portEXIT_CRITICAL(&desktop_lock);
  published = link;
}
#endif
#if VP8_PLAYFUL_INTERACTIONS
std::atomic<Input> pending_power{Input::none};
std::atomic<bool> pending_breakfast{false};

void poll_usb_power() {
  static int64_t next_sample = 0;
  static PlugReaction plug;
  const auto now = esp_timer_get_time();
  if (now < next_sample) return;
  next_sample = now + 100000;
  if (plug.observe(round_battery_usb_power())) {
    pending_breakfast.store(true);
    printf("@VP8_OTA BREAKFAST_TRIGGER at_us=%lld\n", static_cast<long long>(now));
  }
}

#endif

#if VP8_BATTERY_QUERY
void sample_battery() {
  static int64_t next_sample = 0;
  const auto now = esp_timer_get_time();
  if (now >= next_sample) {
    next_sample = now + 1000000;
    const auto reading = round_battery_read();
    portENTER_CRITICAL(&status_snapshot_lock);
    battery_status = {reading, now};
    portEXIT_CRITICAL(&status_snapshot_lock);
#if VP8_FOCUS_MENU
    const int percent = reading && reading->present && reading->percent && *reading->percent <= 100
        ? int(*reading->percent) : -1;
    portENTER_CRITICAL(&desktop_lock);
    desktop_cache.battery(now, percent);
    portEXIT_CRITICAL(&desktop_lock);
#endif
#if VP8_PLAYFUL_INTERACTIONS
    static PowerReactions reactions;
    const auto action = reactions.observe(reading);
    if (action != Input::none) pending_power.store(action);
#endif
  }
}
#endif

#if VP8_BOOT_PAIRING
vp8_pairing::binding::NvsStorage binding_storage{"vp8_binding"};
vp8_pairing::auth::crypto::Secret pairing_seed;
std::optional<vp8_pairing::Session> pairing;
std::atomic<uint32_t> visible_prompt{}, drawn_prompt{};
uint32_t challenge_issued = 0;
int64_t last_challenge = 0;
bool pairing_link = false;

void init_pairing() {
  namespace pair = vp8_pairing;
  uint64_t boot = 0;
  bootloader_random_enable();
  esp_fill_random(&boot, sizeof(boot));
  esp_fill_random(pairing_seed.bytes.data(), pairing_seed.bytes.size());
  bootloader_random_disable();
  std::array<uint8_t, 6> mac{};
  pair::Digest digest{};
  if (!boot || pairing_seed.bytes == pair::Digest{} || esp_efuse_mac_get_default(mac.data()) != ESP_OK ||
      !pair::auth::crypto::initialize() ||
      !pair::auth::crypto::sha256({pair::binding::domain("PBP1/device/v1"), mac}, digest) ||
      round_boot_key_init() != ESP_OK) {
    puts("@VP8_PAIR INIT_FAILED");
    return;
  }
  pair::Identifier id{};
  std::copy_n(digest.begin(), id.size(), id.begin());
  if (id == pair::Identifier{}) { puts("@VP8_PAIR INIT_FAILED"); return; }
#if VP8_USB_ENROLL
  constexpr bool allow_usb_enroll = true;
#else
  constexpr bool allow_usb_enroll = false;
#endif
  pairing.emplace(binding_storage, pair::binding::verify_p256, boot, id, allow_usb_enroll);
  if (pairing->load() != pair::Result::Ok) puts("@VP8_PAIR STORAGE_UNAVAILABLE");
}

void poll_pairing() {
  if (!pairing) return;
  const bool connected = usb_serial_jtag_is_connected();
  if (connected) {
    pairing->tick(esp_timer_get_time(), drawn_prompt.load(), round_boot_key_pressed(), !running && !reboot_ready);
  } else if (pairing_link) {
    pairing->disconnect();
    commands.clear();
  }
  pairing_link = connected;
  visible_prompt.store(pairing->prompt());
}

void receive_pairing(std::string_view frame) {
  if (!pairing || !pairing_link) return;
  const auto now = esp_timer_get_time();
  pairing->receive(frame, now, !running && !reboot_ready,
    [now](vp8_pairing::Digest &out) {
      if (challenge_issued == UINT32_MAX || (challenge_issued && now - last_challenge < 1000000)) return false;
      std::array<uint8_t, 4> counter{};
      pet::put32(counter.data(), ++challenge_issued);
      last_challenge = now;
      return vp8_pairing::auth::crypto::tag(pairing_seed.bytes,
        {vp8_pairing::binding::domain("VP8PAIR1/challenge/v1"), counter}, out);
    }, [](auto packet) {
      std::array<char, vp8_pairing::text_limit> text{};
      const auto length = vp8_pairing::encode(packet, text);
      if (length) printf("@VP8_PAIR1 %.*s\n", int(length), text.data());
    });
  visible_prompt.store(pairing->prompt());
}
#endif

bool number(std::string_view field, uint32_t &value) {
  if (field.empty()) return false;
  const auto r = std::from_chars(field.data(), field.data() + field.size(), value);
  return r.ec == std::errc{} && r.ptr == field.data() + field.size();
}

std::string_view token(std::string_view &line) {
  const auto end = line.find(' ');
  const auto value = line.substr(0, end);
  line.remove_prefix(end == line.npos ? line.size() : end + 1);
  return value;
}

bool hex(std::string_view field, std::span<uint8_t> out, bool fixed = true) {
  if (!fixed && field == "-") return true;
  size_t size = field.size() / 2;
  if (!size || field.size() % 2 || (fixed ? size != out.size() : size >= out.size())) return false;
  const auto nibble = [](char c) -> int {
    if (c >= '0' && c <= '9') return c - '0';
    if (c >= 'a' && c <= 'f') return c - 'a' + 10;
    return -1;
  };
  for (size_t i = 0; i < size; ++i) {
    const auto hi = nibble(field[2 * i]), lo = nibble(field[2 * i + 1]);
    if (hi < 0 || lo < 0 || (!fixed && !hi && !lo)) return false;
    out[i] = (hi << 4) | lo;
  }
  return true;
}

bool endpoint(std::string_view address, std::string_view port_text, Endpoint &result) {
  uint32_t port;
  if (!number(port_text, port) || port > UINT16_MAX) return false;
  for (unsigned i = 0; i < 4; ++i) {
    const size_t dot = address.find('.');
    uint32_t octet;
    if ((i == 3) != (dot == address.npos) || !number(address.substr(0, dot), octet) || octet > 255)
      return false;
    result.ip[i] = octet;
    if (dot != address.npos) address.remove_prefix(dot + 1);
  }
  result.port = port;
  return result.valid();
}

vp8_status::Status device_status_snapshot() {
  vp8_status::Status status{status_version.data(), status_slot, running.load(), reboot_ready.load(), {}, {}, {}};
#if VP8_BATTERY_QUERY || VP8_SENSOR_QUERY
  const auto now = esp_timer_get_time();
  portENTER_CRITICAL(&status_snapshot_lock);
#if VP8_BATTERY_QUERY
  const auto battery = battery_status;
#endif
#if VP8_SENSOR_QUERY
  const auto motion = motion_status;
#endif
  portEXIT_CRITICAL(&status_snapshot_lock);
#endif
#if VP8_BATTERY_QUERY
  if (battery.value && now - battery.at <= 2000000) {
    const auto &b = *battery.value;
    status.battery = vp8_status::Battery{b.present, b.usb_power};
    if (b.present) {
      status.battery->percent = b.percent.value_or(255);
      status.battery->mv = b.millivolts.value_or(0);
      status.battery->flow = uint8_t(b.flow);
      status.battery->phase = uint8_t(b.phase);
    }
  }
#endif
#if VP8_SENSOR_QUERY
  const auto touch = touch_snapshot();
  if (touch.valid_at_us >= 0) {
    status.touch.emplace();
    if (now - touch.valid_at_us <= 250000) status.touch->state = touch.pressed ? 2 : 1;
    if (unsigned(touch.x) < 466 && unsigned(touch.y) < 466) {
      status.touch->x = uint16_t(touch.x);
      status.touch->y = uint16_t(touch.y);
    }
  }
  if (motion.value && now - motion.at <= 160000) {
    const auto &[acceleration, rotation] = *motion.value;
    const auto within = [](const auto &values, int maximum) {
      return std::all_of(values.begin(), values.end(), [maximum](int v) { return v >= -maximum && v <= maximum; });
    };
    if (within(acceleration, 4000) && within(rotation, 256000)) {
      status.imu.emplace();
      std::copy(acceleration.begin(), acceleration.end(), status.imu->mg.begin());
      status.imu->mdps = rotation;
    }
  }
#endif
  return status;
}

#if VP8_VPC1_LAN
class LanControl final : public vp8_lan::ControlPort {
 public:
  vp8_lan::Device owner{*this};

  bool open(uint32_t session, uint64_t now) override {
    std::lock_guard lock(control_mutex);
    if (!owner.accepting()) return false;
    const bool ok = control_playback.control().begin_verified(session, now);
    control_connected.store(ok, std::memory_order_relaxed);
    return ok;
  }

  void close() override {
    std::lock_guard lock(control_mutex);
    control_playback.control().close();
    control_connected.store(false, std::memory_order_relaxed);
  }

  bool receive(const vp8_control::Frame &frame, uint64_t now) override {
    std::lock_guard lock(control_mutex);
    return owner.accepting() && control_playback.control().receive(frame, std::max(now, control_now()));
  }

  bool tick(uint64_t now) override {
    std::lock_guard lock(control_mutex);
    return owner.accepting() && control_playback.control().tick(std::max(now, control_now()));
  }

  bool renew(uint64_t now) override {
    std::lock_guard lock(control_mutex);
    return owner.accepting() && control_playback.control().renew_verified(std::max(now, control_now()));
  }

  std::optional<vp8_control::Message> pop() override {
    std::lock_guard lock(control_mutex);
    return owner.accepting() ? control_playback.control().pop() : std::nullopt;
  }

  vp8_status::Status snapshot() override { return device_status_snapshot(); }
};
LanControl lan_control;

vp8_lan::Identity lan_identity() {
  const auto *record = pairing ? pairing->record() : nullptr;
  if (!record || !record->bound()) return {};
  const auto &binding = record->binding;
  return {binding.device, binding.controller, binding.pairing, binding.epoch, record->key};
}

void lan_command(std::string_view line) {
  if (!pairing_link) return;
  const auto op = token(line);
  if (op == "DISARM" && line.empty()) {
    lan_control.owner.disarm();
    puts("@VP8_VPCNET1 DISARMED");
    return;
  }
  if (running || reboot_ready || station_fault || checking() || (pairing && pairing->prompt())) {
    puts("@VP8_VPCNET1 BUSY");
    return;
  }
  Endpoint target{};
  const auto address = token(line);
  const auto port = token(line);
  if (op != "ARM" || !line.empty() || !endpoint(address, port, target) ||
      target.ip[0] == 0 || target.ip[0] == 127 || target.ip[0] >= 224) {
    puts("@VP8_VPCNET1 INVALID");
    return;
  }
  puts(pairing && lan_control.owner.arm(lan_identity(), pairing->boot(), {target.ip, target.port}) ?
       "@VP8_VPCNET1 QUEUED" : "@VP8_VPCNET1 UNAVAILABLE");
}
#endif

#if VP8_VPC1_USB_PROBE
bool control_probe_busy() {
  return running || reboot_ready || station_fault || checking() || (pairing && pairing->prompt());
}

void receive_control_probe(std::string_view line) {
  const auto op = token(line);
  const char *result = "INVALID";
  {
    std::lock_guard lock(control_mutex);
    auto &core = control_playback.control();
    if (op == "CLOSE" && line.empty()) {
      core.close();
      result = "CLOSED";
    } else if (control_probe_busy()) {
      result = "BUSY";
    } else if (op == "OPEN") {
      uint32_t session{};
      if (number(line, session) && core.begin_verified(session, control_now())) {
        control_usb_lost = 0;
        result = "OPENED";
      }
    } else if (op == "FRAME") {
      vp8_control::Frame frame{};
      if (hex(line, frame) && core.receive(frame, control_now())) result = nullptr;
    }
    control_connected.store(core.connected(), std::memory_order_relaxed);
  }
  if (result) printf("@VP8_VPC1_TEST %s\n", result);
}

void poll_control_probe() {
  if (!control_connected.load(std::memory_order_relaxed)) return;
  const auto now = esp_timer_get_time();
  if (usb_serial_jtag_is_connected()) control_usb_lost = 0;
  else if (!control_usb_lost) control_usb_lost = now;
  std::optional<vp8_control::Message> reply;
  {
    std::lock_guard lock(control_mutex);
    auto &core = control_playback.control();
    if (control_probe_busy() || (control_usb_lost && now - control_usb_lost >= 300000)) core.close();
    if (core.tick(control_now())) reply = core.pop();
    control_connected.store(core.connected(), std::memory_order_relaxed);
  }
  if (!reply) return;
  vp8_control::Frame frame{};
  if (!vp8_control::encode(*reply, frame)) return;
  char encoded[vp8_control::frame_size * 2 + 1]{};
  constexpr char digits[] = "0123456789abcdef";
  for (size_t i = 0; i < frame.size(); ++i) {
    encoded[i * 2] = digits[frame[i] >> 4];
    encoded[i * 2 + 1] = digits[frame[i] & 15];
  }
  printf("@VP8_VPC1 frame=%s\n", encoded);
}
#endif

#if VP8_DESKTOP_INTERNET
bool parse_desktop_network(std::string_view fields, DesktopNetworkConfig &config) {
  const auto ssid = token(fields), password = token(fields);
  const auto time_host = token(fields), weather_host = token(fields);
  if (!vp8_daily::internet_host(time_host) ||
      (weather_host != "-" && !vp8_daily::internet_host(weather_host))) return false;
  const auto integer = [](std::string_view field, int &value) {
    if (field.empty()) return false;
    const auto result = std::from_chars(field.data(), field.data() + field.size(), value);
    return result.ec == std::errc{} && result.ptr == field.data() + field.size();
  };
  int utc{}, latitude{}, longitude{};
  if (!integer(token(fields), utc) || utc < -720 || utc > 840 ||
      !integer(token(fields), latitude) || !integer(token(fields), longitude) || !fields.empty()) return false;
  auto &settings = config.internet;
  settings.utc_minutes = int16_t(utc);
  settings.latitude_e4 = latitude;
  settings.longitude_e4 = longitude;
  std::copy(time_host.begin(), time_host.end(), settings.time_host);
  if (weather_host != "-") std::copy(weather_host.begin(), weather_host.end(), settings.weather_host);
  auto &wifi = config.wifi;
  return hex(ssid, {reinterpret_cast<uint8_t *>(wifi.ssid), sizeof(wifi.ssid)}, false) &&
         hex(password, {reinterpret_cast<uint8_t *>(wifi.password), sizeof(wifi.password)}, false) &&
         config.valid();
}

bool network_command_busy() {
  return running || reboot_ready || station_fault || checking() || (pairing && pairing->prompt());
}

const char *set_desktop_profile(std::string_view fields, const char *full) {
  DesktopNetworkConfig settings{};
  if (!parse_desktop_network(fields, settings)) {
    scrub(&settings, sizeof(settings));
    return "invalid";
  }
  auto next = desktop_network;
  const bool accepted = next.upsert(settings.wifi, settings.internet);
  scrub(&settings, sizeof(settings));
  const bool saved = accepted && save_desktop_profiles(next);
  scrub(&next, sizeof(next));
  return !accepted ? full : saved ? "saved" : "storage_failed";
}

char *write_profile_ssid(char *out, std::string_view ssid) {
  constexpr std::string_view digits = "0123456789abcdef";
  for (const uint8_t byte : ssid) {
    *out++ = digits[byte >> 4];
    *out++ = digits[byte & 15];
  }
  return out;
}

void reply_desktop_profiles(std::string_view id, const char *status) {
  char profiles[DesktopNetworks::capacity * 65]{};
  char *tail = profiles;
  for (size_t i = 0; i < desktop_network.count; ++i) {
    if (i) *tail++ = ',';
    tail = write_profile_ssid(tail, desktop_network.profiles[i].ssid);
  }
  char active[65]{};
  if (desktop_wifi_link() == vp8_daily::WifiLink::online)
    write_profile_ssid(active, desktop_network.profiles[desktop_retry.index()].ssid);
  printf("@VP8_DESKNET3 id=%.8s status=%s mode=%s link=%s active=%s profiles=%s\n", id.data(), status,
         desktop_online_mode.load(std::memory_order_relaxed) ? "online" : "offline", desktop_network_link(),
         *active ? active : "-", *profiles ? profiles : "-");
}

void desktop_profiles_command(std::string_view line) {
  using Operation = vp8_daily::DesktopNetworkCommand::Operation;
  const auto cmd = vp8_daily::desktop_network_command(line, true);
  if (cmd.id.empty()) return;
  const auto error = [&](const char *status) { printf("@VP8_DESKNET3 id=%.8s status=%s\n", cmd.id.data(), status); };
  if (cmd.operation == Operation::invalid) return error("invalid");
  if (cmd.operation == Operation::list) return reply_desktop_profiles(cmd.id, "ok");
  if (network_command_busy()) return error("busy");
  if (cmd.operation == Operation::set) {
    const auto result = set_desktop_profile(cmd.settings, "full");
    if (std::string_view(result) == "saved") return reply_desktop_profiles(cmd.id, result);
    return error(result);
  }
  char ssid[33]{};
  if (!hex(cmd.settings, {reinterpret_cast<uint8_t *>(ssid), sizeof(ssid)}, false) || !*ssid)
    return error("invalid");
  auto next = desktop_network;
  const bool removed = next.remove(ssid);
  const bool saved = removed && save_desktop_profiles(next);
  scrub(&next, sizeof(next));
  if (!removed) return error("missing");
  if (!saved) return error("storage_failed");
  reply_desktop_profiles(cmd.id, "removed");
}

void desktop_network_command(std::string_view line) {
  using Operation = vp8_daily::DesktopNetworkCommand::Operation;
  const auto cmd = vp8_daily::desktop_network_command(line);
  if (cmd.id.empty()) return;
  const auto reply = [&](const char *status, bool snapshot = false) {
    if (snapshot) {
      printf("@VP8_DESKNET2 id=%.8s status=%s configured=%u link=%s\n",
          cmd.id.data(), status, unsigned(desktop_network.count != 0), desktop_network_link());
    } else {
      printf("@VP8_DESKNET2 id=%.8s status=%s\n", cmd.id.data(), status);
    }
  };
  if (cmd.operation == Operation::info) { reply("ok", true); return; }
  if (cmd.operation == Operation::invalid) { reply("invalid"); return; }
  if (network_command_busy()) {
    reply("busy");
    return;
  }
  if (cmd.operation == Operation::clear) {
    if (clear_desktop_profiles()) reply("cleared", true);
    else reply("storage_failed");
    return;
  }
  const auto result = set_desktop_profile(cmd.settings, "invalid");
  reply(result, std::string_view(result) == "saved");
}

void desktop_weather_command(std::string_view line) {
  using Operation = vp8_daily::DesktopNetworkCommand::Operation;
  using Mode = vp8_daily::WeatherSelection::Mode;
  const auto cmd = vp8_daily::desktop_network_command(line);
  if (cmd.id.empty()) return;
  const auto reply = [&](const char *status, bool snapshot = false) {
    if (!snapshot) {
      printf("@VP8_DESKWEATHER1 id=%.8s status=%s\n", cmd.id.data(), status);
    } else if (const auto target = vp8_daily::weather_target(desktop_network.internet, desktop_weather)) {
      printf("@VP8_DESKWEATHER1 id=%.8s status=%s configured=1 lat_e4=%ld lon_e4=%ld\n",
          cmd.id.data(), status, long(target->location.latitude_e4), long(target->location.longitude_e4));
    } else {
      printf("@VP8_DESKWEATHER1 id=%.8s status=%s configured=0\n", cmd.id.data(), status);
    }
  };
  if (cmd.operation == Operation::info) {
    if (desktop_weather_storage_ready) reply("ok", true);
    else reply("storage_failed");
    return;
  }
  if (cmd.operation == Operation::invalid) { reply("invalid"); return; }
  if (running || reboot_ready || checking() || (pairing && pairing->prompt())) {
    reply("busy");
    return;
  }
  if (cmd.operation == Operation::clear) {
    if (save_desktop_weather({Mode::disabled})) reply("cleared", true);
    else reply("storage_failed");
    return;
  }
  const auto location = vp8_daily::parse_weather_location(cmd.settings);
  if (!location) reply("invalid");
  else if (save_desktop_weather({Mode::selected, *location})) reply("saved", true);
  else reply("storage_failed");
}
#endif

bool parse(std::string_view input, bool firmware) {
  request = {};
  request.firmware = firmware;
  const auto address = token(input);
  const auto port = token(input);
  auto &o = request.object;
  if (!endpoint(address, port, request.endpoint)) return false;
  if (!firmware && (!number(token(input), o.key.role) || !number(token(input), o.key.action) ||
                    !number(token(input), o.version) || !number(token(input), o.frames))) return false;
  if (!number(token(input), o.bytes) || !hex(token(input), o.digest)) return false;
  if (firmware ? (!o.bytes || o.bytes > app_bytes || o.bytes % sector || o.digest == Digest{}) : !valid(o))
    return false;
  auto &wifi = request.wifi;
  return hex(token(input), {reinterpret_cast<uint8_t *>(wifi.ssid), sizeof(wifi.ssid)}, false) &&
         hex(token(input), {reinterpret_cast<uint8_t *>(wifi.password), sizeof(wifi.password)}, false) &&
         input.empty() && valid(wifi);
}

void input() {
  uint8_t bytes[64]{};
  const int size = usb_serial_jtag_read_bytes(bytes, sizeof(bytes), 0);
  for (int i = 0; i < size; ++i) commands.push(bytes[i], [](std::string_view line) {
#if VP8_BOOT_PAIRING
    if (line.starts_with(vp8_pairing::request_prefix)) {
      receive_pairing(line.substr(vp8_pairing::request_prefix.size()));
      return;
    }
#endif
    if (usb_status_subscription.receive(line, uint64_t(esp_timer_get_time() / 1000))) return;
    if (vp8_status::handle_usb(line, device_status_snapshot, [](std::string_view reply) {
          printf("%.*s\n", int(reply.size()), reply.data());
        })) return;
    const auto name = token(line);
#if VP8_VPC1_LAN
    if (name == "VPCNET1") {
      lan_command(line);
      return;
    }
#endif
#if VP8_VPC1_USB_PROBE
    if (name == "VPC1TEST") {
      receive_control_probe(line);
      return;
    }
#endif
#if VP8_FOCUS_MENU
    if (name == "DESKTOP1") {
      vp8_daily::DesktopSync sync;
      const bool valid = sync.parse(line);
      if (sync.id.empty()) return;
      const bool busy = running || reboot_ready || station_fault || checking() || (pairing && pairing->prompt());
      if (valid && !busy) {
        const auto now = esp_timer_get_time();
        publish_desktop(now, sync.local_second, sync.weather, sync.celsius);
      }
      printf("@VP8_DESKTOP1 id=%.8s status=%s\n", sync.id.data(), !valid ? "invalid" : busy ? "busy" : "ok");
      return;
    }
#endif
#if VP8_DESKTOP_INTERNET
    if (name == "DESKWEATHER1") {
      desktop_weather_command(line);
      return;
    }
    if (name == "DESKNET2") {
      desktop_network_command(line);
      return;
    }
    if (name == "DESKNET3") {
      desktop_profiles_command(line);
      return;
    }
    if (name == "DESKNET1") {
      if (network_command_busy()) {
        puts("@VP8_DESKNET1 BUSY");
        return;
      }
      if (line == "CLEAR") {
        puts(clear_desktop_profiles() ? "@VP8_DESKNET1 CLEARED" : "@VP8_DESKNET1 STORAGE_FAILED");
        return;
      }
      const std::string_view result = set_desktop_profile(line, "invalid");
      puts(result == "invalid" ? "@VP8_DESKNET1 INVALID" : result == "saved" ? "@VP8_DESKNET1 CONFIGURED" :
                                "@VP8_DESKNET1 STORAGE_FAILED");
      return;
    }
#endif
    if (name == "WAVE" && line.empty()) serial_wave.store(true);
    if (name == "PLAY2") {
      Key key{};
      if (number(token(line), key.role) && number(token(line), key.action) && line.empty() &&
          key.role < 65535 && key.action < 65535) play_request.store(pack(key));
    }
    if (name == "CANCEL2" && line.empty() && running) cancelled = true;
    if (name == "REBOOT2" && line.empty() && (reboot_ready || station_fault) && !running) {
      puts("@VP8_OTA REBOOT");
      vTaskDelay(pdMS_TO_TICKS(100));
      esp_restart();
    }
    if (name == "OTA2" || name == "MEDIA2") {
      if (station_fault) puts("@VP8_OTA WIFI_CLEANUP_FAILED");
#if VP8_BOOT_PAIRING
      else if (pairing && pairing->prompt()) puts("@VP8_OTA BUSY");
#endif
      else if (running || reboot_ready) puts("@VP8_OTA BUSY");
      else if (parse(line, name == "OTA2")) {
#if VP8_BOOT_PAIRING
        if (pairing) pairing->disconnect();
#endif
        cancelled = false;
        running = true;
        puts("@VP8_OTA ACCEPTED");
      } else {
        scrub(&request.wifi, sizeof(request.wifi));
        puts("@VP8_OTA INVALID");
      }
    }
  });
  scrub(bytes, sizeof(bytes));
}

bool stop() { input(); return cancelled; }

class Http {
  SocketOps ops_;
  int fd_ = -1;
  int64_t deadline_ = 0;

  template<class Io> bool exact(size_t size, Io io) {
    for (size_t at = 0; at < size;) {
      if (stop() || esp_timer_get_time() >= deadline_) return false;
      const int n = io(at, size - at);
      if (n < 0 || size_t(n) > size - at) return false;
      if (n) at += n;
      else vTaskDelay(1);
    }
    return true;
  }

public:
  ~Http() { if (fd_ >= 0) ops_.close(fd_); }
  bool read(std::span<uint8_t> bytes) {
    return exact(bytes.size(), [&](size_t at, size_t n) { return ops_.read(fd_, bytes.data() + at, n); });
  }
  bool open(const Request &job) {
    fd_ = ops_.dial(job.endpoint);
    if (fd_ < 0) return false;
    const auto connect_deadline = esp_timer_get_time() + 4000000;
    for (;;) {
      if (stop() || esp_timer_get_time() >= connect_deadline) return false;
      const int connected = ops_.connected(fd_);
      if (connected < 0) return false;
      if (connected > 0) break;
      vTaskDelay(1);
    }
    deadline_ = esp_timer_get_time() + 60000000;
    const auto [a, b, c, d] = job.endpoint.ip;
    char get[160];
    const int size = snprintf(get, sizeof(get), "GET /%s HTTP/1.1\r\nHost: %u.%u.%u.%u:%u\r\n"
      "Connection: close\r\nAccept-Encoding: identity\r\n\r\n", job.firmware ? "firmware.bin" : "asset.ivf",
      unsigned(a), unsigned(b), unsigned(c), unsigned(d), unsigned(job.endpoint.port));
    if (size <= 0 || size_t(size) >= sizeof(get) || !exact(size, [&](size_t at, size_t n) {
          return ops_.write(fd_, reinterpret_cast<const uint8_t *>(get) + at, n);
        })) return false;
    uint8_t header[512];
    for (size_t i = 0; i < sizeof(header); ++i) {
      if (!read({header + i, 1})) return false;
      if (i >= 3 && !memcmp(header + i - 3, "\r\n\r\n", 4))
        return pet400_persist::http_asset_headers({reinterpret_cast<const char *>(header), i + 1}, job.object.bytes);
    }
    return false;
  }
};

bool app_slot(const esp_partition_t *p) {
  return p && p->size == app_bytes && !p->readonly && !p->encrypted &&
    ((p->subtype == ESP_PARTITION_SUBTYPE_APP_OTA_0 && p->address == 0x200000) ||
     (p->subtype == ESP_PARTITION_SUBTYPE_APP_OTA_1 && p->address == 0x400000));
}

struct Slot {
  const esp_partition_t *dest = esp_ota_get_next_update_partition(nullptr);
  esp_ota_handle_t handle{};
  bool open{};
  ~Slot() { if (open) esp_ota_abort(handle); }
  bool begin(uint32_t bytes) {
    const auto *current = esp_ota_get_running_partition();
    open = app_slot(current) && app_slot(dest) && current->address != dest->address &&
           esp_ota_begin(dest, bytes, &handle) == ESP_OK;
    return open;
  }
  bool write(Clip bytes) { return esp_ota_write(handle, bytes.data(), bytes.size()) == ESP_OK; }
  bool verify() {
    open = false; // IDF releases the handle on every esp_ota_end result.
    if (esp_ota_end(handle) != ESP_OK) return false;
    esp_app_desc_t desc{};
    const auto *current = esp_app_get_description();
    return esp_ota_get_partition_description(dest, &desc) == ESP_OK && desc.version[0] &&
           !memcmp(desc.project_name, current->project_name, sizeof(desc.project_name));
  }
  bool select() { return esp_ota_set_boot_partition(dest) == ESP_OK; }
};

const char *perform(Http &http) {
  const auto receive = [&](std::span<uint8_t> bytes) { return http.read(bytes); };
  if (request.firmware) {
    Slot slot;
    const auto result = transfer(slot, request.object.bytes, request.object.digest, work, receive, stop);
    reboot_ready = result == Transfer::Selected;
    switch (result) {
      case Transfer::Selected: return "SELECTED";
      case Transfer::Cancelled: return "CANCELLED";
      case Transfer::Invalid: return "INVALID_IMAGE";
      default: return "OTA_FAILED";
    }
  }
  Buffer readback;
  if (!readback.bytes) return "NO_MEMORY";
  std::lock_guard lock(cache_mutex);
  const auto result = cache->install(request.object, unpack(playing.load()), work, readback.storage(), receive, stop);
  switch (result) {
    case Result::Saved: cache_revision.fetch_add(1); return "MEDIA_SAVED";
    case Result::Existing: return "MEDIA_EXISTING";
    case Result::Invalid: return "INVALID_MEDIA";
    case Result::Cancelled: return "CANCELLED";
    case Result::Full: return "CACHE_FULL";
    default: return "MEDIA_FAILED";
  }
}

const char *maintenance_on(NetworkStation &station, bool ready) {
  const auto deadline = esp_timer_get_time() + 15000000;
  while (ready && !station.ready() && esp_timer_get_time() < deadline && !stop()) {
    ready = station.poll(esp_timer_get_time());
    vTaskDelay(pdMS_TO_TICKS(10));
  }
  const char *result = "NETWORK_FAILED";
  if (ready && on_link(station.netif(), request.endpoint) && station.ready() && !stop()) {
    Http http;
    if (http.open(request)) result = perform(http);
  }
  return result;
}

#if VP8_DESKTOP_INTERNET
bool release_desktop_station() {
#if VP8_VPC1_LAN
  lan_control.owner.publish_route(lan_identity(), false);
#endif
  if (!desktop_station) return true;
  if (desktop_station->cleanup()) {
    desktop_station.reset();
    return true;
  }
  station_fault = true;
  puts("@VP8_DESKNET1 WIFI_CLEANUP_FAILED");
  return false;
}

void desktop_network_tick() {
  if (station_fault || running || reboot_ready || checking()) return;
  const auto now = esp_timer_get_time();
  if (desktop_reconfigure) {
    if (!vp8_daily::internet_pause(desktop_clock_reconfigure)) return;
    desktop_reconfigure = false;
    desktop_clock_reconfigure = false;
    if (!release_desktop_station()) return;
    desktop_retry.reset(now);
  }
  if (!desktop_online_mode.load(std::memory_order_relaxed) || !desktop_network.count) return;
  if (pairing && pairing->prompt()) {
    vp8_daily::internet_pause(false);
    return;
  }
  if (!desktop_station) {
    if (!desktop_retry.due(now)) return;
    desktop_retry.started(now);
    auto &station = desktop_station.emplace();
    if (!station.start(desktop_network.profiles[desktop_retry.index()]) || esp_wifi_set_ps(WIFI_PS_MIN_MODEM) != ESP_OK) {
      if (release_desktop_station()) desktop_retry.failed(esp_timer_get_time(), desktop_network.count);
      puts("@VP8_DESKNET1 WIFI_START_RETRY");
      return;
    }
  }
  auto &station = *desktop_station;
  if (station.poll(now) && station.ready()) {
    if (!desktop_retry.online()) puts("@VP8_DESKNET1 WIFI_READY");
    desktop_retry.connected();
    vp8_daily::internet_poll(desktop_network.internet, desktop_weather, now, publish_desktop);
    return;
  }
  const bool lost = desktop_retry.online();
  if (!lost && !desktop_retry.expired(now)) return;
  if (!vp8_daily::internet_pause(false) || !release_desktop_station()) return;
  const auto next = esp_timer_get_time();
  if (lost) desktop_retry.reset(next);
  else desktop_retry.failed(next, desktop_network.count);
  puts("@VP8_DESKNET1 WIFI_CONNECT_RETRY");
}
#endif

const char *maintenance() {
#if VP8_DESKTOP_INTERNET
  if (!desktop_online_mode.load(std::memory_order_relaxed)) {
    scrub(&request.wifi, sizeof(request.wifi));
    return "NETWORK_FAILED";
  }
  if (desktop_station && !desktop_reconfigure &&
      std::strcmp(request.wifi.ssid, desktop_network.profiles[desktop_retry.index()].ssid) == 0 &&
      std::strcmp(request.wifi.password, desktop_network.profiles[desktop_retry.index()].password) == 0) {
    scrub(&request.wifi, sizeof(request.wifi));
    const auto *result = maintenance_on(*desktop_station, !stop());
    return cancelled && std::string_view(result) == "NETWORK_FAILED" ? "CANCELLED" : result;
  }
  if (desktop_station && !release_desktop_station()) {
    scrub(&request.wifi, sizeof(request.wifi));
    return "WIFI_CLEANUP_FAILED";
  }
  desktop_retry.reset(esp_timer_get_time());
#endif
  // Keep the observer alive if IDF cannot unregister its event handler.
  static std::optional<NetworkStation> owner;
  auto &station = owner.emplace();
  const bool ready = !stop() && station.start(request.wifi);
  scrub(&request.wifi, sizeof(request.wifi));
  const auto *result = maintenance_on(station, ready);
  if (station.cleanup()) owner.reset();
  else {
    station_fault = true;
    puts("@VP8_OTA WIFI_CLEANUP_FAILED");
  }
  if (cancelled && (std::string_view(result) == "NETWORK_FAILED")) return "CANCELLED";
  return result;
}

void worker(void *) {
  for (;;) {
#if VP8_DESKTOP_INTERNET
    if (!running && !reboot_ready && !checking()) apply_desktop_mode_toggle();
#endif
#if VP8_BOOT_PAIRING
    poll_pairing();
#endif
    input();
#if VP8_FOCUS_MENU
    poll_menu_key(!running && !reboot_ready && !(pairing && pairing->prompt()));
#endif
#if VP8_SENSOR_QUERY
    const bool sensor_busy = running || reboot_ready || station_fault || (pairing && pairing->prompt());
    poll_motion(sensor_busy, esp_timer_get_time());
#endif
    if (running
#if VP8_DESKTOP_INTERNET
        && vp8_daily::internet_pause(false)
#endif
    ) {
#if VP8_VPC1_LAN
      lan_control.owner.publish_route(lan_identity(), false);
#endif
      const auto *result = maintenance();
#if VP8_FOCUS_MENU
      poll_menu_key(false, true);
#endif
      running = false;
      printf("@VP8_OTA %s\n", result);
    }
#if VP8_BATTERY_QUERY
    if (!reboot_ready && !station_fault && !(pairing && pairing->prompt())) {
#if VP8_PLAYFUL_INTERACTIONS
      poll_usb_power();
#endif
      sample_battery();
#if VP8_SLEEP_WAKE
      poll_wake_preload();
#endif
    }
#endif
#if VP8_DESKTOP_INTERNET
    desktop_network_tick();
    publish_desktop_wifi();
#endif
#if VP8_VPC1_LAN
    const auto target = lan_control.owner.target();
    const bool route_ready = target && desktop_station && !desktop_reconfigure && !running && !reboot_ready &&
        !station_fault && !(pairing && pairing->prompt()) && desktop_station->ready() &&
        on_link(desktop_station->netif(), {target->ip, target->port});
    lan_control.owner.publish_route(lan_identity(), route_ready);
#endif
#if VP8_VPC1_USB_PROBE
    poll_control_probe();
#endif
    if (!running && !reboot_ready && !checking() && !(pairing && pairing->prompt()) &&
        usb_serial_jtag_is_connected()) {
      usb_status_subscription.tick(uint64_t(esp_timer_get_time() / 1000), device_status_snapshot,
          [](std::string_view reply) { printf("%.*s\n", int(reply.size()), reply.data()); });
    }
    vTaskDelay(pdMS_TO_TICKS(10));
  }
}

bool confirm_boot() {
  if (!checking()) return true;
#if VP8_OTA_REJECT_BOOT_TEST
  puts("@VP8_OTA INJECTED_BOOT_FAILURE");
  return false;
#elif VP8_OTA_HOLD_CONFIRM_TEST
  puts("@VP8_OTA POWER_TEST_PENDING");
  for (;;) vTaskDelay(pdMS_TO_TICKS(1000));
#else
  if (esp_ota_mark_app_valid_cancel_rollback() != ESP_OK) return false;
  pending_boot.store(false);
  esp_timer_stop(boot_timer);
  esp_timer_delete(boot_timer);
  boot_timer = nullptr;
  puts("@VP8_OTA CONFIRMED");
  return true;
#endif
}
} // namespace

#if VP8_LOCAL_MOTION
vp8_daily::Input take_local_motion(bool eligible) {
  if (!pending_motion.load(std::memory_order_relaxed)) return vp8_daily::Input::none;
  const auto stamp = pending_motion.exchange(0, std::memory_order_relaxed);
  const auto event = vp8_daily::motion_event_at(stamp, uint32_t(esp_timer_get_time() / 1000),
      eligible && motion_allowed.load(std::memory_order_relaxed) && !visible_prompt.load());
  if (event != vp8_daily::Input::none) return event;
  if ((stamp & 3) == 2) motion_retry_tilt.store(true, std::memory_order_relaxed);
  return vp8_daily::Input::none;
}
#endif

#if VP8_SENSOR_QUERY
void observe_touch(bool valid, bool pressed, unsigned x, unsigned y, int64_t now) {
  if (!valid) return;
  portENTER_CRITICAL(&touch_cache_lock);
  touch_cache.observe(valid, pressed, x, y, now);
  portEXIT_CRITICAL(&touch_cache_lock);
}
#endif

bool begin_boot() {
  const auto *part = esp_ota_get_running_partition();
  esp_ota_img_states_t state;
  if (!app_slot(part) || esp_ota_get_state_partition(part, &state) != ESP_OK) {
    puts("@VP8_OTA INVALID_BOOT_STATE");
    return false;
  }
  if (state != ESP_OTA_IMG_PENDING_VERIFY) return state == ESP_OTA_IMG_VALID;
  pending_boot.store(true);
  esp_timer_create_args_t args{};
  args.callback = [](void *) { if (checking()) esp_restart(); };
  args.name = "ota_self_test";
#if VP8_OTA_HOLD_CONFIRM_TEST
  constexpr uint64_t timeout_us = 180000000;
#else
  constexpr uint64_t timeout_us = 25000000;
#endif
  if (esp_timer_create(&args, &boot_timer) != ESP_OK || esp_timer_start_once(boot_timer, timeout_us) != ESP_OK) {
    fail_boot();
    return false;
  }
  return true;
}

bool checking() { return pending_boot.load(); }
void fail_boot() {
  if (!checking()) return;
  puts("@VP8_OTA BOOT_CHECK_FAILED");
  if (esp_ota_mark_app_invalid_rollback_and_reboot() != ESP_OK) esp_restart();
}
bool take_wave() { return serial_wave.exchange(false); }
#if VP8_DESKTOP_INTERNET
bool menu_network_online() { return desktop_online_mode.load(std::memory_order_relaxed); }
void toggle_menu_network() { desktop_mode_toggle.store(true, std::memory_order_relaxed); }
#endif
#if VP8_VPC1_USB_PROBE || VP8_VPC1_LAN
void control_contact(bool valid, bool pressed) {
  if (valid) control_contact_down.store(pressed, std::memory_order_relaxed);
}
bool control_turn(bool idle) {
  if (!control_connected.load(std::memory_order_relaxed) && !control_selected.load(std::memory_order_relaxed))
    return false;
  const bool down = control_contact_down.load(std::memory_order_relaxed);
  std::lock_guard lock(control_mutex);
  const auto now = control_now();
  if (control_playback.ticket()) return control_playback.interrupted(now, down);
  auto &core = control_playback.control();
  return idle && !down && !focus_timer.active() && !visible_prompt.load() &&
         core.tick(now) && core.waiting();
}
std::optional<vp8_control::Ticket> control_ticket() {
  if (!control_selected.load(std::memory_order_relaxed)) return std::nullopt;
  std::lock_guard lock(control_mutex);
  return control_playback.ticket();
}
bool control_can_submit(const vp8_control::Ticket &ticket) {
  std::lock_guard lock(control_mutex);
  return !control_contact_down.load(std::memory_order_relaxed) && !visible_prompt.load() &&
         control_playback.can_submit(ticket, control_now());
}
void control_first_dma(const vp8_control::Ticket &ticket) {
  std::lock_guard lock(control_mutex);
  if (!control_contact_down.load(std::memory_order_relaxed) && !visible_prompt.load())
    control_playback.first_dma(ticket, control_now());
}
#endif
#if VP8_FOCUS_MENU
bool take_menu_key() { return menu_key.exchange(false, std::memory_order_relaxed); }
bool focus_due(int64_t now) { return focus_timer.expired(now); }
int focus_seconds(int64_t now) { return focus_timer.active() ? focus_timer.remaining(now) : 0; }
vp8_daily::DesktopStatus desktop_status() {
  portENTER_CRITICAL(&desktop_lock);
  const auto snapshot = desktop_cache;
  portEXIT_CRITICAL(&desktop_lock);
  return snapshot.snapshot(esp_timer_get_time());
}
#endif
#if VP8_SLEEP_WAKE
void note_sleep_activity(int64_t now) {
  sleep_clock.activity(now);
  wake_preload_requested.store(false, std::memory_order_relaxed);
}
void request_wake_preload(int64_t now) {
  if (sleep_clock.request_preload(now)) wake_preload_requested.store(true, std::memory_order_relaxed);
}
void note_wake_touch(int64_t now, int64_t poll_gap) {
  wake_timing.detected_us = now;
  wake_timing.poll_gap_us = poll_gap;
}
#if VP8_LIFT_WAKE
void arm_lift_wake() { lift_wake_event.arm(); }
bool take_lift_wake() {
  int64_t now{};
  const auto age = lift_wake_event.take_age([&] {
    now = esp_timer_get_time();
    return uint32_t(now / 1000);
  });
  if (!age) return false;
  wake_timing.detected_us = now - int64_t(*age) * 1000;
  wake_timing.poll_gap_us = -1;
  return true;
}
#endif
WakeTiming take_wake_timing() {
  const auto timing = wake_timing;
  wake_timing = {};
  return timing;
}
bool sleep_external_wake() {
  return visible_prompt.load() != 0 || play_request.load() != no_request
#if VP8_VPC1_USB_PROBE || VP8_VPC1_LAN
      || control_waiting()
#endif
      ;
}
#endif
#if VP8_PLAYFUL_INTERACTIONS
Input take_power_reaction(bool include_background) {
  if (visible_prompt.load() != 0) return Input::none;
  if (pending_breakfast.load() && pending_breakfast.exchange(false)) return Input::usb_connected;
  if (!include_background || pending_power.load() == Input::none) return Input::none;
  return pending_power.exchange(Input::none);
}
#endif

#if VP8_BOOT_PAIRING
uint32_t pairing_prompt() { return visible_prompt.load(); }
void pairing_prompt_drawn(uint32_t reference) { drawn_prompt.store(reference); }
#endif

bool run(Playback playback, vp8_daily::Input (*take_input)()
#if VP8_FOCUS_MENU
         , void (*show_menu)(vp8_daily::FocusTimer &, vp8_daily::FocusPage)
#endif
         ) {
  const auto *part = esp_partition_find_first(ESP_PARTITION_TYPE_DATA, esp_partition_subtype_t(0x42), "pet_vp8");
  if (!part || part->address != media_address || part->size != media_bytes || part->encrypted || part->readonly)
    return false;
  auto *memory = heap_caps_malloc(sizeof(Cache<Flash>), MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
  if (!memory) return false;
  cache = new (memory) Cache(Flash{part});
  const unsigned roots = cache->mount();
  if (!roots || (checking() && roots != 2)) return false;

  Buffer idle, wave, other;
  if (!idle.bytes || !wave.bytes || !other.bytes || !load(idle_key, idle) || !load(wave_key, wave)) return false;
  if (checking() && (!playback(vp8_daily::idle, idle.media(), false) || !confirm_boot())) return false;
  const auto *app = esp_app_get_description();
  const auto *app_part = esp_ota_get_running_partition();
  if (!app_slot(app_part)) return false;
  std::copy_n(app->version, status_version.size(), status_version.begin());
  status_version.back() = '\0';
  status_slot = app_part->subtype - ESP_PARTITION_SUBTYPE_APP_OTA_0;
#if VP8_BOOT_PAIRING
  init_pairing();
#endif
#if VP8_BATTERY_QUERY
  const auto battery_init = round_battery_init();
  if (battery_init != ESP_OK) printf("@VP8_BATTERY_INIT error=%s\n", esp_err_to_name(battery_init));
#endif
#if VP8_FOCUS_MENU
  const auto key_init = round_power_key_init();
  menu_key_ready = key_init == ESP_OK;
  printf("@VP8_MENU KEY_INIT result=%s\n", esp_err_to_name(key_init));
#endif
#if VP8_DESKTOP_INTERNET
  load_desktop_network();
  load_desktop_weather();
#endif
#if VP8_VPC1_LAN
  if (!lan_control.owner.start()) puts("@VP8_VPCNET1 TASK_UNAVAILABLE");
#endif
  constexpr unsigned worker_stack =
#if VP8_DESKTOP_INTERNET
      8192;
#else
      6144;
#endif
  usb_serial_jtag_driver_config_t usb{256, 384};
  if (usb_serial_jtag_driver_install(&usb) != ESP_OK ||
      xTaskCreatePinnedToCore(worker, "vp8_ota", worker_stack, nullptr, 2, nullptr, 1) != pdPASS) {
    puts("@VP8_OTA MAINTENANCE_UNAVAILABLE");
  }
  printf("@VP8_OTA OFFLINE roots=%u\n", roots);
  IdlePolicy policy;
  unsigned index = vp8_daily::idle;
#if VP8_TOUCH_SWIPE
  uint16_t browse_from = 0;
  auto browse_input = vp8_daily::Input::none;
#endif
#if VP8_PLAYFUL_INTERACTIONS
  std::optional<uint16_t> previous_surprise;
  auto power_reaction = Input::none;
#endif
  auto apply_input = [&](vp8_daily::Input input) {
#if VP8_VPC1_USB_PROBE || VP8_VPC1_LAN
    if (input == Input::control_ready) {
      index = vp8_daily::idle;
      return;
    }
#endif
#if VP8_FOCUS_MENU
    if (input == Input::open_menu || input == Input::open_focus) {
#if VP8_LOCAL_MOTION
      motion_allowed.store(false, std::memory_order_relaxed);
#endif
      puts("@VP8_MENU OPEN");
      show_menu(focus_timer, input == Input::open_focus ? vp8_daily::FocusPage::timer : vp8_daily::FocusPage::launcher);
      note_sleep_activity(esp_timer_get_time());
      policy.idle_loops = 0;
      index = vp8_daily::idle;
      puts("@VP8_MENU CLOSE");
      return;
    }
    if (input == Input::focus_due) {
      index = vp8_daily::idle;
      return;
    }
#endif
#if VP8_SLEEP_WAKE
    if (input != vp8_daily::Input::none) note_sleep_activity(esp_timer_get_time());
#endif
#if VP8_PLAYFUL_INTERACTIONS
    if (power_action(input)) {
      power_reaction = input;
      index = vp8_daily::idle;
      return;
    }
#endif
#if VP8_TOUCH_SWIPE
    if (input == vp8_daily::Input::previous || input == vp8_daily::Input::next || input == vp8_daily::Input::surprise ||
        input == vp8_daily::Input::motion_shake || input == vp8_daily::Input::motion_tilt ||
        input == vp8_daily::Input::petting) {
      browse_input = input;
      policy.idle_loops = 0;
      index = vp8_daily::idle;
      return;
    }
#endif
    index = policy.next(index, input == vp8_daily::Input::wave);
  };
#if VP8_SLEEP_WAKE
  note_sleep_activity(esp_timer_get_time());
#endif
  uint32_t loaded_revision = cache_revision.load();
#if VP8_VPC1_USB_PROBE || VP8_VPC1_LAN
  const auto claim_control = [&]() -> std::optional<vp8_control::Ticket> {
    if (!control_connected.load(std::memory_order_relaxed)) return std::nullopt;
    std::lock_guard lock(control_mutex);
    const bool local_busy = focus_timer.active() || visible_prompt.load() ||
        control_contact_down.load(std::memory_order_relaxed);
    const auto ticket = control_playback.claim(control_now(), local_busy);
    control_selected.store(ticket.has_value(), std::memory_order_relaxed);
    return ticket;
  };
#endif
  for (;;) {
#if VP8_SLEEP_WAKE
    if ((index == vp8_daily::idle || index == IdlePolicy::choose_idle) && sleep_clock.due(esp_timer_get_time()) &&
#if VP8_FOCUS_MENU
        !focus_timer.active() &&
#endif
        browse_input == Input::none && power_reaction == Input::none && !serial_wave.load() &&
        !pending_breakfast.load() && !sleep_external_wake()) {
#if VP8_LOCAL_MOTION
      motion_allowed.store(false, std::memory_order_relaxed);
#endif
      const auto input = sleep_cycle(playback, take_input, other);
      note_sleep_activity(esp_timer_get_time());
      index = vp8_daily::idle;
      policy.idle_loops = 0;
      if (input != Input::none) apply_input(input);
      continue;
    }
#endif
    Buffer *clip = index == vp8_daily::wave ? &wave : &idle;
#if VP8_LOCAL_MOTION
    bool automatic_clip = false;
#endif
    {
      std::unique_lock lock(cache_mutex, std::try_to_lock);
      if (lock.owns_lock()) {
        if (const auto revision = cache_revision.load(); loaded_revision != revision) {
          refresh(idle_key, idle, other);
          refresh(wave_key, wave, other);
          loaded_revision = revision;
        }
        if (index != vp8_daily::wave) {
#if VP8_FOCUS_MENU
          if (focus_timer.take_completion(esp_timer_get_time())) {
            puts("@VP8_FOCUS COMPLETE");
            note_sleep_activity(esp_timer_get_time());
            policy.idle_loops = 0;
            if (load({0, 74}, other)) {
              clip = &other;
              index = extra_index;
              puts("@VP8_FOCUS STRETCH");
            } else {
              puts("@VP8_FOCUS STRETCH_UNAVAILABLE");
            }
          } else
#endif
#if VP8_TOUCH_SWIPE
          if (browse_input != vp8_daily::Input::none) {
            const auto input = browse_input;
            browse_input = vp8_daily::Input::none;
            const auto installed = [](uint16_t id) { return cache->find({0, id}) != nullptr; };
            std::optional<uint16_t> selected;
            const char *event = "SWIPE_PLAY";
            const bool swiping = input == vp8_daily::Input::previous || input == vp8_daily::Input::next;
            if (swiping) selected = browse_action(browse_from, input, installed);
#if VP8_PLAYFUL_INTERACTIONS
            else if (input == Input::petting) {
              selected = pick_petting(installed);
              event = "PETTING_PLAY";
            } else if (input == Input::surprise) {
              selected = pick_surprise(esp_random(), previous_surprise, installed);
              event = "SURPRISE_PLAY";
            } else {
              selected = pick_motion(input, installed);
              event = input == Input::motion_tilt ? "MOTION_TILT" : "MOTION_SHAKE";
            }
#endif
            if (selected) {
              if (load({0, *selected}, other)) {
                clip = &other;
                index = extra_index;
                if (swiping) browse_from = *selected;
#if VP8_PLAYFUL_INTERACTIONS
                if (input == Input::surprise) previous_surprise = *selected;
#endif
                printf("@VP8_OTA %s id=%u\n", event, unsigned(*selected));
              } else {
                printf("@VP8_OTA INTERACTION_LOAD_FAILED source=%s id=%u\n", event, unsigned(*selected));
              }
            }
          } else
#endif
          {
            const auto wanted = play_request.exchange(no_request);
            if (wanted != no_request) {
#if VP8_SLEEP_WAKE
              note_sleep_activity(esp_timer_get_time());
#endif
              const auto key = unpack(wanted);
              if (key == wave_key) {
                clip = &wave;
                index = vp8_daily::wave;
              } else if (key != idle_key) {
                if (load(key, other)) { clip = &other; index = extra_index; }
                else puts("@VP8_OTA PLAY_MISSING");
              }
            }
#if VP8_PLAYFUL_INTERACTIONS
            else if (power_reaction != Input::none || (power_reaction = take_power_reaction(true)) != Input::none) {
              const auto action = power_action(power_reaction);
              power_reaction = Input::none;
              if (load({0, action}, other)) {
                clip = &other;
                index = extra_index;
                printf("@VP8_OTA POWER_PLAY id=%u\n", unsigned(action));
                if (action == power_action(Input::usb_connected))
                  printf("@VP8_OTA BREAKFAST_SELECTED at_us=%lld\n", static_cast<long long>(esp_timer_get_time()));
              } else printf("@VP8_OTA POWER_MISSING id=%u\n", unsigned(action));
            }
#endif
#if VP8_VPC1_USB_PROBE || VP8_VPC1_LAN
            else if (const auto ticket = claim_control()) {
              const Key key{ticket->role, ticket->action};
              if (key == wave_key) {
                clip = &wave;
                index = vp8_daily::wave;
              } else if (key != idle_key) {
                if (load(key, other)) {
                  clip = &other;
                  index = extra_index;
                } else {
                  control_finished(true);
                }
              }
              if (control_selected.load(std::memory_order_relaxed)) note_sleep_activity(esp_timer_get_time());
            }
#endif
            else if (index == IdlePolicy::choose_idle
#if VP8_FOCUS_MENU
                     && !focus_timer.active()
#endif
                     ) {
              const auto selected = policy.pick(esp_random(), [](uint16_t id) { return cache->find({0, id}); });
              if (selected && load({0, *selected}, other)) {
                printf("@VP8_OTA IDLE_PICK id=%u\n", unsigned(*selected));
                clip = &other;
                index = extra_index;
#if VP8_LOCAL_MOTION
                automatic_clip = true;
#endif
              }
            }
          }
        }
        if (clip == &idle) index = vp8_daily::idle;
        playing.store(pack(clip->object.key));
      } else {
        // The network owner holds the catalogue during commit. Hot clips stay available in PSRAM.
        if (clip == &idle) index = vp8_daily::idle;
        playing.store(pack(clip->object.key));
      }
    }
#if VP8_LOCAL_MOTION
    motion_allowed.store((clip == &idle || automatic_clip)
#if VP8_FOCUS_MENU
                         && !focus_timer.active()
#endif
                         , std::memory_order_relaxed);
#endif
    const bool played = playback(index, clip->media(), false);
#if VP8_VPC1_USB_PROBE || VP8_VPC1_LAN
    control_finished();
#endif
    if (!played) {
      puts("@VP8_OTA PLAY_FAILED");
      if (clip != &other) {
        std::lock_guard lock(cache_mutex);
        if (!load(clip->object.key, other, &clip->object)) return false;
        clip->swap(other);
      }
      index = vp8_daily::idle;
      continue;
    }
    apply_input(take_input());
  }
}
} // namespace vp8_ota

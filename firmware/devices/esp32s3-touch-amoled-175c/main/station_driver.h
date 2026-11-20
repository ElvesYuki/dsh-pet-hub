#pragma once
#include "station_bootstrap.h"
#include "station_watch.h"
#include "esp_event.h"
#include "esp_wifi.h"
#include "esp_wifi_default.h"
namespace pet400_transport {
struct ControlStationObserver {
  esp_err_t start(esp_netif_t *n){return firmware_watch_station(n);}
  esp_err_t stop(){return firmware_unwatch_station();}
  bool ready()const{return firmware_station_ready();}
};
// All methods on one trusted owner. Observer callbacks only publish atomics.
template<class Observer> class BasicStationDriver {
  Observer observer_;
  esp_netif_t *netif_=nullptr;
  esp_event_handler_instance_t retry_handler_=nullptr;
  std::atomic<uint32_t> live_{0},retry_{0};
  bool used_=false,loop_=false,wifi_=false,started_=false,watched_=false,attached_=false;
  uint64_t next_connect_=0;
  esp_err_t error_=ESP_OK,cleanup_error_=ESP_OK;
  static void event(void *ctx,esp_event_base_t base,int32_t id,void *) {
    auto &self=*static_cast<BasicStationDriver*>(ctx);
    if(self.live_.load(std::memory_order_acquire) && base==WIFI_EVENT &&
       (id==WIFI_EVENT_STA_START || id==WIFI_EVENT_STA_DISCONNECTED))self.retry_.store(1,std::memory_order_release);
  }
  bool checked(esp_err_t err) { if(err==ESP_OK)return true;error_=err;return false; }
public:
  esp_err_t error() const { return error_; }
  esp_err_t cleanup_error() const { return cleanup_error_; }
  esp_netif_t *netif()const{return netif_;} // Stable until successful cleanup.
  bool ready()const{return started_ && observer_.ready();}
  bool start(const Credentials &credentials) {
    if(used_ || !valid(credentials))return checked(ESP_ERR_INVALID_STATE);
    used_=true;
    if(!checked(esp_netif_init()))return false; // Global SDK init cannot be fully undone.
    if(!checked(esp_event_loop_create_default()))return false; // Never borrow/delete an existing loop.
    loop_=true;esp_netif_config_t net_config=ESP_NETIF_DEFAULT_WIFI_STA();netif_=esp_netif_new(&net_config);
    if(!netif_)return checked(ESP_ERR_NO_MEM);
    attached_=true; // SDK publishes its STA pointer even when attach later fails.
    if(!checked(esp_netif_attach_wifi_station(netif_)) || !checked(esp_wifi_set_default_wifi_sta_handlers()))return false;
    wifi_init_config_t init=WIFI_INIT_CONFIG_DEFAULT();init.nvs_enable=0;
    if(!checked(esp_wifi_init(&init)))return false;
    wifi_=true;
    if(!checked(esp_wifi_set_storage(WIFI_STORAGE_RAM)) || !checked(esp_wifi_set_mode(WIFI_MODE_STA)))return false;
    wifi_config_t config{};
    memcpy(config.sta.ssid,credentials.ssid,strlen(credentials.ssid));
    memcpy(config.sta.password,credentials.password,strlen(credentials.password));
    config.sta.threshold.authmode=credentials.password[0]?WIFI_AUTH_WPA2_PSK:WIFI_AUTH_OPEN;
    config.sta.pmf_cfg.capable=true;
    const auto configured=esp_wifi_set_config(WIFI_IF_STA,&config);scrub(&config,sizeof(config));
    if(!checked(configured))return false;
    watched_=true;if(!checked(observer_.start(netif_)))return false;
    if(!checked(esp_event_handler_instance_register(WIFI_EVENT,ESP_EVENT_ANY_ID,event,this,&retry_handler_)))return false;
    live_.store(1,std::memory_order_release);
    if(!checked(esp_wifi_start())) { live_.store(0,std::memory_order_release);return false; }
    started_=true;retry_.store(1,std::memory_order_release);return true;
  }
  bool poll(uint64_t now) {
    if(!started_ || !live_.load(std::memory_order_acquire))return false;
    if(observer_.ready()) { retry_.store(0,std::memory_order_release);return true; }
    if(now<next_connect_ || !retry_.exchange(0,std::memory_order_acq_rel))return true;
    if(now>UINT64_MAX-10000)return checked(ESP_ERR_INVALID_STATE);
    next_connect_=now+10000;
    // A transient connect error is diagnosed and retried within the fixed budget.
    const auto err=esp_wifi_connect();
    if(err!=ESP_OK) { error_=err;retry_.store(1,std::memory_order_release); }
    return true;
  }
  bool cleanup() {
    live_.store(0,std::memory_order_release);retry_.store(0,std::memory_order_release);
    cleanup_error_=ESP_OK;
    if(started_) { const auto e=esp_wifi_stop();if(e!=ESP_OK) { cleanup_error_=e;return false; }started_=false; }
    if(retry_handler_) {
      const auto e=esp_event_handler_instance_unregister(WIFI_EVENT,ESP_EVENT_ANY_ID,retry_handler_);
      if(e!=ESP_OK) { cleanup_error_=e;return false; }retry_handler_=nullptr;
    }
    if(watched_) { const auto e=observer_.stop();if(e!=ESP_OK) { cleanup_error_=e;return false; }watched_=false; }
    if(wifi_) { const auto e=esp_wifi_deinit();if(e!=ESP_OK) { cleanup_error_=e;return false; }wifi_=false; }
    if(attached_) {
      const auto e=esp_wifi_clear_default_wifi_driver_and_handlers(netif_);
      if(e!=ESP_OK) { cleanup_error_=e;return false; }attached_=false;
    }
    if(netif_) { esp_netif_destroy(netif_);netif_=nullptr; }
    if(loop_) { const auto e=esp_event_loop_delete_default();if(e!=ESP_OK) { cleanup_error_=e;return false; }loop_=false; }
    return true;
  }
};
using StationDriver=BasicStationDriver<ControlStationObserver>;
}

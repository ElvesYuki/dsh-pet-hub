#pragma once
#include "esp_err.h"
#include "esp_netif.h"
namespace pet400_transport {
// Trusted single lifecycle caller, before STA start; no snapshot/polling ready inference.
esp_err_t firmware_watch_station(esp_netif_t *station);
// Async owner fence this boot, NOT a socket-close completion barrier. An in-flight
// pump may publish its sampled up once; the next owner pump delivers permanent down.
esp_err_t firmware_unwatch_station();
void firmware_station_progress(); // Owner task ONLY; sole Link publisher.
bool firmware_station_ready(); // Latest observed event, not a poll of actual radio state.
}

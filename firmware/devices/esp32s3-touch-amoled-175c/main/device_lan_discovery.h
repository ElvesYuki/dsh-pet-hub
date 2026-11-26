#pragma once

#include "device_lan_candidates.h"
#include "mdns.h"
#include <strings.h>

namespace vp8_lan::discovery {
class Results {
 public:
  Results() = default;
  Results(const Results &) = delete;
  Results &operator=(const Results &) = delete;
  ~Results() { mdns_query_results_free(head); }

  mdns_result_t *head{};
};

inline bool version_supported(const mdns_result_t &result) {
  if (!result.txt || !result.txt_value_len) return false;
  bool version = false;
  for (size_t i = 0; i < result.txt_count; ++i) {
    const auto &entry = result.txt[i];
    if (!entry.key || strcasecmp(entry.key, "version") != 0) continue;
    if (version || !entry.value || result.txt_value_len[i] != 1 || entry.value[0] != '1') return false;
    version = true;
  }
  return version;
}

inline bool add_ipv4(Candidates &candidates, const Subnet &subnet, const mdns_result_t &record, uint16_t port) {
  bool has_ipv4 = false;
  for (auto *ip = record.addr; ip; ip = ip->next) {
    if (ip->addr.type != ESP_IPADDR_TYPE_V4) continue;
    has_ipv4 = true;
    candidates.add(subnet, {ipv4_bytes(ip->addr.u_addr.ip4.addr), port});
  }
  return has_ipv4;
}

template <typename Current>
std::optional<Candidates> query(esp_netif_t *interface, const Subnet &subnet, Current current) {
  Results services;
  if (mdns_query_ptr("_dsh-pet-hub", "_tcp", 1200, Candidates::capacity, &services.head) != ESP_OK)
    return std::nullopt;

  Candidates candidates;
  unsigned lookups_left = 2;
  for (auto *record = services.head; record; record = record->next) {
    if (!current()) return Candidates{};
    if (record->esp_netif != interface || !record->ttl || !record->port || !version_supported(*record)) continue;
    if (add_ipv4(candidates, subnet, *record, record->port) ||
        !lookups_left || !record->hostname || !record->hostname[0]) continue;

    // The SDK can miss an additional A record that arrives before its SRV.
    // Resolve only the hostname of a valid service and keep its original port.
    --lookups_left;
    Results addresses;
    if (mdns_query_generic(record->hostname, nullptr, nullptr, MDNS_TYPE_A, MDNS_QUERY_MULTICAST,
                           600, Candidates::capacity, &addresses.head) != ESP_OK) continue;
    if (!current()) return Candidates{};
    for (auto *address = addresses.head; address; address = address->next)
      if (address->esp_netif == interface && address->ttl && address->hostname &&
          strcasecmp(address->hostname, record->hostname) == 0)
        add_ipv4(candidates, subnet, *address, record->port);
  }
  return candidates;
}
} // namespace vp8_lan::discovery

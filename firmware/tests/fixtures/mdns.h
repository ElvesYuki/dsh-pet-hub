#pragma once

#include <cstddef>
#include <cstdint>

struct esp_netif_t {};
struct mdns_txt_item_t { const char *key, *value; };
struct mdns_ip_addr_t {
  struct {
    uint8_t type;
    struct { struct { uint32_t addr; } ip4; } u_addr;
  } addr;
  mdns_ip_addr_t *next{};
};
struct mdns_result_t {
  mdns_result_t *next{};
  esp_netif_t *esp_netif{};
  uint32_t ttl{};
  const char *hostname{};
  uint16_t port{};
  mdns_txt_item_t *txt{};
  uint8_t *txt_value_len{};
  std::size_t txt_count{};
  mdns_ip_addr_t *addr{};
};

enum { ESP_OK = 0, MDNS_QUERY_MULTICAST = 1, MDNS_TYPE_A = 1, ESP_IPADDR_TYPE_V4 = 0 };
int mdns_query_ptr(const char *service, const char *protocol, uint32_t timeout, std::size_t limit, mdns_result_t **out);
int mdns_query_generic(const char *name, const char *service, const char *protocol, uint16_t type, int transmission,
                       uint32_t timeout, std::size_t limit, mdns_result_t **out);
void mdns_query_results_free(mdns_result_t *);

#include "device_lan_discovery.h"

#include <cassert>
#include <string_view>

using namespace vp8_lan;

namespace {
esp_netif_t sta, other_interface;
const Subnet subnet{{192, 168, 1, 25}, {255, 255, 255, 0}};
const Ipv4 hub{192, 168, 1, 11};
mdns_txt_item_t version{"version", "1"};
uint8_t txt_length = 1;
mdns_result_t *services{}, *addresses{};
bool current = true, cancel_in_lookup = false;
unsigned lookups{}, releases{};
int ptr_error{}, address_error{};

mdns_ip_addr_t ipv4(Ipv4 address) { return {{ESP_IPADDR_TYPE_V4, {{std::bit_cast<uint32_t>(address)}}}}; }

mdns_result_t service(uint16_t port, mdns_ip_addr_t *ip = nullptr, const char *host = "hub") {
  return {.esp_netif = &sta, .ttl = 120, .hostname = host, .port = port,
          .txt = &version, .txt_value_len = &txt_length, .txt_count = 1, .addr = ip};
}

auto query() { return discovery::query(&sta, subnet, [] { return current; }); }
} // namespace

int mdns_query_ptr(const char *service_name, const char *protocol, uint32_t timeout, size_t limit, mdns_result_t **out) {
  assert(std::string_view(service_name) == "_dsh-pet-hub" && std::string_view(protocol) == "_tcp");
  assert(timeout == 1200 && limit == Candidates::capacity);
  *out = services;
  return ptr_error;
}

int mdns_query_generic(const char *name, const char *service_name, const char *protocol, uint16_t type, int transmission,
                       uint32_t timeout, size_t limit, mdns_result_t **out) {
  assert(std::string_view(name) == "hub" && !service_name && !protocol);
  assert(type == MDNS_TYPE_A && transmission == MDNS_QUERY_MULTICAST);
  assert(timeout == 600 && limit == Candidates::capacity);
  ++lookups;
  if (cancel_in_lookup) current = false;
  *out = addresses;
  return address_error;
}

void mdns_query_results_free(mdns_result_t *result) { if (result) ++releases; }

int main() {
  auto correct_ip = ipv4(hub), off_link = ipv4({192, 168, 2, 11});
  auto announcement = service(8000, &correct_ip);
  services = &announcement;
  const Target original{hub, 8000}, replacement{hub, 8001};
  assert(query()->next() == original && lookups == 0 && releases == 1);

  // After a port change, the SDK dropped A observed before SRV in the reply.
  auto changed = service(8001);
  services = &changed;
  mdns_result_t matching_address{.esp_netif = &sta, .ttl = 120, .hostname = "Hub", .addr = &correct_ip};
  addresses = &matching_address;
  assert(query()->next() == replacement && lookups == 1 && releases == 3);

  matching_address.esp_netif = &other_interface;
  assert(!query()->pending());
  matching_address.esp_netif = &sta;
  matching_address.ttl = 0;
  assert(!query()->pending());
  matching_address.ttl = 120;
  matching_address.hostname = "another-host";
  assert(!query()->pending());
  matching_address.hostname = "hub";
  matching_address.addr = &off_link;
  assert(!query()->pending());
  matching_address.addr = &correct_ip;
  address_error = -1;
  assert(!query()->pending());
  address_error = 0;

  const auto earlier_lookups = lookups;
  changed.ttl = 0;
  assert(!query()->pending());
  changed.ttl = 120;
  changed.esp_netif = &other_interface;
  assert(!query()->pending());
  changed.esp_netif = &sta;
  changed.port = 0;
  assert(!query()->pending());
  changed.port = 8001;
  changed.hostname = nullptr;
  assert(!query()->pending());
  changed.hostname = "hub";
  version.value = "2";
  assert(!query()->pending() && lookups == earlier_lookups);
  version.value = "1";

  auto second = service(8002), third = service(8003);
  changed.next = &second;
  second.next = &third;
  auto bounded = query();
  const Target second_target{hub, 8002};
  assert(bounded->next() == replacement && bounded->next() == second_target && !bounded->pending());
  assert(lookups == earlier_lookups + 2);

  announcement.next = &changed;
  services = &announcement;
  cancel_in_lookup = true;
  assert(!query()->pending() && lookups == earlier_lookups + 3);
  assert(!query()->pending() && lookups == earlier_lookups + 3);

  ptr_error = -1;
  assert(!query());
}

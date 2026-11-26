#include "device_lan_candidates.h"
#include "device_lan_discovery_wire.h"
#include <cassert>
#include <string>

int main() {
  using namespace vp8_lan;
  using Operation = DiscoveryCommand::Operation;
  const auto request = "a1234567 ENABLE " + std::string(62, 'a') + "3b";
  const auto enabled = discovery_command(request);
  assert(enabled.id == "a1234567" && enabled.operation == Operation::enable);
  assert(enabled.key_hash.front() == 0xaa && enabled.key_hash.back() == 0x3b);
  assert(discovery_command("a1234567 DISABLE").operation == Operation::disable);
  assert(discovery_command("a1234567 DISABLE ").operation == Operation::invalid);
  assert(discovery_command("a1234567 ENABLE " + std::string(64, 'A')).operation == Operation::invalid);
  assert(discovery_command("a1234567 ENABLE " + std::string(63, 'a')).operation == Operation::invalid);
  assert(discovery_command("A1234567 DISABLE").id.empty());
  assert(valid_discovery_id("a1234567"));
  assert(!valid_discovery_id("a1234567 ") && !valid_discovery_id("A1234567") && !valid_discovery_id(""));

  const Subnet network{{192, 168, 1, 25}, {255, 255, 255, 0}};
  Candidates candidates;
  assert(!candidates.add(network, {{192, 168, 1, 0}, 1}));
  assert(!candidates.add(network, {{192, 168, 1, 255}, 1}));
  assert(!candidates.add(network, {{192, 168, 1, 25}, 1}));
  assert(!candidates.add(network, {{192, 168, 2, 35}, 1}));
  assert(!candidates.add(network, {{192, 168, 1, 24}, 0}));
  assert(!candidates.add({{192, 168, 1, 25}, {255, 255, 253, 0}}, {{192, 168, 1, 24}, 1}));
  const Target first{{192, 168, 1, 11}, 1234}, second{{192, 168, 1, 12}, 1234};
  assert(candidates.add(network, first) && !candidates.add(network, first) && candidates.add(network, second));
  for (unsigned i = 2; i < Candidates::capacity; ++i)
    assert(candidates.add(network, {{192, 168, 1, uint8_t(11 + i)}, 1234}));
  assert(!candidates.add(network, {{192, 168, 1, 30}, 1234}));
  assert(candidates.next() == first && candidates.next() == second);
  for (unsigned i = 2; i < Candidates::capacity; ++i) assert(candidates.next());
  assert(!candidates.pending() && !candidates.next());

  DiscoveryReconnect reconnect;
  assert(!reconnect.take(network));
  reconnect.remember(first);
  assert(reconnect.take(network) == first);
  assert(!reconnect.take(network)); // Failed direct retry must move on to discovery.
  Candidates rediscovered;
  assert(rediscovered.add(network, second) && rediscovered.next() == second);
  reconnect.remember(second);
  const Subnet moved{{192, 168, 2, 25}, {255, 255, 255, 0}};
  assert(!reconnect.take(moved) && !reconnect.take(network));
  reconnect.remember(second);
  reconnect.clear(); // Route, binding or discovery authorization changed.
  assert(!reconnect.take(network));
}

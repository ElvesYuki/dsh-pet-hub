#pragma once

#include <array>
#include <cstdint>
#include <string_view>

namespace vp8_lan {
inline bool valid_discovery_id(std::string_view id) {
  return id.size() == 8 && id.find_first_not_of("0123456789abcdef") == id.npos;
}

struct DiscoveryCommand {
  enum class Operation { invalid, enable, disable };
  std::string_view id;
  Operation operation{Operation::invalid};
  std::array<uint8_t, 32> key_hash{};
};

inline DiscoveryCommand discovery_command(std::string_view request) {
  if (request.size() <= 8 || request[8] != ' ') return {};
  const auto id = request.substr(0, 8);
  if (!valid_discovery_id(id)) return {};
  request.remove_prefix(9);
  DiscoveryCommand command{id};
  if (request == "DISABLE") command.operation = DiscoveryCommand::Operation::disable;
  else if (request.starts_with("ENABLE ") && request.size() == 71) {
    request.remove_prefix(7);
    const auto nibble = [](char ch) {
      if (ch >= '0' && ch <= '9') return ch - '0';
      if (ch >= 'a' && ch <= 'f') return ch - 'a' + 10;
      return -1;
    };
    for (unsigned i = 0; i < command.key_hash.size(); ++i) {
      const auto hi = nibble(request[2 * i]), lo = nibble(request[2 * i + 1]);
      if (hi < 0 || lo < 0) return DiscoveryCommand{id};
      command.key_hash[i] = uint8_t(hi * 16 + lo);
    }
    command.operation = DiscoveryCommand::Operation::enable;
  }
  return command;
}
} // namespace vp8_lan

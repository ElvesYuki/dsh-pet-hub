#include "desktop_internet.h"
#include <iostream>
#include <string>

int main() {
  using Operation = vp8_daily::DesktopNetworkCommand::Operation;
  for (std::string line; std::getline(std::cin, line);) {
    if (!line.starts_with("DESKNET2 ")) return 1;
    const auto request = vp8_daily::desktop_network_command(std::string_view(line).substr(9));
    if (request.id.empty()) return 2;
    std::cout << "@VP8_DESKNET2 id=" << request.id << " status=";
    switch (request.operation) {
      case Operation::info: std::cout << "ok configured=0 link=off"; break;
      case Operation::set:
        if (request.settings != "e59c86e5b18f 4669787475726520313233 ntp.example weather.example 480 -1234 75678") return 3;
        if (!vp8_daily::internet_host("ntp.example") || !vp8_daily::internet_host("weather.example")) return 4;
        std::cout << "saved configured=1 link=connecting";
        break;
      case Operation::clear: std::cout << "cleared configured=0 link=off"; break;
      default: return 5;
    }
    std::cout << '\n';
  }
}

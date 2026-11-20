#include "desktop_internet.h"
#include <iostream>
#include <string>

int main() {
  using Operation = vp8_daily::DesktopNetworkCommand::Operation;
  std::optional<vp8_daily::WeatherLocation> location;
  for (std::string line; std::getline(std::cin, line);) {
    if (!line.starts_with("DESKWEATHER1 ")) return 1;
    const auto request = vp8_daily::desktop_network_command(std::string_view(line).substr(13));
    if (request.id.empty()) return 2;
    std::cout << "@VP8_DESKWEATHER1 id=" << request.id << " status=";
    switch (request.operation) {
      case Operation::info: std::cout << "ok"; break;
      case Operation::set:
        location = vp8_daily::parse_weather_location(request.settings);
        if (!location) return 3;
        std::cout << "saved";
        break;
      case Operation::clear: location.reset(); std::cout << "cleared"; break;
      default: return 4;
    }
    if (location) std::cout << " configured=1 lat_e4=" << location->latitude_e4 << " lon_e4=" << location->longitude_e4;
    else std::cout << " configured=0";
    std::cout << '\n';
  }
}

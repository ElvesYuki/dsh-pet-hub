#pragma once

#include <cstdint>
#include <string_view>
#include <strings.h>

namespace pet400_persist {

inline bool http_asset_headers(std::string_view headers, uint32_t expected) {
  const auto take_line = [&]() {
    const auto end = headers.find("\r\n");
    if (end == headers.npos) return std::string_view{};
    const auto line = headers.substr(0, end);
    headers.remove_prefix(end + 2);
    return line;
  };
  const auto status = take_line();
  if (status.size() < 13 ||
      (status.substr(0, 13) != "HTTP/1.1 200 " && status.substr(0, 13) != "HTTP/1.0 200 ")) return false;
  bool length_seen = false, encoding_seen = false;
  while (headers != "\r\n") {
    const auto line = take_line();
    const auto colon = line.find(':');
    if (!colon || colon == line.npos) return false;
    const auto name = line.substr(0, colon);
    for (const char c : name)
      if (!((c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c == '-'))
        return false;
    auto value = line.substr(colon + 1);
    while (!value.empty() && (value.front() == ' ' || value.front() == '\t')) value.remove_prefix(1);
    while (!value.empty() && (value.back() == ' ' || value.back() == '\t')) value.remove_suffix(1);
    for (const unsigned char c : value) if (c < 32 || c == 127) return false;
    const auto matches = [&](std::string_view field) {
      return name.size() == field.size() && !strncasecmp(name.data(), field.data(), field.size());
    };
    if (matches("Transfer-Encoding")) return false;
    if (matches("Content-Encoding")) {
      if (encoding_seen || value.size() != 8 || strncasecmp(value.data(), "identity", 8)) return false;
      encoding_seen = true;
    }
    if (matches("Content-Length")) {
      if (length_seen || value.empty() || value.size() > 10) return false;
      uint64_t length = 0;
      for (const char digit : value) {
        if (digit < '0' || digit > '9') return false;
        length = length * 10 + unsigned(digit - '0');
      }
      if (length != expected) return false;
      length_seen = true;
    }
  }
  return length_seen;
}

} // namespace pet400_persist

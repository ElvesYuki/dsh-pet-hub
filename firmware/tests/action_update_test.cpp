#include "action_update.h"
#include "persistence/http_asset_headers.h"

#include <cassert>
#include <fstream>
#include <iterator>
#include <string>
#include <vector>

using namespace vp8_cache;

struct Nor {
  std::vector<uint8_t> data;
  size_t base;
  bool tear = false;

  bool read(uint32_t offset, std::span<uint8_t> out) {
    assert(offset <= update_size && out.size() <= update_size - offset);
    std::copy_n(data.data() + base + offset, out.size(), out.data());
    return true;
  }
  bool erase(uint32_t offset, uint32_t bytes) {
    assert(offset % sector == 0 && bytes % sector == 0 && offset <= update_size && bytes <= update_size - offset);
    std::fill_n(data.data() + base + offset, bytes, 0xff);
    return true;
  }
  bool write(uint32_t offset, std::span<const uint8_t> in) {
    assert(offset <= update_size && in.size() <= update_size - offset);
    const bool broken = tear && offset == 64;
    for (size_t i = 0; i < (broken ? in.size() / 2 : in.size()); ++i) {
      auto &target = data[base + offset + i];
      assert((target & in[i]) == in[i]);
      target = in[i];
    }
    return !broken;
  }
};

std::vector<uint8_t> read_file(const char *path) {
  std::ifstream input(path, std::ios::binary);
  assert(input);
  return {std::istreambuf_iterator<char>(input), std::istreambuf_iterator<char>()};
}

int main(int argc, char **argv) {
  assert(argc == 3);
  const auto original = read_file(argv[1]), update = read_file(argv[2]);
  const Asset old{1, uint32_t(original.size()), 241, sha256(original)};
  const Asset replacement{1, uint32_t(update.size()), 241, sha256(update)};
  assert(old.sha != replacement.sha);
  Nor flash{std::vector<uint8_t>(2 * update_size, 0xff), 0};
  std::array<uint8_t, sector> work{};
  std::vector<uint8_t> recovered(update_capacity);
  const auto running = [] { return false; };
  const auto send = [&](const Asset &asset, std::span<const uint8_t> bytes) {
    size_t at = 0;
    return stage(flash, 0, asset, work, [&](std::span<uint8_t> out) {
      if (at + out.size() > bytes.size()) return false;
      std::copy_n(bytes.data() + at, out.size(), out.data());
      at += out.size();
      return true;
    });
  };
  const auto seal = [&](const Asset &asset, auto stop) {
    return seal_update(flash, asset, std::span(recovered).first(asset.bytes), stop);
  };
  assert(send(old, original) && seal(old, running) && load_update(flash, old, recovered));
  const auto before = flash.data;
  flash.base = update_size;
  const auto fallback = [&] {
    assert(!load_update(flash, replacement, recovered));
    flash.base = 0;
    assert(load_update(flash, old, recovered));
    assert(std::equal(original.begin(), original.end(), recovered.begin()));
    assert(std::equal(before.begin(), before.begin() + update_size, flash.data.begin()));
    flash.base = update_size;
  };
  fallback();
  assert(!send(replacement, std::span(update).first(update.size() - 1)));
  fallback();
  auto corrupt = update;
  corrupt.back() ^= 1;
  assert(send(replacement, corrupt) && !seal(replacement, running));
  fallback();
  assert(send(replacement, update));
  unsigned checks = 0;
  const unsigned read_count = (replacement.bytes + sector - 1) / sector;
  assert(!seal(replacement, [&] { return ++checks == read_count + 1; }));
  fallback();
  flash.tear = true;
  assert(send(replacement, update) && !seal(replacement, running));
  fallback();
  flash.tear = false;
  assert(send(replacement, update) && seal(replacement, running));
  Nor restarted = flash;
  assert(load_update(restarted, replacement, recovered));
  assert(std::equal(update.begin(), update.end(), recovered.begin()));
  restarted.data[update_size + sector + 100] ^= 1;
  assert(!load_update(restarted, replacement, recovered));
  assert(std::equal(before.begin(), before.begin() + update_size, flash.data.begin()));

  using pet400_persist::http_asset_headers;
  const auto length = std::to_string(update.size());
  assert(http_asset_headers("HTTP/1.1 200 OK\r\nContent-Length: " + length + "\r\n\r\n", replacement.bytes));
  assert(!http_asset_headers("HTTP/1.1 200 OK\r\nContent-Length: 1\r\n\r\n", replacement.bytes));
  assert(!http_asset_headers("HTTP/1.1 200 OK\r\nContent-Length: " + length +
                            "\r\nTransfer-Encoding: chunked\r\n\r\n", replacement.bytes));
  UpdateLines lines;
  std::vector<std::string> commands;
  const auto push = [&](std::string_view bytes) {
    for (const uint8_t c : bytes) lines.push(c, [&](std::string_view command) {
      assert(command.data()[command.size()] == 0);
      commands.emplace_back(command);
    });
  };
  push("WAV");
  push("E\nCANCEL1\n\rSTATUS1\n");
  push(std::string(256, 'z') + "STATUS1\nSHOW1\n");
  assert((commands == std::vector<std::string>{"WAVE", "CANCEL1", "SHOW1"}));
}

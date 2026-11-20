#include "cache_store.h"

#include <cassert>
#include <fstream>
#include <iterator>
#include <vector>

using namespace vp8_cache;

struct Nor {
  std::vector<uint8_t> bytes = std::vector<uint8_t>(region_size, 0xff);
  bool tear_commit = false;
  bool erase(uint32_t at, uint32_t count) {
    assert(at % sector == 0 && count % sector == 0 && at <= bytes.size() && count <= bytes.size() - at);
    std::fill_n(bytes.data() + at, count, 0xff);
    return true;
  }
  bool read(uint32_t at, std::span<uint8_t> out) {
    assert(at <= bytes.size() && out.size() <= bytes.size() - at);
    std::copy_n(bytes.data() + at, out.size(), out.data());
    return true;
  }
  bool write(uint32_t at, std::span<const uint8_t> from) {
    assert(at <= bytes.size() && from.size() <= bytes.size() - at);
    const bool tear = tear_commit && at % sector == 64 && from.size() == committed.size();
    const size_t count = tear ? from.size() / 2 : from.size();
    for (size_t i = 0; i < count; ++i) {
      assert((bytes[at + i] & from[i]) == from[i]);
      bytes[at + i] = from[i];
    }
    return !tear;
  }
};

std::vector<uint8_t> read_file(const char *name) {
  std::ifstream fd(name, std::ios::binary);
  assert(fd);
  return {std::istreambuf_iterator<char>(fd), std::istreambuf_iterator<char>()};
}

int main(int argc, char **argv) {
  assert(argc == 3);
  const auto a = read_file(argv[1]), b = read_file(argv[2]);
  assert(validate_ivf(a, 241) && validate_ivf(b, 241));
  assert(!validate_ivf(std::span(a).first(a.size() - 1), 241) && !validate_ivf(a, 240));
  auto broken = a;
  broken[44 + 6] ^= 1; // First keyframe width must match the canvas.
  assert(!validate_ivf(broken, 241));
  broken = a;
  broken[32 + 4] = 1; // The first PTS is 0.
  assert(!validate_ivf(broken, 241));
  const Asset idle{0, uint32_t(a.size()), 241, sha256(a)}, action{67, uint32_t(b.size()), 241, sha256(b)};
  const auto second = footprint(idle.bytes);
  assert(second == 454656 && footprint(action.bytes) == 446464);
  assert(fits(second, action) && !fits(region_size, action) && !fits(second + 1, action));

  Nor flash;
  std::array<uint8_t, sector> work{};
  const auto send = [&](uint32_t off, const Asset &asset, std::span<const uint8_t> from, size_t limit) {
    size_t at = 0;
    return stage(flash, off, asset, work, [&](std::span<uint8_t> out) {
      if (at + out.size() > limit) return false;
      std::copy_n(from.data() + at, out.size(), out.data());
      at += out.size();
      return true;
    });
  };
  const auto data = [&](uint32_t off, uint32_t size) { return std::span(flash.bytes).subspan(off + sector, size); };
  const auto accepts = [] { return true; };
  assert(!send(0, idle, a, a.size() - 1));
  assert(!mount(flash, 0, idle, data(0, idle.bytes)));
  assert(send(0, idle, a, a.size()));
  assert(!mount(flash, 0, idle, data(0, idle.bytes)));
  assert(!commit(flash, 0, idle, data(0, idle.bytes), [] { return false; }));
  assert(commit(flash, 0, idle, data(0, idle.bytes), accepts));
  assert(mount(flash, 0, idle, data(0, idle.bytes)));
  assert(send(second, action, b, b.size()));
  flash.tear_commit = true;
  assert(!commit(flash, second, action, data(second, action.bytes), accepts));
  assert(!mount(flash, second, action, data(second, action.bytes)));
  assert(mount(flash, 0, idle, data(0, idle.bytes)));
  flash.tear_commit = false;
  assert(send(second, action, b, b.size()));
  assert(commit(flash, second, action, data(second, action.bytes), accepts));
  const Nor recovered = flash;
  flash = recovered;
  assert(mount(flash, second, action, data(second, action.bytes)));
  data(second, action.bytes)[350] ^= 1;
  assert(!mount(flash, second, action, data(second, action.bytes)));
  assert(!commit(flash, second, action, data(second, action.bytes), accepts));
  assert(mount(flash, 0, idle, data(0, idle.bytes)));
}

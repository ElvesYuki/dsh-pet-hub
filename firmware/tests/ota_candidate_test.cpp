#include "cache_firmware.h"
#include "ota_cache.h"
#include "ota_transfer.h"
#include "ota_idle_policy.h"

#include <cassert>
#include <cstdio>
#include <fstream>
#include <iterator>
#include <vector>

using namespace vp8_ota;

struct Nor {
  std::vector<uint8_t> data;
  bool tear{};
  bool read(uint32_t offset, std::span<uint8_t> result) {
    assert(offset <= data.size() && result.size() <= data.size() - offset);
    std::copy_n(data.data() + offset, result.size(), result.data());
    return true;
  }
  bool write(uint32_t offset, Clip bytes) {
    assert(offset <= data.size() && bytes.size() <= data.size() - offset);
    const bool broken = tear && offset < object_begin &&
      offset % root_bytes == root_bytes - root_marker.size();
    const size_t length = broken ? bytes.size() / 2 : bytes.size();
    for (size_t i = 0; i < length; ++i) {
      assert((data[offset + i] & bytes[i]) == bytes[i]);
      data[offset + i] &= bytes[i];
    }
    return !broken;
  }
  bool erase(uint32_t offset, uint32_t bytes) {
    assert(offset % sector == 0 && bytes % sector == 0 && offset + bytes <= data.size());
    std::fill_n(data.data() + offset, bytes, 0xff);
    return true;
  }
};

struct Ref {
  Nor *nor;
  bool read(uint32_t at, std::span<uint8_t> bytes) { return nor->read(at, bytes); }
  bool write(uint32_t at, Clip bytes) { return nor->write(at, bytes); }
  bool erase(uint32_t at, uint32_t size) { return nor->erase(at, size); }
};

std::vector<uint8_t> file(const char *path) {
  std::ifstream src(path, std::ios::binary);
  assert(src);
  return {std::istreambuf_iterator<char>(src), std::istreambuf_iterator<char>()};
}

struct Slot {
  bool valid_signature = true;
  bool begun{}, verified{}, selected{};
  size_t written{};
  bool begin(uint32_t size) { begun = size <= app_bytes; return begun; }
  bool write(Clip bytes) { written += bytes.size(); return begun; }
  bool verify() { return verified = valid_signature; }
  bool select() { assert(verified); return selected = true; }
};

int main(int argc, char **argv) {
  assert(argc == 6);
  Nor flash{file(argv[1])};
  assert(flash.data.size() == media_bytes);
  const auto extra = file(argv[2]), future = file(argv[3]), firmware = file(argv[4]);
  assert(validate_ivf(extra, 118));
  assert(firmware.size() % sector == 0 && firmware.size() < app_bytes);
  std::array<uint8_t, sector> work{};
  std::vector<uint8_t> readback(object_capacity);
  Cache<Ref> store({&flash});
  assert(store.mount() == 2);
  for (const unsigned id : {0, 4, 1, 11}) {
    const auto *o = store.find({0, id});
    assert(o && store.load(*o, readback));
    assert(store.find({0, id}, true) && *store.find({0, id}, true) == *o);
  }
  unsigned seeded = 0;
  for (unsigned id = 0; id < 78; ++id) {
    const auto *o = store.find({0, id});
    if (!o) continue;
    assert(store.find({0, id}, true) && *store.find({0, id}, true) == *o);
    assert(store.load(*o, readback));
    ++seeded;
  }
  assert(seeded == std::stoul(argv[5]));
  IdlePolicy policy;
  using namespace vp8_daily;
  assert(policy.next(idle, false) == idle);
  assert(policy.next(idle, false) == idle);
  assert(policy.next(idle, false) == IdlePolicy::choose_idle);
  assert(policy.next(4, true) == wave && policy.next(wave, false) == idle);
  const auto available = [&](uint16_t action) { return store.find({0, action}); };
  if (seeded == 56) {
    for (const auto action : swipe_actions) assert(available(action));
    for (const auto action : automatic_idle_actions) assert(available(action));
    std::optional<uint16_t> previous;
    for (unsigned i = 0; i < 100; ++i) {
      const auto action = policy.pick(i, available);
      assert(action && action != previous && available(*action));
      assert(std::find(automatic_idle_actions.begin(), automatic_idle_actions.end(), *action) !=
             automatic_idle_actions.end());
      previous = action;
    }
  } else {
    assert(!policy.pick(0, available));
  }
  assert(policy.pick(0, [](uint16_t id) { return id == 6; }) == 6);
  assert(policy.pick(0, [](uint16_t id) { return id == 6; }) == 6);
  assert(!policy.pick(0, [](uint16_t id) { return id == 25 || id == 36 || id == 74; }));
  assert(!policy.pick(0, [](uint16_t) { return false; }));
  const auto old = *store.find({0, 1});
  const auto no_cancel = [] { return false; };
  const auto install = [&](Cache<Ref> &cache, Object object, Clip data, auto stop, Key playing = {0, 11}) {
    size_t at = 0;
    return cache.install(object, playing, work, readback, [&](std::span<uint8_t> bytes) {
      if (at + bytes.size() > data.size()) return false;
      std::copy_n(data.data() + at, bytes.size(), bytes.data());
      at += bytes.size();
      return true;
    }, stop);
  };
  const Object changed{{0, 1}, old.version + 1, 0, uint32_t(future.size()), 241, sha256(future)};
  assert(install(store, old, {}, no_cancel) == Result::Existing);
  assert(install(store, changed, std::span(future).first(sector), no_cancel) == Result::Failed);
  assert(store.find(old.key) && *store.find(old.key) == old);
  auto damaged = future;
  damaged.back() ^= 1;
  assert(install(store, changed, damaged, no_cancel) == Result::Failed);
  unsigned polls = 0;
  assert(install(store, changed, future, [&] { return ++polls >= 4; }) == Result::Cancelled);
  flash.tear = true;
  assert(install(store, changed, future, no_cancel) == Result::Failed);
  Cache<Ref> restarted({&flash});
  assert(restarted.mount() == 1 && *restarted.find(old.key) == old && restarted.load(old, readback));
  flash.tear = false;
  assert(install(restarted, changed, future, no_cancel) == Result::Saved);
  assert(restarted.mount() == 2 && restarted.find(old.key)->version == changed.version);
  assert(*restarted.find(old.key, true) == old);
  assert(install(restarted, old, {}, no_cancel) == Result::Invalid);
  const Object alternate{{7, 42}, 1, 0, uint32_t(extra.size()), 118, sha256(extra)};
  assert(install(restarted, alternate, extra, no_cancel) == Result::Saved);
  assert(restarted.find({7, 42}) && restarted.load(*restarted.find({7, 42}), readback));
  assert(restarted.find({7, 42})->frames == 118);

  // Fill the actual layout far enough to retire a non-pinned object, then cancel an update.
  for (unsigned i = 0; i < 70; ++i) {
    Object o = changed;
    o.key = {10, i};
    const auto result = install(restarted, o, future, no_cancel);
    if (result != Result::Saved) std::fprintf(stderr, "cache fill failed at %u with result %d\n", i, int(result));
    assert(result == Result::Saved);
  }
  unsigned retained = 0;
  for (unsigned i = 0; i < 70; ++i) retained += restarted.find({10, i}) != nullptr;
  assert(retained < 70 && restarted.find({10, 69}));
  assert(restarted.find({0, 0}) && restarted.find({0, 4}) && restarted.find({0, 11}));
  assert(restarted.mount() == 2);
  const Object interrupted{{10, 70}, 1, 0, uint32_t(future.size()), 241, sha256(future)};
  polls = 0;
  assert(install(restarted, interrupted, future, [&] { return ++polls >= 4; }) == Result::Cancelled);
  assert(!restarted.find(interrupted.key) && restarted.find({10, 69}) && restarted.find({0, 11}));

  const auto hash = sha256(firmware);
  const auto attempt = [&](Slot &slot, Clip data, Digest expected, auto stop, unsigned size) {
    size_t at = 0;
    return transfer(slot, size, expected, work, [&](std::span<uint8_t> bytes) {
      if (at + bytes.size() > data.size()) return false;
      std::copy_n(data.data() + at, bytes.size(), bytes.data());
      at += bytes.size();
      return true;
    }, stop);
  };
  Slot truncated;
  assert(attempt(truncated, std::span(firmware).first(sector), hash, no_cancel, firmware.size()) == Transfer::Failed);
  assert(!truncated.selected && !truncated.verified);
  Slot wrong_hash;
  assert(attempt(wrong_hash, firmware, Digest{1}, no_cancel, firmware.size()) == Transfer::Invalid);
  assert(!wrong_hash.selected && !wrong_hash.verified);
  Slot bad_signature{false};
  assert(attempt(bad_signature, firmware, hash, no_cancel, firmware.size()) == Transfer::Invalid);
  assert(!bad_signature.selected);
  Slot cancelled;
  assert(attempt(cancelled, firmware, hash, [&] { return cancelled.verified; }, firmware.size()) == Transfer::Cancelled);
  assert(!cancelled.selected);
  Slot over;
  assert(attempt(over, firmware, hash, no_cancel, app_bytes + sector) == Transfer::Invalid);
  assert(!over.begun);
  Slot accepted;
  assert(attempt(accepted, firmware, hash, no_cancel, firmware.size()) == Transfer::Selected);
  assert(accepted.written == firmware.size() && accepted.selected);
}

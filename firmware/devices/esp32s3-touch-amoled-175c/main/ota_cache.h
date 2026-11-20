#pragma once

#include "cache_store.h"

namespace vp8_ota {
using namespace vp8_cache;
constexpr uint32_t media_address = 0x600000, media_bytes = 0x1a00000;
constexpr uint32_t root_bytes = 64 * 1024, object_begin = 2 * root_bytes;
constexpr uint32_t reserve_bytes = 512 * 1024, object_capacity = reserve_bytes - sector;
constexpr uint32_t active_budget = media_bytes - object_begin - reserve_bytes;
constexpr unsigned max_frames = 1450, max_objects = 128;
constexpr size_t header_bytes = 32, record_bytes = 56;
constexpr std::array<uint8_t, 16> root_marker{'P','V','8','R','O','O','T','1',0x35,0x62,0x91,0x83,0xf0,0xa6,0x54,0x19};

struct Key {
  uint32_t role{}, action{};
  bool operator==(const Key &) const = default;
};

struct Object {
  Key key{};
  uint32_t version{}, offset{}, bytes{}, frames{};
  Digest digest{};
  Asset asset() const { return {key.action, bytes, frames, digest}; }
  uint32_t footprint() const { return sector + ((bytes + sector - 1) / sector) * sector; }
  bool operator==(const Object &) const = default;
};

inline bool valid(const Object &o) {
  return o.key.role < 65535 && o.key.action < 65535 && o.version &&
         o.bytes > 32 && o.bytes <= object_capacity && o.frames >= 2 && o.frames <= max_frames &&
         o.digest != Digest{};
}

struct Root {
  uint32_t generation{};
  unsigned count{};
  std::array<Object, max_objects> objects{};
  const Object *find(Key key) const {
    for (unsigned i = 0; i < count; ++i) if (objects[i].key == key) return &objects[i];
    return nullptr;
  }
  bool valid_layout() const {
    if (!generation || count > max_objects) return false;
    uint32_t total = 0;
    for (unsigned i = 0; i < count; ++i) {
      const auto &o = objects[i];
      if (!valid(o) || o.offset < object_begin || o.offset % sector || o.offset > media_bytes - o.footprint())
        return false;
      total += o.footprint();
      for (unsigned j = 0; j < i; ++j) {
        const auto &p = objects[j];
        if (o.key == p.key || (o.offset < p.offset + p.footprint() && p.offset < o.offset + o.footprint()))
          return false;
      }
    }
    return total <= active_budget;
  }
};

using RootBytes = std::array<uint8_t, header_bytes + max_objects * record_bytes + Digest{}.size()>;
inline bool encode_root(const Root &root, RootBytes &out) {
  if (!root.valid_layout()) return false;
  out.fill(0);
  std::memcpy(out.data(), "RPVP8RT1", 8);
  store32(out.data() + 8, root.generation);
  store32(out.data() + 12, root.count);
  for (unsigned i = 0; i < root.count; ++i) {
    const auto &o = root.objects[i];
    auto *p = out.data() + header_bytes + i * record_bytes;
    const std::array fields{o.key.role, o.key.action, o.version, o.offset, o.bytes, o.frames};
    for (unsigned j = 0; j < fields.size(); ++j) store32(p + 4 * j, fields[j]);
    std::copy(o.digest.begin(), o.digest.end(), p + 24);
  }
  const auto digest = sha256(std::span(out).first(out.size() - Digest{}.size()));
  std::copy(digest.begin(), digest.end(), out.end() - digest.size());
  return true;
}

inline bool decode_root(const RootBytes &in, Root &root) {
  root.generation = root.count = 0;
  const auto digest = sha256(std::span(in).first(in.size() - Digest{}.size()));
  if (std::memcmp(in.data(), "RPVP8RT1", 8) || !std::equal(digest.begin(), digest.end(), in.end() - digest.size()))
    return false;
  const auto count = load32(in.data() + 12);
  if (count > max_objects) return false;
  root.generation = load32(in.data() + 8);
  root.count = count;
  for (unsigned i = 0; i < count; ++i) {
    const auto *p = in.data() + header_bytes + i * record_bytes;
    auto &o = root.objects[i];
    o = {{load32(p), load32(p + 4)}, load32(p + 8), load32(p + 12),
         load32(p + 16), load32(p + 20), {}};
    std::copy_n(p + 24, o.digest.size(), o.digest.begin());
  }
  if (root.valid_layout()) return true;
  root.generation = root.count = 0;
  return false;
}

enum class Result { Saved, Existing, Invalid, Full, Cancelled, Failed };

template<class Flash>
class Cache {
  Flash flash_;
  std::array<Root, 2> roots_{};
  Root pending_{};
  RootBytes wire_{};
  unsigned active_{};
  bool mounted_{}, write_failed_{};

  bool read_root(unsigned index) {
    const uint32_t start = root_bytes * index;
    std::array<uint8_t, root_marker.size()> marker{};
    roots_[index].count = roots_[index].generation = 0;
    return flash_.read(start + root_bytes - marker.size(), marker) && marker == root_marker &&
           flash_.read(start, wire_) && decode_root(wire_, roots_[index]);
  }

  bool commit() {
    if (write_failed_ || roots_[active_].generation == UINT32_MAX) return false;
    pending_.generation = roots_[active_].generation + 1;
    if (!encode_root(pending_, wire_)) return false;
    const unsigned destination = active_ ^ 1;
    const uint32_t start = root_bytes * destination;
    write_failed_ = true;
    if (!flash_.erase(start, root_bytes) || !flash_.write(start, wire_) ||
        !flash_.write(start + root_bytes - root_marker.size(), root_marker) || !read_root(destination))
      return false;
    if (roots_[destination].generation != pending_.generation || roots_[destination].count != pending_.count ||
        !std::equal(pending_.objects.begin(), pending_.objects.begin() + pending_.count, roots_[destination].objects.begin()))
      return false;
    active_ = destination;
    write_failed_ = false;
    return true;
  }

  uint32_t free_offset(uint32_t footprint) const {
    uint32_t offset = object_begin;
    while (offset <= media_bytes - footprint) {
      uint32_t after = offset;
      for (const auto &root : roots_)
        for (unsigned i = 0; i < root.count; ++i) {
          const auto &o = root.objects[i];
          if (o.offset < offset + footprint && offset < o.offset + o.footprint())
            after = std::max(after, o.offset + o.footprint());
        }
      if (after == offset) return offset;
      offset = after;
    }
    return 0;
  }

  static bool protected_key(Key key, Key playing) {
    return key == playing || key == Key{0, 0} || key == Key{0, 4};
  }

  bool leave_staging_gap(Key installed, Key playing) {
    // The next update must have one contiguous extent even if the active byte budget has holes.
    uint32_t start = 0, best = UINT32_MAX;
    for (unsigned i = 0; i <= pending_.count; ++i) {
      const uint32_t at = i == 0 ? object_begin : pending_.objects[i - 1].offset + pending_.objects[i - 1].footprint();
      if (at > media_bytes - reserve_bytes) continue;
      uint32_t cost = 0;
      for (unsigned j = 0; j < pending_.count; ++j) {
        const auto &o = pending_.objects[j];
        if (o.offset >= at + reserve_bytes || at >= o.offset + o.footprint()) continue;
        if (o.key == installed || protected_key(o.key, playing)) { cost = UINT32_MAX; break; }
        cost += o.footprint();
      }
      if (cost < best) { start = at; best = cost; }
      if (!best) return true;
    }
    if (!start) return false;
    unsigned keep = 0;
    for (unsigned i = 0; i < pending_.count; ++i) {
      const auto &o = pending_.objects[i];
      if (o.offset >= start + reserve_bytes || start >= o.offset + o.footprint())
        pending_.objects[keep++] = o;
    }
    pending_.count = keep;
    return true;
  }

  bool plan(Object object, Key playing) {
    pending_ = roots_[active_];
    uint32_t used = 0;
    unsigned keep = 0;
    for (unsigned i = 0; i < pending_.count; ++i) {
      const auto &o = pending_.objects[i];
      if (o.key == object.key) continue;
      used += o.footprint();
      pending_.objects[keep++] = o;
    }
    pending_.count = keep;
    while (pending_.count == max_objects || used + object.footprint() > active_budget) {
      unsigned victim = 0;
      for (; victim < pending_.count; ++victim) {
        if (!protected_key(pending_.objects[victim].key, playing)) break;
      }
      if (victim == pending_.count) return false;
      used -= pending_.objects[victim].footprint();
      std::move(pending_.objects.begin() + victim + 1, pending_.objects.begin() + pending_.count,
                pending_.objects.begin() + victim);
      --pending_.count;
    }
    pending_.objects[pending_.count++] = object;
    return leave_staging_gap(object.key, playing);
  }

public:
  explicit Cache(Flash flash) : flash_(flash) {}
  unsigned mount() {
    const bool first = read_root(0), second = read_root(1);
    mounted_ = first || second;
    write_failed_ = false;
    active_ = second && (!first || roots_[1].generation > roots_[0].generation) ? 1 : 0;
    if (first && second && roots_[0].generation == roots_[1].generation &&
        (roots_[0].count != roots_[1].count ||
         !std::equal(roots_[0].objects.begin(), roots_[0].objects.begin() + roots_[0].count,
                     roots_[1].objects.begin()))) mounted_ = false;
    return mounted_ ? unsigned(first) + unsigned(second) : 0;
  }
  const Object *find(Key key, bool previous = false) const {
    return mounted_ ? roots_[active_ ^ unsigned(previous)].find(key) : nullptr;
  }
  bool load(const Object &object, std::span<uint8_t> buffer) {
    if (!valid(object) || object.offset < object_begin || object.offset % sector ||
        object.offset > media_bytes - object.footprint() || buffer.size() < object.bytes) return false;
    auto data = buffer.first(object.bytes);
    decltype(identity(object.asset())) header{};
    return flash_.read(object.offset, header) && header == identity(object.asset()) &&
           flash_.read(object.offset + sector, data) && sha256(data) == object.digest &&
           validate_ivf(data, object.frames);
  }
  template<class Receive, class Stop>
  Result install(Object object, Key playing, std::span<uint8_t> work, std::span<uint8_t> readback,
                 Receive receive, Stop stop) {
    if (!mounted_ || !valid(object) || work.size() < sector || readback.size() < object.bytes)
      return Result::Invalid;
    if (write_failed_) return Result::Failed;
    if (const auto *old = find(object.key)) {
      if (object.version == old->version && object.bytes == old->bytes && object.frames == old->frames &&
          object.digest == old->digest) return load(*old, readback) ? Result::Existing : Result::Failed;
      if (object.version <= old->version) return Result::Invalid;
    }
    if (stop()) return Result::Cancelled;
    object.offset = free_offset(object.footprint());
    if (!object.offset) {
      // The previous directory can pin retired objects. First mirror the current directory.
      pending_ = roots_[active_];
      if (!commit()) return Result::Failed;
      object.offset = free_offset(object.footprint());
    }
    if (!object.offset || !plan(object, playing)) return Result::Full;
    if (!flash_.erase(object.offset, object.footprint())) return Result::Failed;
    for (uint32_t at = 0; at < object.bytes;) {
      auto chunk = work.first(std::min(sector, object.bytes - at));
      if (stop()) return Result::Cancelled;
      if (!receive(chunk) || !flash_.write(object.offset + sector + at, chunk))
        return stop() ? Result::Cancelled : Result::Failed;
      at += chunk.size();
    }
    if (!flash_.write(object.offset, identity(object.asset())) || !load(object, readback)) return Result::Failed;
    if (stop()) return Result::Cancelled;
    return commit() ? Result::Saved : Result::Failed;
  }
};
} // namespace vp8_ota

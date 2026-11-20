#pragma once

#include "cache_store.h"

namespace vp8_ota {
constexpr uint32_t app_bytes = 2 * 1024 * 1024;
enum class Transfer { Selected, Invalid, Cancelled, Failed };

// Slot operations deliberately separate signature verification from selecting the next boot.
template<class Slot, class Receive, class Stop>
Transfer transfer(Slot &slot, uint32_t size, const vp8_cache::Digest &digest, std::span<uint8_t> buffer,
                  Receive receive, Stop stop) {
  if (!size || size > app_bytes || size % vp8_cache::sector || digest == vp8_cache::Digest{} || buffer.empty())
    return Transfer::Invalid;
  if (stop()) return Transfer::Cancelled;
  if (!slot.begin(size)) return Transfer::Failed;
  pet::Sha256 hash;
  for (uint32_t at = 0; at < size;) {
    auto chunk = buffer.first(std::min<size_t>(buffer.size(), size - at));
    if (stop() || !receive(chunk) || !slot.write(chunk)) return stop() ? Transfer::Cancelled : Transfer::Failed;
    hash.update(chunk.data(), chunk.size());
    at += chunk.size();
  }
  vp8_cache::Digest actual;
  hash.finish(actual.data());
  if (actual != digest || !slot.verify()) return Transfer::Invalid;
  if (stop()) return Transfer::Cancelled;
  return slot.select() ? Transfer::Selected : Transfer::Failed;
}
} // namespace vp8_ota

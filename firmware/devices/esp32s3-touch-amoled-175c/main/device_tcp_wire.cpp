#include "device_tcp_wire.h"

namespace vp8_lan {
size_t encode_status(const vp8_status::Status &s, uint32_t session, uint32_t sequence,
                     std::span<uint8_t, max_status_size> out) {
  if (!session || !sequence) return 0;
  const auto size = vp8_status::encode(s, out.last<vp8_status::max_size>());
  if (!size) return 0;
  put32(out.data(), session);
  put32(out.data() + 4, sequence);
  return status_context_size + size;
}

std::optional<Receipt> decode_status(Bytes data) {
  if (data.size() < min_status_size || data.size() > max_status_size) return {};
  const auto session = u32(data.data());
  const auto sequence = u32(data.data() + 4);
  if (!session || !sequence) return {};
  const auto snapshot = vp8_status::decode(data.subspan(status_context_size));
  if (!snapshot) return {};
  return Receipt{*snapshot, session, sequence};
}
} // namespace vp8_lan

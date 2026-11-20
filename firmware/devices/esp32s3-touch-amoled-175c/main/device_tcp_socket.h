#pragma once

#include "device_tcp_session.h"
#include <cerrno>
#ifdef ESP_PLATFORM
#include "lwip/sockets.h"
#else
#include <sys/socket.h>
#endif

namespace vp8_lan {
// The fd belongs to the caller. All operations are nonblocking on an already connected fd.
class Socket {
 public:
  bool step(int fd, Session &session, uint64_t now) {
    if (!session.tick(now)) return false;
    if (!out_.size) {
      if (session.next(out_, now)) buffered_at_ = now;
      else if (!session.tick(now)) return false;
    }
    if (out_.size) {
      if (now - buffered_at_ >= 3000) return false;
      const auto sent = ::send(fd, out_.data.data() + written_, out_.size - written_, 0);
      if (sent < 0 && !would_wait()) return false;
      if (sent > 0) {
        written_ += size_t(sent);
        if (written_ == out_.size) reset();
      }
    }
    std::array<uint8_t, 256> input{};
    const auto received = ::recv(fd, input.data(), input.size(), 0);
    if (received < 0) return would_wait();
    return received > 0 && session.receive(Bytes(input).first(size_t(received)), now);
  }

  void reset() { out_.size = written_ = 0; }

 private:
  static bool would_wait() { return errno == EAGAIN || errno == EWOULDBLOCK || errno == EINTR; }
  Packet out_;
  size_t written_{};
  uint64_t buffered_at_{};
};
} // namespace vp8_lan

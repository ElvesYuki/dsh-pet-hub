#include "playback_control_policy.h"

#include <arpa/inet.h>
#include <chrono>
#include <cerrno>
#include <cstdlib>
#include <sys/socket.h>
#include <unistd.h>

using namespace vp8_control;

namespace {
using Clock = std::chrono::steady_clock;
uint64_t milliseconds(Clock::time_point start) {
  return std::chrono::duration_cast<std::chrono::milliseconds>(Clock::now() - start).count();
}

bool send_replies(int socket, Control &control, bool &local_busy) {
  while (const auto message = control.pop()) {
    if (message->kind == Kind::pong) local_busy = false;
    Frame frame{};
    if (!encode(*message, frame)) return false;
    std::span<const uint8_t> remaining{frame};
    while (!remaining.empty()) {
      const auto size = ::send(socket, remaining.data(), remaining.size(), 0);
      if (size < 0 && errno == EINTR) continue;
      if (size <= 0) return false;
      remaining = remaining.subspan(size_t(size));
    }
  }
  return true;
}

bool device_fixture(int socket) {
  // The peer runs on loopback, and verification and first DMA are fixture inputs.
  Playback playback(76);
  auto &control = playback.control();
  const auto start = Clock::now();
  if (!control.begin_verified(1, 0)) return false;
  bool local_busy = true;
  std::array<uint8_t, 11> incoming{};
  for (;;) {
    const auto size = ::recv(socket, incoming.data(), incoming.size(), 0);
    if (size == 0) {
      control.close();
      return !control.pop() && !control.claim(milliseconds(start), false);
    }
    if (size < 0 && errno == EINTR) continue;
    if (size < 0 || !control.receive(std::span{incoming}.first(size_t(size)), milliseconds(start)) ||
        !send_replies(socket, control, local_busy)) return false;
    if (const auto ticket = playback.claim(milliseconds(start), local_busy)) {
      const bool known = ticket->role == 0 && (ticket->action == 4 || ticket->action == 57);
      if (!playback.can_submit(*ticket, milliseconds(start))) return false;
      if (known && !playback.first_dma(*ticket, milliseconds(start))) return false;
      playback.finish(milliseconds(start), !known);
      if (!send_replies(socket, control, local_busy)) return false;
    }
  }
}
} // namespace

int main(int argc, char **argv) {
  if (argc != 2) return 2;
  char *end = nullptr;
  const long port = std::strtol(argv[1], &end, 10);
  if (*end || port <= 0 || port > 65535) return 2;
  const int socket = ::socket(AF_INET, SOCK_STREAM, 0);
  if (socket < 0) return 2;
  sockaddr_in address{};
  address.sin_family = AF_INET;
  address.sin_port = htons(uint16_t(port));
  address.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
  const bool passed = !::connect(socket, reinterpret_cast<sockaddr *>(&address), sizeof(address)) &&
                      device_fixture(socket);
  ::close(socket);
  return passed ? 0 : 1;
}

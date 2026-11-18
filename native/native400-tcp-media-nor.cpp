#include "persistence/media_pull.h"
#include "persistence/media_wire.h"
#include "nor_fixture.h"

#include <arpa/inet.h>
#include <netinet/tcp.h>
#include <poll.h>
#include <sys/socket.h>
#include <unistd.h>
#include <cerrno>
#include <chrono>
#include <csignal>
#include <fstream>
#include <functional>
#include <iostream>
#include <stdexcept>
#include <string>

namespace {
namespace wire = pet400_persist::media_wire;
using namespace pet400_persist;
using Clock = std::chrono::steady_clock;
constexpr uint64_t boot = 0x20000000000007;
constexpr uint64_t transaction = 1;
constexpr size_t spare = pet400_boot::Catalog::base(4) + pet400_boot::sector;

void require(bool ok, const char *reason) {
  if (!ok) throw std::runtime_error(reason);
}

class Connection {
  int fd = -1;
  Clock::time_point deadline = Clock::now() + std::chrono::seconds(15);

  bool wait(short events, bool immediate = false) {
    for (;;) {
      const auto ms = std::chrono::duration_cast<std::chrono::milliseconds>(deadline - Clock::now()).count();
      require(ms > 0, "socket deadline");
      pollfd item{fd, events, 0};
      const int result = poll(&item, 1, immediate ? 0 : int(ms));
      if (result < 0 && errno == EINTR) continue;
      require(result >= 0 && (result > 0 || immediate), "poll failed or timed out");
      return result > 0;
    }
  }

public:
  explicit Connection(unsigned port) {
    sockaddr_in addr{};
    addr.sin_family = AF_INET;
    addr.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
    addr.sin_port = htons(uint16_t(port));
    fd = socket(AF_INET, SOCK_STREAM, 0);
    if (fd < 0 || connect(fd, reinterpret_cast<sockaddr *>(&addr), sizeof(addr))) {
      if (fd >= 0) close(fd);
      throw std::runtime_error("loopback connect failed");
    }
    const int enabled = 1;
    if (setsockopt(fd, IPPROTO_TCP, TCP_NODELAY, &enabled, sizeof(enabled))) {
      close(fd);
      throw std::runtime_error("TCP_NODELAY failed");
    }
  }
  Connection(const Connection &) = delete;
  Connection &operator=(const Connection &) = delete;
  ~Connection() { close(fd); }

  bool pending() { return wait(POLLIN, true); }

  bool read(uint8_t *out, size_t left) {
    while (left) {
      wait(POLLIN);
      const auto n = recv(fd, out, std::min(left, size_t(127)), MSG_DONTWAIT);
      if (n < 0 && (errno == EINTR || errno == EAGAIN || errno == EWOULDBLOCK)) continue;
      if (n <= 0) return false;
      out += n;
      left -= size_t(n);
    }
    return true;
  }

  template<size_t N> void send(const std::array<uint8_t, N> &packet) {
    for (size_t offset = 0; offset < N;) {
      wait(POLLOUT);
      const auto n = ::send(fd, packet.data() + offset, std::min(N - offset, size_t(11)), MSG_DONTWAIT);
      if (n < 0 && (errno == EINTR || errno == EAGAIN || errno == EWOULDBLOCK)) continue;
      require(n > 0, "socket send failed");
      offset += size_t(n);
    }
  }
};

struct Input {
  std::array<uint8_t, wire::header_bytes> header{};
  std::array<uint8_t, 124> payload{};
  wire::Frame frame{};
  wire::Data data{};
  bool disconnected = false;

  bool read(Connection &link, uint8_t *output = nullptr, size_t capacity = 0) {
    wire::Header h;
    if (!link.read(header.data(), header.size())) { disconnected = true; return false; }
    if (!wire::decode_header(header.data(), header.size(), h)) return false;
    if (h.kind == wire::Kind::Data) {
      if (h.length <= wire::data_prefix) return false;
      const size_t size = h.length - wire::data_prefix;
      std::array<uint8_t, wire::data_prefix> prefix{};
      if (!output || size > capacity) return false;
      if (!link.read(prefix.data(), prefix.size()) || !link.read(output, size)) {
        disconnected = true;
        return false;
      }
      frame = {h, nullptr};
      return wire::decode_data(header.data(), header.size(), prefix, output, size, data);
    }
    if (h.length > payload.size()) return false;
    if (!link.read(payload.data(), h.length)) { disconnected = true; return false; }
    return wire::decode(header.data(), header.size(), payload.data(), h.length, frame);
  }

  wire::Job job() const {
    wire::Job id{};
    std::copy_n(payload.data(), id.size(), id.data());
    return id;
  }
};

struct Flash : Nor {
  using Nor::Nor;
  size_t staged = 0;
  std::function<void(bool)> checkpoint;

  bool write(size_t at, const void *src, size_t size) override {
    if (!Nor::write(at, src, size)) return false;
    if (at == spare + staged) staged += size;
    if (checkpoint && at < 2 * pet400_boot::sector) {
      if (size == 252) checkpoint(false);
      if (size == 4) checkpoint(true);
    }
    return true;
  }
};

pet400_boot::Catalog recover(Flash &flash) {
  ReadContext input{flash};
  pet400_boot::Catalog catalog;
  require(catalog.recover(ReadContext::read, &input, flash.capacity()) && !input.failed, "NOR recover");
  return catalog;
}

void send_hello(Connection &link, const pet400_boot::Catalog &root) {
  link.send(wire::hello(boot, root.sequence(), root.find(1)->generation, root.find(11)->generation));
}

struct Source {
  Connection &link;
  Flash &flash;
  wire::Job job;
  size_t received = 0, acknowledgements = 0;
  unsigned closes = 0;
  bool stopped = false, invalid = false, ended = false;

  static bool cancelled(void *opaque) { return static_cast<Source *>(opaque)->stopped; }
  static void close(void *opaque) { ++static_cast<Source *>(opaque)->closes; }

  static MediaBlock receive(void *opaque, uint8_t *output, size_t capacity, const pet400::Cancellation &) {
    auto &self = *static_cast<Source *>(opaque);
    require(self.closes == 0 && !self.ended && self.flash.staged == self.received, "ACK before NOR staging");
    if (self.received) {
      self.link.send(wire::ack(self.job, uint32_t(self.received)));
      ++self.acknowledgements;
    }
    Input input;
    if (!input.read(self.link, output, capacity)) {
      return {input.disconnected ? MediaBlockKind::Disconnected : MediaBlockKind::Invalid};
    }
    if (input.frame.header.kind == wire::Kind::Data && input.data.job == self.job) {
      if (input.data.offset != self.received) return {MediaBlockKind::Invalid};
      self.received += input.data.count;
      return {MediaBlockKind::Data, transaction, input.data.offset, input.data.count};
    }
    if (input.job() == self.job) {
      if (input.frame.header.kind == wire::Kind::End && pet::u32(input.payload.data() + 16) == self.received && !capacity) {
        self.ended = true;
        return {MediaBlockKind::End, transaction, self.received, 0};
      }
      if (input.frame.header.kind == wire::Kind::Cancel) self.stopped = true;
    }
    return {MediaBlockKind::Invalid};
  }

  void checkpoint(bool committed, bool inject, uint8_t *scratch) {
    require(ended && !closes, "commit before END or after source close");
    if (inject) std::cout << (committed ? "after-marker" : "before-marker") << std::endl;
    if (!inject && !link.pending()) return;
    Input input;
    const bool cancel = input.read(link, scratch, wire::block_max) &&
                        input.frame.header.kind == wire::Kind::Cancel && input.job() == job;
    if (!committed) {
      stopped = true;
      invalid = !cancel;
    }
    if (inject && committed) require(cancel, "expected late CANCEL");
  }
};

wire::detail::Packet<68> receipt(const wire::Job &job, wire::Outcome outcome,
                                const pet400_boot::Catalog &root, unsigned action) {
  wire::Sha sha{};
  wire::detail::Packet<68> frame;
  const bool saved = outcome == wire::Outcome::Saved;
  if (saved) std::copy_n(root.find(action)->sample->sha, sha.size(), sha.data());
  require(wire::result(job, outcome, saved ? root.sequence() : 0,
                       saved ? root.find(action)->generation : 0, sha, frame), "result encode");
  return frame;
}

void run(unsigned port, const std::vector<uint8_t> &initial, unsigned action, const std::string &mode) {
  Flash flash(initial);
  const auto before = recover(flash);
  wire::Job job{};
  {
    Connection link(port);
    send_hello(link, before);
    Input input;
    require(input.read(link) && input.frame.header.kind == wire::Kind::Begin, "expected BEGIN");
    job = input.job();
    const auto *p = input.payload.data();
    const auto *object = before.find(action);
    const auto &sample = *object->sample;
    wire::Sha ns;
    pet400_boot::namespace_id(ns.data());
    require(job != wire::Job{} && pet::get64(p + 16) == boot && pet::get64(p + 24) == before.sequence() &&
            pet::get64(p + 32) == object->generation && pet::u16(p + 40) == action &&
            pet::u16(p + 42) == sample.frames && pet::u32(p + 44) == sample.bytes &&
            !memcmp(p + 60, sample.sha, 32) && !memcmp(p + 92, ns.data(), ns.size()), "BEGIN identity");

    std::vector<uint8_t> transfer(4096), history(pet400::pixels), tile(pet400::tile_bytes), decoder(pet400::input_bytes);
    std::vector<uint16_t> rgb(pet400::pixels);
    Workspace work{transfer.data(), transfer.size(),
                   {history.data(), tile.data(), decoder.data(), history.size(), tile.size(), decoder.size()},
                   rgb.data(), rgb.size()};
    Source source{link, flash, job};
    flash.checkpoint = [&](bool committed) {
      source.checkpoint(committed, committed ? mode == "late" : mode == "cancel" || mode == "extra", transfer.data());
    };
    link.send(wire::ready(job));
    const auto result = save_from_media(flash, action, transaction, {&source, Source::receive, Source::close},
                                       work, {true, true}, {Source::cancelled, &source});
    flash.checkpoint = {};
    const bool committed = mode != "cancel" && mode != "extra";
    const auto after = recover(flash);
    require(result.result == (committed ? Result::Saved : Result::Cancelled) &&
            source.invalid == (mode == "extra") && source.closes == 1 && source.ended &&
            source.acknowledgements == (sample.bytes + wire::block_max - 1) / wire::block_max &&
            result.received == sample.bytes && after.sequence() == before.sequence() + unsigned(committed), "save outcome");
    for (const auto id : pet400_boot::ids) {
      const auto old_slot = before.find(id)->slot;
      const auto base = pet400_boot::Catalog::base(old_slot);
      const bool rotated = committed && id == action;
      require(after.find(id)->slot == (rotated ? 4 : old_slot) &&
              after.find(id)->generation == (rotated ? 5 : before.find(id)->generation) &&
              !memcmp(initial.data() + base, flash.bytes.data() + base, pet400_boot::stride), "NOR slot isolation");
    }
    require(!memcmp(initial.data() + pet400_boot::Catalog::base(object->slot) + pet400_boot::sector,
                    flash.bytes.data() + spare, sample.bytes), "NOR payload readback");
    const auto outcome = committed ? wire::Outcome::Saved : source.invalid ? wire::Outcome::Failed : wire::Outcome::Cancelled;
    if (mode != "lost") link.send(receipt(job, outcome, after, action));
  }
  if (mode == "lost") {
    const auto after = recover(flash);
    const auto writes = flash.ops;
    for (const bool matches : {false, true}) {
      Connection link(port);
      send_hello(link, after);
      Input input;
      require(input.read(link) && input.frame.header.kind == wire::Kind::Query &&
              (input.job() == job) == matches, "QUERY must match full job");
      link.send(receipt(input.job(), matches ? wire::Outcome::Saved : wire::Outcome::Unknown, after, action));
    }
    require(flash.ops == writes, "QUERY changed NOR");
  }
  std::cout << "nor-verified" << std::endl;
}
} // namespace

int main(int argc, char **argv) {
  std::signal(SIGPIPE, SIG_IGN);
  try {
    require(argc == 5, "expected port, fixture, action, mode");
    const auto port = std::stoul(argv[1]), action = std::stoul(argv[3]);
    const std::string mode = argv[4];
    require(port > 0 && port <= 65535 && (action == 1 || action == 11) &&
            (mode == "save" || mode == "cancel" || mode == "late" || mode == "extra" || mode == "lost"), "test parameters");
    std::ifstream stream(argv[2], std::ios::binary);
    std::vector<uint8_t> initial(pet400_boot::capacity);
    require(bool(stream.read(reinterpret_cast<char *>(initial.data()), initial.size())) &&
            stream.peek() == std::char_traits<char>::eof(), "NOR fixture length");
    run(unsigned(port), initial, unsigned(action), mode);
  } catch (const std::exception &error) {
    std::cerr << error.what() << '\n';
    return 1;
  }
}

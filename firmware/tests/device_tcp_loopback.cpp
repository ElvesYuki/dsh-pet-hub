#include "device_tcp_socket.h"
#include "usb_status.h"
#include "action_update.h"

#include <arpa/inet.h>
#include <cassert>
#include <chrono>
#include <csignal>
#include <cstdio>
#include <cstdlib>
#include <fcntl.h>
#include <string>
#include <thread>
#include <vector>
#include <unistd.h>

using namespace vp8_lan;
using namespace std::chrono;
using vp8_status::Battery;
using vp8_status::Imu;
using vp8_status::Status;
using vp8_status::Touch;

namespace {
std::vector<uint8_t> unhex(std::string_view hex) {
  assert(hex.size() % 2 == 0);
  std::vector<uint8_t> out;
  const auto n = [](char c) { return c >= 'a' ? c - 'a' + 10 : c - '0'; };
  for (size_t i = 0; i < hex.size(); i += 2) out.push_back(uint8_t(n(hex[i]) * 16 + n(hex[i + 1])));
  return out;
}

Status full() {
  return {"0.1.32-l-battery-usb-pair-test", 1, true, false, Battery{true, true, 83, 1, 2, 4187},
          Touch{2, 0, 465}, Imu{{-4000, 23, 4000}, {-256000, 0, 256000}}};
}

Status minimal() { return {"0.1.32-l-battery-usb-pair-test", 1, false, true, {}, {}, {}}; }

void subscriptions(const char *first_report) {
  vp8_status::UsbSubscription usb;
  std::vector<std::string> lines;
  const auto tick = [&](uint64_t now) {
    usb.tick(now, minimal, [&](std::string_view line) { lines.emplace_back(line); });
  };
  tick(0);
  assert(lines.empty() && !usb.receive("STATUS3 4a01c0de", 1));
  assert(usb.receive("STATUS3_SUB A001c0de", 10));
  tick(10);
  assert(lines.empty());
  assert(usb.receive("STATUS3_SUB 4a01c0de", 100));
  tick(100);
  const auto expected = unhex(first_report);
  assert(lines.size() == 1 && std::ranges::equal(lines.back() + '\n', expected));
  assert(usb.receive("STATUS3_SUB 4a01c0de", 3100));
  tick(3100);
  assert(lines.size() == 2 && lines.back().starts_with("@VP8_STATUS3_PUSH id=4a01c0de seq=2 data="));
  assert(usb.receive("STATUS3_UNSUB 01020304", 4000));
  tick(9000);
  assert(lines.size() == 3 && lines.back().starts_with("@VP8_STATUS3_PUSH id=4a01c0de seq=3 data="));
  tick(9001);
  assert(lines.size() == 3); // No burst following a delayed worker.
  assert(usb.receive("STATUS3_SUB 01020304", 9010));
  tick(9010);
  assert(lines.size() == 4 && lines.back().starts_with("@VP8_STATUS3_PUSH id=01020304 seq=1 data="));
  assert(usb.receive("STATUS3_UNSUB 01020304", 9020));
  tick(13000);
  assert(lines.size() == 4);
  assert(usb.receive("STATUS3_SUB 01020304", 13001));
  tick(28001);
  assert(lines.size() == 4);

  vp8_control::Control control;
  assert(control.begin_verified(1, 0));
  assert(control.renew_verified(9000) && !control.pop());
  assert(control.tick(23999));
  assert(!control.renew_verified(24000));
}

void vectors(char **value) {
  const auto check = [](const Status &status, uint32_t sequence, const char *hex) {
    std::array<uint8_t, max_status_size> encoded{};
    const auto size = encode_status(status, 1, sequence, encoded);
    const auto expected = unhex(hex);
    const auto message = Bytes(encoded).first(size);
    assert(std::ranges::equal(message.subspan(status_context_size), expected));
    const auto receipt = decode_status(message);
    assert(receipt && receipt->session == 1 && receipt->sequence == sequence && receipt->status == status);
    for (size_t i = 0; i < size; ++i) assert(!decode_status(message.first(i)));
    for (size_t i = 0; i < expected.size(); ++i) assert(!vp8_status::decode(Bytes(expected).first(i)));
    auto bad = expected;
    bad[2] |= 128;
    assert(!vp8_status::decode(bad));
  };
  check(full(), 1, value[0]);
  check(minimal(), 2, value[1]);

  Digest key{};
  for (unsigned i = 0; i < key.size(); ++i) key[i] = uint8_t(i);
  const auto expected = unhex(value[2]);
  std::array<uint8_t, max_status_size> payload{};
  const auto length = encode_status(full(), 1, 1, payload);
  Packet sealed;
  assert(seal(sealed, Kind::status, 3, Bytes(payload).first(length), key));
  assert(std::ranges::equal(sealed.bytes(), expected));
  assert(verify_record(Kind::status, expected, 3, key));
  assert(!verify_record(Kind::status, expected, 4, key));
  auto modified = expected;
  modified[13] ^= 1;
  assert(!verify_record(Kind::status, modified, 3, key));

  Framer f;
  int seen = 0;
  auto input = expected;
  input.insert(input.end(), expected.begin(), expected.end());
  const auto take = [&](Kind kind, Bytes raw) {
    assert(kind == Kind::status && std::ranges::equal(raw, expected));
    ++seen;
    return true;
  };
  assert(f.push(Bytes(input).first(7), take) && !seen && f.partial());
  assert(f.push(Bytes(input).subspan(7), take) && seen == 2 && !f.partial());
  input[7] = 255;
  assert(!f.push(input, take));

  const auto hello = unhex(value[3]), auth = unhex(value[4]);
  Digest transcript{}, shared{}, d2h{}, h2d{};
  const auto secret = unhex(value[6]);
  assert(crypto::sha256({{hello.data(), hello.size()}, {auth.data(), auth.size()}}, transcript));
  assert(std::ranges::equal(transcript, unhex(value[5])) && secret.size() == shared.size());
  std::copy(secret.begin(), secret.end(), shared.begin());
  assert(crypto::hkdf(shared, transcript, "VPL1/device-to-hub", d2h));
  assert(crypto::hkdf(shared, transcript, "VPL1/hub-to-device", h2d));
  assert(std::ranges::equal(d2h, unhex(value[7])) && std::ranges::equal(h2d, unhex(value[8])));

  const auto request = unhex(value[9]);
  vp8_cache::BasicUpdateLines<384> lines;
  std::string response;
  unsigned captured{};
  const auto receive = [&](uint8_t byte) {
    lines.push(byte, [&](std::string_view line) {
      vp8_status::handle_usb(line, [&] { return captured++ == 0 ? full() : minimal(); },
          [&](std::string_view reply) { response = reply; response += '\n'; });
    });
  };
  for (uint8_t byte : std::string_view("STATUS2\nBATTERY1 4a01c0de\nSENSORS1 4a01c0de\nSTATUS3 WRONG\n"))
    receive(byte);
  assert(captured == 0 && response.empty());
  for (size_t i = 0; i + 1 < request.size(); ++i) receive(request[i]);
  assert(captured == 0);
  receive(request.back());
  assert(captured == 1 && unhex(value[10]) == std::vector<uint8_t>(response.begin(), response.end()));
  for (auto byte : request) receive(byte);
  assert(captured == 2 && unhex(value[11]) == std::vector<uint8_t>(response.begin(), response.end()));
  assert(!vp8_status::decode(unhex(value[12])));
  const auto ack = unhex(value[13]);
  assert(verify_record(Kind::status_ack, ack, 1, key));
  assert(!verify_record(Kind::status_ack, ack, 2, key));
  subscriptions(value[14]);
}

enum class Expiry { none, pending, claimed };

struct Port final : ControlPort {
  explicit Port(Expiry expiry) : expiry(expiry) {}

  const Expiry expiry;
  vp8_control::Control control;
  std::optional<vp8_control::Ticket> delayed;
  unsigned opens{}, closed{}, snapshots{}, late{};
  bool open(uint32_t session, uint64_t now) override {
    if (!control.begin_verified(session, now)) return false;
    ++opens;
    snapshots = 0;
    return true;
  }
  void close() override { ++closed; control.close(); delayed.reset(); }
  bool receive(const vp8_control::Frame &frame, uint64_t now) override {
    if (!control.receive(frame, now)) return false;
    if (expiry != Expiry::none) {
      const auto message = vp8_control::decode(frame);
      if (message && message->kind == vp8_control::Kind::play && message->ticket.action == 2) {
        delayed = message->ticket;
        if (expiry == Expiry::claimed) assert(control.claim(now, false) == delayed);
        return true;
      }
    }
    if (auto ticket = control.claim(now, false)) control.presented(*ticket, now, ++display);
    return true;
  }
  bool tick(uint64_t now) override {
    if (!control.tick(now)) return false;
    if (delayed && !control.waiting() && !control.owns(*delayed)) {
      // A released ticket cannot confirm a late first-frame completion.
      assert(!control.presented(*delayed, now, display + 1));
      delayed.reset();
      ++late;
    }
    return true;
  }
  bool renew(uint64_t now) override { return control.renew_verified(now); }
  std::optional<vp8_control::Message> pop() override { return control.pop(); }
  Status snapshot() override { return ++snapshots % 2 ? full() : minimal(); }
  uint32_t display{};
};

uint64_t now_ms() { return duration_cast<milliseconds>(steady_clock::now().time_since_epoch()).count(); }
} // namespace

int main(int argc, char **argv) {
  assert(argc >= 2 && crypto::initialize());
  if (std::string_view(argv[1]) == "vectors") {
    assert(argc == 17);
    vectors(argv + 2);
    return 0;
  }
  if (std::string_view(argv[1]) == "usb") {
    vp8_cache::BasicUpdateLines<384> lines;
    for (int byte; (byte = std::getchar()) != EOF;) {
      lines.push(uint8_t(byte), [](std::string_view line) {
        vp8_status::handle_usb(line, minimal, [](std::string_view reply) {
          std::printf("%.*s\n", int(reply.size()), reply.data());
        });
      });
    }
    return 0;
  }
  assert(argc == 5);
  std::signal(SIGPIPE, SIG_IGN);
  const auto controller = unhex(argv[3]);
  Identity identity;
  assert(controller.size() == identity.controller_key.size());
  std::copy(controller.begin(), controller.end(), identity.controller_key.begin());
  identity.device.fill(1);
  identity.controller.fill(2);
  identity.binding.fill(3);
  identity.epoch = 4;
  crypto::Secret scalar;
  scalar.bytes.back() = 7;
  Key device;
  assert(device.import_signing(scalar.bytes));

  const std::string_view mode = argv[1];
  assert(mode == "tcp" || mode == "tcp-expiry-pending" || mode == "tcp-expiry-claimed");
  const auto expiry = mode == "tcp-expiry-pending" ? Expiry::pending :
                      mode == "tcp-expiry-claimed" ? Expiry::claimed : Expiry::none;
  Port port(expiry);
  std::optional<Session> session(std::in_place, port);
  Socket io;
  for (int i = 0; i < std::atoi(argv[4]); ++i) {
    const bool reboot = i == 7;
    if (reboot) {
      session.reset();
      port.control = {};
      session.emplace(port);
    }
    const auto fd = ::socket(AF_INET, SOCK_STREAM, 0);
    assert(fd >= 0);
    sockaddr_in address{};
    address.sin_family = AF_INET;
    address.sin_port = htons(std::atoi(argv[2]));
    address.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
    assert(::connect(fd, reinterpret_cast<sockaddr *>(&address), sizeof(address)) == 0);
    assert(fcntl(fd, F_SETFL, O_NONBLOCK) == 0);
    const auto until = now_ms() + 23000;
    assert(session->start(identity, device, i >= 7 ? 98766 : 98765, now_ms()));
    while (now_ms() < until && io.step(fd, *session, now_ms())) std::this_thread::sleep_for(milliseconds(2));
    session->close();
    io.reset();
    ::close(fd);
    assert(now_ms() < until);
  }
  std::printf("open=%u close=%u display=%u", port.opens, port.closed, port.display);
  if (expiry != Expiry::none) std::printf(" late=%u", port.late);
  std::puts("");
}

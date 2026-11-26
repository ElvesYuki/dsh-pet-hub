#include "action_update.h"
#include "device_pairing.h"

#include <cassert>
#include <iostream>
#include <string>
#include <vector>

namespace {
using namespace vp8_pairing;
using Packet = std::vector<uint8_t>;
constexpr uint64_t boot = 9007199254740999ULL;

Identifier device_id() {
  Identifier id{};
  id.fill(0x11);
  return id;
}

struct Store : binding::Storage {
  binding::Blob record{};
  bool present{}, fail_readback{};
  unsigned writes{};

  binding::Load read(binding::Blob &output) override {
    if (!present) return binding::Load::Missing;
    output = record;
    return fail_readback ? binding::Load::Failed : binding::Load::Present;
  }

  bool commit(const binding::Blob &value) override {
    record = value;
    present = true;
    ++writes;
    return true;
  }
};

Packet request(Type type, size_t size) {
  Packet packet(pbp::header_bytes + size);
  packet[5] = uint8_t(type);
  return packet;
}

std::string line_for(const Packet &packet, std::string_view prefix) {
  std::array<char, text_limit> text{};
  const auto count = encode(packet, text);
  assert(count);
  return std::string(prefix) + std::string(text.data(), count) + '\n';
}

Packet sealed(Packet packet) {
  pbp::seal(packet.data(), Type(packet[5]), packet.size() - pbp::header_bytes);
  return packet;
}

struct Rig {
  Session pairing;
  vp8_cache::BasicUpdateLines<384> lines;
  Packet reply;
  unsigned statuses{};

  Rig(Store &store, uint64_t boot_id = boot, bool direct = false)
    // Tests exercise the same dispatch and persistence with a deterministic
    // signature verifier. ESP-IDF links the existing production PSA verifier.
    : pairing(store, [](const auto &, const auto &, const auto &signature) { return signature[0] == 0x55; },
              boot_id, device_id(), direct) { assert(pairing.load() == Result::Ok); }

  void push(std::string_view input, uint64_t now, bool idle = true) {
    reply.clear();
    for (uint8_t c : input) lines.push(c, [&](std::string_view command) {
      if (command == "STATUS2") ++statuses;
      if (!command.starts_with(request_prefix)) return;
      pairing.receive(command.substr(request_prefix.size()), now, idle,
        [](Digest &nonce) { nonce.fill(0x44); return true; },
        [&](auto bytes) { reply.assign(bytes.begin(), bytes.end()); });
    });
  }

  Packet send(const Packet &packet, uint64_t now, bool idle = true) {
    push(line_for(sealed(packet), request_prefix), now, idle);
    return reply;
  }
};

Packet proof(Mode mode, uint32_t reference, uint64_t boot_id = boot, uint8_t nonce = 0x66) {
  auto packet = request(proof_request, proof_request_bytes);
  auto *body = packet.data() + pbp::header_bytes;
  body[0] = uint8_t(mode);
  pet::put64(body + 4, boot_id);
  const auto id = device_id();
  std::copy(id.begin(), id.end(), body + 12);
  std::fill_n(body + 28, 32, nonce);
  pet::put32(body + 60, reference);
  return packet;
}

Packet proposal(uint32_t reference, bool signed_correctly = true) {
  auto offer = request(Type::BindingEnroll, 173);
  auto *body = offer.data() + pbp::header_bytes;
  pet::put32(body, reference);
  std::fill_n(body + 4, 16, 0x22);
  std::fill_n(body + 20, 16, 0x33);
  pet::put64(body + 36, 1);
  std::fill_n(body + 44, 65, 0x99);
  body[44] = 4;
  body[109] = signed_correctly ? 0x55 : 0;
  return offer;
}

Packet challenge(uint8_t mode) {
  auto packet = request(Type::BindingChallenge, 1);
  packet.back() = mode;
  return packet;
}

uint32_t challenge_reference(Rig &rig, uint64_t start, uint8_t mode) {
  const auto nonce = rig.send(challenge(mode), start);
  assert(nonce.size() == 56 && nonce[5] == uint8_t(Type::BindingNonce) && nonce[16] == 0 && nonce[17] == mode);
  const auto reference = pet::u32(nonce.data() + 20);
  assert(reference);
  return reference;
}

uint32_t enroll(Rig &rig, uint64_t start) {
  const auto reference = challenge_reference(rig, start, boot_enroll);
  const auto waiting = rig.send(proposal(reference), start + 1);
  assert(waiting.size() == 104 && waiting[5] == uint8_t(Type::BindingEnrolled));
  assert(waiting[16] == 0 && waiting[17] == 1 && pet::u32(waiting.data() + 100) == reference);
  return reference;
}

void click(Rig &rig, uint32_t drawn, uint64_t start) {
  rig.pairing.tick(start, drawn, false, true);
  rig.pairing.tick(start + 45000, drawn, false, true);
  rig.pairing.tick(start + 60000, drawn, true, true);
  rig.pairing.tick(start + 105000, drawn, true, true);
  rig.pairing.tick(start + 160000, drawn, false, true);
  rig.pairing.tick(start + 205000, drawn, false, true);
}

void expect_proof(const Packet &response, Mode mode, Result result, Phase phase, uint8_t nonce) {
  assert(response.size() == 152 && response[5] == uint8_t(proof_response));
  const auto *body = response.data() + 16;
  assert(body[0] == uint8_t(result) && body[1] == uint8_t(phase) && body[2] == uint8_t(mode) && !body[3]);
  assert(std::all_of(body + 100, body + 132, [nonce](uint8_t byte) { return byte == nonce; }));
  assert(pet::u32(response.data() + 12) == pbp::checksum(response.data(), body, proof_response_bytes));
}
}

int main(int argc, char **argv) {
  const bool vectors = argc == 2 && std::string_view(argv[1]) == "--vectors";
  const bool usb_vectors = argc == 2 && std::string_view(argv[1]) == "--usb-vectors";
  const auto emit = [vectors](std::string_view key, const Packet &packet) {
    if (vectors) std::cout << key << ' ' << line_for(packet, reply_prefix);
  };

  Store store;
  Rig rig(store);
  const auto status = rig.send(request(Type::BindingInfo, 0), 10);
  assert(status.size() == 100 && status[18] == 7);
  rig.push("VP8PAIR1 A===\nVP8PAIR1 WAVE\nSTATUS2\n", 11);
  assert(rig.reply.empty() && rig.statuses == 1);
  auto corrupt = sealed(proof(Mode::Fence, 0));
  corrupt.back() ^= 1;
  rig.push(line_for(corrupt, request_prefix), 12);
  assert(rig.reply.empty());

  const auto reference = enroll(rig, 100);
  const auto pending = rig.send(proof(Mode::Poll, reference), 200);
  expect_proof(pending, Mode::Poll, Result::Ok, Phase::Waiting, 0x66);
  emit("waiting", pending);
  expect_proof(rig.send(proof(Mode::Fence, 0), 210, false), Mode::Fence, Result::Busy, Phase::Waiting, 0x66);
  assert(rig.pairing.prompt() == reference);
  assert(rig.send(proof(Mode::Poll, reference + 1), 300).empty());
  assert(rig.send(proof(Mode::Fence, 0, boot + 1), 310).empty());
  assert(rig.send(proof(Mode::Fence, 0, boot, 0), 320).empty());
  click(rig, 0, 1000);
  assert(store.writes == 0);
  click(rig, reference, 300000);
  assert(store.writes == 1);
  const auto saved = rig.send(proof(Mode::Poll, reference, boot, 0x77), 600000);
  expect_proof(saved, Mode::Poll, Result::Ok, Phase::Bound, 0x77);
  Digest expected{};
  binding::Record record{};
  assert(binding::decode(store.record, device_id(), record) && auth::crypto::sha256({record.key}, expected));
  assert(std::equal(expected.begin(), expected.end(), saved.begin() + 84));
  emit("bound", saved);

  Rig rebooted(store, boot + 1);
  assert(rebooted.send(proof(Mode::Poll, reference, boot + 1), 700000).empty());
  const auto recovered = rebooted.send(proof(Mode::Fence, 0, boot + 1, 0x88), 800000);
  expect_proof(recovered, Mode::Fence, Result::Ok, Phase::Bound, 0x88);
  emit("recovered", recovered);

  Store empty;
  Rig fenced(empty);
  const auto stopped = enroll(fenced, 100);
  const auto unbound = fenced.send(proof(Mode::Fence, 0, boot, 0xaa), 200);
  expect_proof(unbound, Mode::Fence, Result::Ok, Phase::Unbound, 0xaa);
  click(fenced, stopped, 1000);
  assert(!empty.writes && fenced.send(proof(Mode::Poll, stopped), 300000).empty());
  emit("unbound", unbound);

  Store faulty;
  Rig broken(faulty);
  const auto fault_reference = enroll(broken, 100);
  faulty.fail_readback = true;
  click(broken, fault_reference, 1000);
  assert(faulty.writes == 1);
  const auto failure = broken.send(proof(Mode::Poll, fault_reference, boot, 0xbb), 250000);
  expect_proof(failure, Mode::Poll, Result::StorageFault, Phase::Fault, 0xbb);
  emit("fault", failure);

  Store other;
  Rig disconnected(other);
  const auto abandoned = enroll(disconnected, 100);
  disconnected.pairing.disconnect();
  click(disconnected, abandoned, 1000);
  assert(other.writes == 0);
  Rig expired(other);
  const auto stale = enroll(expired, 100);
  click(expired, stale, binding::Lifecycle::button_us + 1000);
  assert(other.writes == 0);
  expect_proof(expired.send(proof(Mode::Poll, stale), binding::Lifecycle::button_us + 250000),
               Mode::Poll, Result::Expired, Phase::Unbound, 0x66);

  Rig held(other);
  const auto held_reference = enroll(held, 100);
  for (uint64_t time = 1000; time < 300000; time += 50000)
    held.pairing.tick(time, held_reference, true, true);
  held.pairing.tick(310000, held_reference, false, true);
  held.pairing.tick(360000, held_reference, false, true);
  assert(other.writes == 0);
  for (uint64_t time = 420000; time < 1630000; time += 50000)
    held.pairing.tick(time, held_reference, true, true);
  held.pairing.tick(1640000, held_reference, false, true);
  held.pairing.tick(1690000, held_reference, false, true);
  assert(other.writes == 0);
  click(held, held_reference, 1720000);
  assert(other.writes == 1);

  Store direct_store;
  Rig disabled(direct_store);
  assert(disabled.send(challenge(usb_enroll), 100).empty());
  Rig direct(direct_store, boot, true);
  const auto usb_info = direct.send(request(Type::BindingInfo, 0), 100);
  assert(usb_info[18] == 15);
  if (usb_vectors) std::cout << "usb-info " << line_for(usb_info, reply_prefix);
  const auto bad = challenge_reference(direct, 200, usb_enroll);
  assert(direct.send(proposal(bad, false), 210)[16] == uint8_t(Result::Denied));
  assert(direct.send(proposal(bad), 220)[16] == uint8_t(Result::Denied));
  assert(!direct_store.writes);
  const auto canceled = challenge_reference(direct, 300, usb_enroll);
  expect_proof(direct.send(proof(Mode::Fence, 0), 310), Mode::Fence, Result::Ok, Phase::Unbound, 0x66);
  assert(direct.send(proposal(canceled), 320)[16] == uint8_t(Result::Denied) && !direct_store.writes);

  const auto usb_reference = challenge_reference(direct, 400, usb_enroll);
  assert(direct.send(proposal(usb_reference + 1), 410)[16] == uint8_t(Result::Denied));
  assert(direct.send(proposal(usb_reference), 420, false)[16] == uint8_t(Result::Busy));
  const auto usb_ack = direct.send(proposal(usb_reference), 430);
  assert(usb_ack[5] == uint8_t(Type::BindingEnrolled) && usb_ack[16] == 0 && usb_ack[17] == 2 && usb_ack[18] == 15);
  assert(pet::u32(usb_ack.data() + 100) == usb_reference && direct_store.writes == 1 && !direct.pairing.prompt());
  const auto usb_fence = direct.send(proof(Mode::Fence, 0, boot, 0xcc), 440);
  expect_proof(usb_fence, Mode::Fence, Result::Ok, Phase::Bound, 0xcc);
  if (usb_vectors) {
    std::cout << "usb-accepted " << line_for(usb_ack, reply_prefix);
    std::cout << "usb-fence " << line_for(usb_fence, reply_prefix);
  }
  Rig direct_reboot(direct_store, boot + 1, true);
  const auto bound_usb_info = direct_reboot.send(request(Type::BindingInfo, 0), 90);
  assert(bound_usb_info[17] == 2 && bound_usb_info[18] == 31);
  expect_proof(direct_reboot.send(proof(Mode::Fence, 0, boot + 1), 100), Mode::Fence, Result::Ok, Phase::Bound, 0x66);
  assert(direct_reboot.send(challenge(usb_enroll), 200)[16] == uint8_t(Result::Denied) && direct_store.writes == 1);

  Store direct_bad_store;
  Rig direct_fault(direct_bad_store, boot, true);
  direct_bad_store.fail_readback = true;
  const auto bad_write = challenge_reference(direct_fault, 100, usb_enroll);
  assert(direct_fault.send(proposal(bad_write), 110)[16] == uint8_t(Result::StorageFault));
  expect_proof(direct_fault.send(proof(Mode::Fence, 0), 120), Mode::Fence, Result::StorageFault, Phase::Fault, 0x66);

  Store boot_on_direct_store;
  Rig boot_on_direct(boot_on_direct_store, boot, true);
  assert(enroll(boot_on_direct, 100) && !boot_on_direct_store.writes && boot_on_direct.pairing.prompt());
  if (!vectors && !usb_vectors) std::cout << "VP8 BOOT and explicit USB binding, CRC, persistence, timeout and fence passed\n";
}

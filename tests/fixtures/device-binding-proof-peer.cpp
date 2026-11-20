#include "action_update.h"
#include "device_pairing.h"
#include <cassert>
#include <iostream>
#include <memory>
#include <openssl/core_names.h>
#include <openssl/ecdsa.h>
#include <openssl/evp.h>
#include <sstream>
#include <string>
#include <type_traits>

namespace pairing = vp8_pairing;
namespace binding = pairing::binding;

struct Memory final : binding::Storage {
  binding::Blob bytes{};
  binding::Load state = binding::Load::Missing;
  bool fail_write = false;
  binding::Load read(binding::Blob &out) override { out = bytes; return state; }
  bool commit(const binding::Blob &next) override {
    if (fail_write) return false;
    bytes = next;
    state = binding::Load::Present;
    return true;
  }
};

// The test calls the real lifecycle and checks its transcript. P-256 itself
// is covered by the historical crypto tests, outside this fixture.
bool check_signature(const binding::PublicKey &key, const pairing::Digest &hash, const binding::Signature &signature) {
  return key[0] == 4 && std::equal(hash.begin(), hash.end(), signature.begin());
}

bool verify_p256(const binding::PublicKey &key, const pairing::Digest &hash, const binding::Signature &signature) {
  std::unique_ptr<EVP_PKEY_CTX, decltype(&EVP_PKEY_CTX_free)> import(
    EVP_PKEY_CTX_new_from_name(nullptr, "EC", nullptr), EVP_PKEY_CTX_free);
  auto point = key;
  char curve[] = "prime256v1";
  OSSL_PARAM parameters[] = {OSSL_PARAM_construct_utf8_string(OSSL_PKEY_PARAM_GROUP_NAME, curve, 0),
    OSSL_PARAM_construct_octet_string(OSSL_PKEY_PARAM_PUB_KEY, point.data(), point.size()),
    OSSL_PARAM_construct_end()};
  EVP_PKEY *raw = nullptr;
  if (!import || EVP_PKEY_fromdata_init(import.get()) != 1 ||
      EVP_PKEY_fromdata(import.get(), &raw, EVP_PKEY_PUBLIC_KEY, parameters) != 1) return false;
  std::unique_ptr<EVP_PKEY, decltype(&EVP_PKEY_free)> pub(raw, EVP_PKEY_free);
  std::unique_ptr<ECDSA_SIG, decltype(&ECDSA_SIG_free)> parts(ECDSA_SIG_new(), ECDSA_SIG_free);
  std::unique_ptr<BIGNUM, decltype(&BN_free)> r(BN_bin2bn(signature.data(), 32, nullptr), BN_free);
  std::unique_ptr<BIGNUM, decltype(&BN_free)> s(BN_bin2bn(signature.data() + 32, 32, nullptr), BN_free);
  if (!parts || !r || !s || ECDSA_SIG_set0(parts.get(), r.get(), s.get()) != 1) return false;
  static_cast<void>(r.release());
  static_cast<void>(s.release());
  std::array<unsigned char, 80> der{};
  auto *cursor = der.data();
  const auto size = i2d_ECDSA_SIG(parts.get(), &cursor);
  std::unique_ptr<EVP_PKEY_CTX, decltype(&EVP_PKEY_CTX_free)> verify(
    EVP_PKEY_CTX_new(pub.get(), nullptr), EVP_PKEY_CTX_free);
  return size > 0 && verify && EVP_PKEY_verify_init(verify.get()) == 1 &&
    EVP_PKEY_CTX_set_signature_md(verify.get(), EVP_sha256()) == 1 &&
    EVP_PKEY_verify(verify.get(), der.data(), size, hash.data(), hash.size()) == 1;
}

template<class Session>
std::unique_ptr<Session> open_session(Memory &memory, binding::VerifySignature verify, uint64_t boot,
                                      const pairing::Identifier &device, bool usb) {
  if constexpr (std::is_constructible_v<Session, Memory &, binding::VerifySignature, uint64_t,
                                         const pairing::Identifier &, bool>) {
    return std::make_unique<Session>(memory, verify, boot, device, usb);
  } else {
    assert(!usb);
    return std::make_unique<Session>(memory, verify, boot, device);
  }
}

int main(int argc, char **argv) {
  auto verify = check_signature;
  bool usb = false;
  for (int i = 1; i < argc; ++i) {
    if (std::string_view(argv[i]) == "--p256") verify = verify_p256;
    else if (std::string_view(argv[i]) == "--usb") usb = true;
    else return 2;
  }
  uint64_t boot = 9007199254740999ULL, now = 0;
  bool idle = true;
  Memory memory;
  pairing::Identifier device{};
  device.fill(0x11);
  auto open = [&] {
    auto session = open_session<pairing::Session>(memory, verify, boot, device, usb);
    assert(session->load() == pairing::Result::Ok);
    return session;
  };
  auto session = open();
  vp8_cache::BasicUpdateLines<384> serial;
  for (std::string line; std::getline(std::cin, line);) {
    if (line == "#reset") { ++boot; session = open(); continue; }
    if (line == "#fail-write") { memory.fail_write = true; continue; }
    if (line == "#busy") { idle = false; continue; }
    if (line == "#idle") { idle = true; continue; }
    if (line.starts_with("#tick ")) {
      uint32_t drawn;
      bool pressed;
      std::istringstream args(line.substr(6));
      assert(args >> now >> drawn >> pressed);
      session->tick(now, drawn, pressed, idle);
      continue;
    }
    bool answered = false;
    const auto dispatch = [&](std::string_view input) {
      if (input == "STATUS2") { answered = true; std::cout << "status2\n"; return; }
      if (!input.starts_with(pairing::request_prefix)) return;
      input.remove_prefix(pairing::request_prefix.size());
      session->receive(input, ++now, idle, [](pairing::Digest &challenge) {
        challenge.fill(0x55);
        return true;
      }, [&](std::span<const uint8_t> packet) {
        std::array<char, pairing::text_limit> encoded{};
        const auto size = pairing::encode(packet, encoded);
        answered = true;
        std::cout << pairing::reply_prefix << std::string_view(encoded.data(), size) << '\n';
      });
    };
    for (const unsigned char byte : line) serial.push(byte, dispatch);
    serial.push('\n', dispatch);
    if (!answered) std::cout << "-\n";
    std::cout.flush();
  }
}

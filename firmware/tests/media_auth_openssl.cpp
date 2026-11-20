#include "persistence/media_auth_crypto.h"
#include <openssl/core_names.h>
#include <openssl/crypto.h>
#include <openssl/evp.h>
#include <openssl/kdf.h>
#include <openssl/params.h>
#include <cstring>

namespace pet400_persist::media_auth::crypto {
namespace {
template<class Update> bool feed(Parts parts, Update update) {
  for (const auto part : parts) {
    if (!part.valid() || (part.size && update(part) != 1)) return false;
  }
  return true;
}
}

bool initialize() { return OPENSSL_init_crypto(0, nullptr) == 1; }

bool sha256(Parts parts, Digest &output) {
  auto *context = EVP_MD_CTX_new();
  unsigned count = 0;
  const bool ok = context && EVP_DigestInit_ex(context, EVP_sha256(), nullptr) == 1 &&
    feed(parts, [&](Bytes part) { return EVP_DigestUpdate(context, part.data, part.size); }) &&
    EVP_DigestFinal_ex(context, output.data(), &count) == 1 && count == output.size();
  EVP_MD_CTX_free(context);
  return ok;
}

bool hkdf(const Digest &secret, const Digest &salt, const char *info, Digest &output) {
  auto *kdf = EVP_KDF_fetch(nullptr, "HKDF", nullptr);
  auto *context = kdf ? EVP_KDF_CTX_new(kdf) : nullptr;
  char digest[] = "SHA256";
  const OSSL_PARAM params[] = {
    OSSL_PARAM_construct_utf8_string(OSSL_KDF_PARAM_DIGEST, digest, 0),
    OSSL_PARAM_construct_octet_string(OSSL_KDF_PARAM_KEY, const_cast<uint8_t *>(secret.data()), secret.size()),
    OSSL_PARAM_construct_octet_string(OSSL_KDF_PARAM_SALT, const_cast<uint8_t *>(salt.data()), salt.size()),
    OSSL_PARAM_construct_octet_string(OSSL_KDF_PARAM_INFO, const_cast<char *>(info), std::strlen(info)),
    OSSL_PARAM_construct_end()};
  const bool ok = context && EVP_KDF_derive(context, output.data(), output.size(), params) == 1;
  EVP_KDF_CTX_free(context);
  EVP_KDF_free(kdf);
  return ok;
}

bool tag(const Digest &key, Parts parts, Digest &output) {
  auto *mac = EVP_MAC_fetch(nullptr, "HMAC", nullptr);
  auto *context = mac ? EVP_MAC_CTX_new(mac) : nullptr;
  char digest[] = "SHA256";
  const OSSL_PARAM params[] = {OSSL_PARAM_construct_utf8_string(OSSL_MAC_PARAM_DIGEST, digest, 0), OSSL_PARAM_construct_end()};
  size_t count = 0;
  const bool ok = context && EVP_MAC_init(context, key.data(), key.size(), params) == 1 &&
    feed(parts, [&](Bytes part) { return EVP_MAC_update(context, part.data, part.size); }) &&
    EVP_MAC_final(context, output.data(), &count, output.size()) == 1 && count == output.size();
  EVP_MAC_CTX_free(context);
  EVP_MAC_free(mac);
  return ok;
}

bool verify(const Digest &key, Parts parts, const Digest &expected) {
  Secret actual;
  return tag(key, parts, actual.bytes) && CRYPTO_memcmp(actual.bytes.data(), expected.data(), expected.size()) == 0;
}
} // namespace pet400_persist::media_auth::crypto

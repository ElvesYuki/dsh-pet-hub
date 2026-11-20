#include "media_auth_crypto.h"
#include "psa/crypto.h"
#include <cstring>

namespace pet400_persist::media_auth::crypto {
namespace {
constexpr auto hash_alg = PSA_ALG_SHA_256;
constexpr auto mac_alg = PSA_ALG_HMAC(hash_alg);

template<class Update> bool feed(Parts parts, Update update) {
  for (const auto part : parts) {
    if (!part.valid() || (part.size && update(part) != PSA_SUCCESS)) return false;
  }
  return true;
}

bool mac(const Digest &key, Parts parts, Digest *output, const Digest *expected) {
  psa_key_attributes_t attributes = PSA_KEY_ATTRIBUTES_INIT;
  psa_set_key_type(&attributes, PSA_KEY_TYPE_HMAC);
  psa_set_key_lifetime(&attributes, PSA_KEY_LIFETIME_VOLATILE);
  psa_set_key_usage_flags(&attributes, output ? PSA_KEY_USAGE_SIGN_MESSAGE : PSA_KEY_USAGE_VERIFY_MESSAGE);
  psa_set_key_algorithm(&attributes, mac_alg);
  mbedtls_svc_key_id_t id{};
  const auto imported = psa_import_key(&attributes, key.data(), key.size(), &id);
  psa_reset_key_attributes(&attributes);
  if (imported != PSA_SUCCESS) return false;

  psa_mac_operation_t operation = PSA_MAC_OPERATION_INIT;
  const auto setup = output ? psa_mac_sign_setup(&operation, id, mac_alg) : psa_mac_verify_setup(&operation, id, mac_alg);
  bool ok = setup == PSA_SUCCESS && feed(parts, [&](Bytes part) { return psa_mac_update(&operation, part.data, part.size); });
  if (ok) {
    if (output) {
      size_t count = 0;
      ok = psa_mac_sign_finish(&operation, output->data(), output->size(), &count) == PSA_SUCCESS && count == output->size();
    } else {
      ok = psa_mac_verify_finish(&operation, expected->data(), expected->size()) == PSA_SUCCESS;
    }
  }
  const auto aborted = psa_mac_abort(&operation);
  const auto destroyed = psa_destroy_key(id);
  return ok && aborted == PSA_SUCCESS && destroyed == PSA_SUCCESS;
}
}

bool initialize() { return psa_crypto_init() == PSA_SUCCESS; }

bool sha256(Parts parts, Digest &output) {
  psa_hash_operation_t operation = PSA_HASH_OPERATION_INIT;
  size_t count = 0;
  const bool ok = psa_hash_setup(&operation, hash_alg) == PSA_SUCCESS &&
    feed(parts, [&](Bytes part) { return psa_hash_update(&operation, part.data, part.size); }) &&
    psa_hash_finish(&operation, output.data(), output.size(), &count) == PSA_SUCCESS && count == output.size();
  return psa_hash_abort(&operation) == PSA_SUCCESS && ok;
}

bool hkdf(const Digest &secret, const Digest &salt, const char *info, Digest &output) {
  psa_key_derivation_operation_t operation = PSA_KEY_DERIVATION_OPERATION_INIT;
  const auto *label = reinterpret_cast<const uint8_t *>(info);
  const bool ok = psa_key_derivation_setup(&operation, PSA_ALG_HKDF(hash_alg)) == PSA_SUCCESS &&
    psa_key_derivation_input_bytes(&operation, PSA_KEY_DERIVATION_INPUT_SALT, salt.data(), salt.size()) == PSA_SUCCESS &&
    psa_key_derivation_input_bytes(&operation, PSA_KEY_DERIVATION_INPUT_SECRET, secret.data(), secret.size()) == PSA_SUCCESS &&
    psa_key_derivation_input_bytes(&operation, PSA_KEY_DERIVATION_INPUT_INFO, label, std::strlen(info)) == PSA_SUCCESS &&
    psa_key_derivation_output_bytes(&operation, output.data(), output.size()) == PSA_SUCCESS;
  return psa_key_derivation_abort(&operation) == PSA_SUCCESS && ok;
}

bool tag(const Digest &key, Parts parts, Digest &output) { return mac(key, parts, &output, nullptr); }
bool verify(const Digest &key, Parts parts, const Digest &expected) { return mac(key, parts, nullptr, &expected); }
} // namespace pet400_persist::media_auth::crypto

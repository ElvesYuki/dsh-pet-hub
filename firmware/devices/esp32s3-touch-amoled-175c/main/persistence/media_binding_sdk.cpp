#include "media_binding_sdk.h"
#include "nvs.h"
#include "nvs_flash.h"
#include "psa/crypto.h"

#if PET_PBP1_BINDING
// Wi-Fi remains wired to the rejecting wrappers. Only this adapter calls
// through to the real NVS operations, using its own handle and constant key.
extern "C" esp_err_t __real_nvs_get_blob(nvs_handle_t, const char *, void *, size_t *);
extern "C" esp_err_t __real_nvs_set_blob(nvs_handle_t, const char *, const void *, size_t);
extern "C" esp_err_t __real_nvs_commit(nvs_handle_t);
extern "C" void __real_nvs_close(nvs_handle_t);
#define BINDING_NVS(name) __real_nvs_##name
#else
#define BINDING_NVS(name) nvs_##name
#endif

namespace pet400_persist::media_auth::persistent_binding {
namespace {
constexpr char partition[] = "nvs";
constexpr char key_name[] = "record";
}

bool verify_p256(const PublicKey &key, const Digest &digest, const Signature &signature) {
  if (key[0] != 4 || !crypto::initialize()) return false;
  psa_key_attributes_t attributes = PSA_KEY_ATTRIBUTES_INIT;
  constexpr auto algorithm = PSA_ALG_ECDSA(PSA_ALG_SHA_256);
  psa_set_key_type(&attributes, PSA_KEY_TYPE_ECC_PUBLIC_KEY(PSA_ECC_FAMILY_SECP_R1));
  psa_set_key_bits(&attributes, 256);
  psa_set_key_lifetime(&attributes, PSA_KEY_LIFETIME_VOLATILE);
  psa_set_key_usage_flags(&attributes, PSA_KEY_USAGE_VERIFY_HASH);
  psa_set_key_algorithm(&attributes, algorithm);
  mbedtls_svc_key_id_t id{};
  const auto imported = psa_import_key(&attributes, key.data(), key.size(), &id);
  psa_reset_key_attributes(&attributes);
  if (imported != PSA_SUCCESS) return false;
  const auto verified = psa_verify_hash(id, algorithm, digest.data(), digest.size(),
                                        signature.data(), signature.size());
  const auto destroyed = psa_destroy_key(id);
  return verified == PSA_SUCCESS && destroyed == PSA_SUCCESS;
}

Load NvsStorage::read(Blob &out) {
  out = {};
  if (nvs_flash_init() != ESP_OK) return Load::Failed;
  nvs_handle_t handle;
  const auto opened = nvs_open_from_partition(partition, namespace_, NVS_READONLY, &handle);
  if (opened == ESP_ERR_NVS_NOT_FOUND) return Load::Missing;
  if (opened != ESP_OK) return Load::Failed;
  size_t length = out.size();
  const auto result = BINDING_NVS(get_blob)(handle, key_name, out.data(), &length);
  BINDING_NVS(close)(handle);
  if (result == ESP_ERR_NVS_NOT_FOUND) return Load::Missing;
  return result == ESP_OK && length == out.size() ? Load::Present : Load::Failed;
}

bool NvsStorage::commit(const Blob &bytes) {
  nvs_handle_t handle;
  if (nvs_open_from_partition(partition, namespace_, NVS_READWRITE, &handle) != ESP_OK) return false;
  const bool stored = BINDING_NVS(set_blob)(handle, key_name, bytes.data(), bytes.size()) == ESP_OK &&
    BINDING_NVS(commit)(handle) == ESP_OK;
  BINDING_NVS(close)(handle);
  return stored;
}

} // namespace pet400_persist::media_auth::persistent_binding

#pragma once

#include "media_binding.h"

namespace pet400_persist::media_auth::persistent_binding {

bool verify_p256(const PublicKey &, const Digest &, const Signature &);

class NvsStorage final : public Storage {
  const char *const namespace_;

public:
  explicit NvsStorage(const char *name = "pet_binding") : namespace_(name) {}
  Load read(Blob &) override;
  bool commit(const Blob &) override;
};

} // namespace pet400_persist::media_auth::persistent_binding

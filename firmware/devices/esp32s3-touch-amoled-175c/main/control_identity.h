#pragma once
#include "control_bridge.h"
#include "pet_sha256.h"

namespace pet400_transport {
using namespace pet400_control;
struct Inventory { uint16_t action=0;uint32_t bytes=0;uint16_t frames=0;Digest sha{}; };
struct Identity { Digest name_space{},manifest{},role_index{};std::array<Inventory,4> records{}; };
// Trusted caller supplies independently recovered/approved inventory; this is no grant.
inline bool binding(const Identity &i,uint64_t boot,Config &out) {
  if(!boot || !nonzero(i.name_space.data(),32) || !nonzero(i.manifest.data(),32) || !nonzero(i.role_index.data(),32))return false;
  constexpr uint16_t ids[]={0,1,4,11};Config result{};result.boot=boot;pet::Sha256 sha;
  constexpr char domain[]="pet400-tcp-map-draft/1";sha.update(domain,sizeof(domain));
  sha.update(i.name_space.data(),32);sha.update(i.manifest.data(),32);sha.update(i.role_index.data(),32);
  for(unsigned n=0;n<4;++n) {
    const Inventory *found=nullptr;
    for(const auto &r:i.records)if(r.action==ids[n]) { if(found)return false;found=&r; }
    if(!found || !found->bytes || found->frames!=241 || !nonzero(found->sha.data(),32))return false;
    uint8_t b[8];put(b,found->action,2);put(b+2,found->bytes,4);put(b+6,found->frames,2);
    sha.update(b,sizeof(b));sha.update(found->sha.data(),32);result.assets[n]={found->action,found->sha};
  }
  sha.finish(result.mapping.data());out=result;return true;
}
} // namespace pet400_transport

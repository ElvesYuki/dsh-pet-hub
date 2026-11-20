#pragma once
#include "control_identity.h"
#include "control_owner.h"
namespace pet400_transport {
struct Credentials { char ssid[33]{},password[64]{}; };
inline void scrub(void *p,size_t bytes) { auto *b=static_cast<volatile uint8_t*>(p);while(bytes--)*b++=0; }
inline bool valid(const Credentials &c) {
  if(!memchr(c.ssid,0,sizeof(c.ssid)) || !memchr(c.password,0,sizeof(c.password)))return false;
  const auto ssid=strlen(c.ssid),pass=strlen(c.password);
  if(!ssid || (pass && (pass<8 || pass>63)))return false;
  for(size_t i=0;i<pass;++i)if(uint8_t(c.password[i])<32 || uint8_t(c.password[i])>126)return false;
  return true;
}
struct LanConfig { Identity identity{};Endpoint endpoint{};Credentials wifi{}; };
class Bootstrap {
public:
  enum class Phase:uint32_t { Empty,WaitingBoot,WaitingModel,Running,Stopping,Stopped,Failed };
private:
  LanConfig inbox_{},active_{};
  std::atomic<uint32_t> ready_{0},stop_{0},status_{0},clean_{0};
  Phase phase_=Phase::Empty;bool consumed_=false,failed_=false,cleanup_done_=false;
  uint32_t seen_stop_=0;uint64_t clock_=0,deadline_=0;
  void phase(Phase p) { phase_=p;status_.store(uint32_t(p),std::memory_order_release); }
  template<class Sys> void fence(Sys &sys) {
    clean_.store(0,std::memory_order_release);scrub(&active_.wifi,sizeof(active_.wifi));sys.disable();phase(Phase::Stopping);
  }
public:
  bool publish(const LanConfig &c) {
    Config binding_test;
    if(stop_.load(std::memory_order_acquire) || !valid(c.wifi) || !c.endpoint.valid() || !binding(c.identity,1,binding_test))return false;
    uint32_t empty=0;if(!ready_.compare_exchange_strong(empty,3,std::memory_order_acq_rel))return false;
    inbox_=c;ready_.store(1,std::memory_order_release);return true;
  }
  void stop() { const auto n=stop_.load(std::memory_order_relaxed);if(n!=UINT32_MAX)stop_.store(n+1,std::memory_order_release); } // Local caller only; manual cleanup retry.
  Phase status() const { return Phase(status_.load(std::memory_order_acquire)); }
  bool cleanup_complete() const { return clean_.load(std::memory_order_acquire)!=0; }
  template<class Sys> void step(uint64_t now,Sys &sys) {
    if(now<clock_ || now>UINT64_MAX-30000) { failed_=true;fence(sys); }clock_=now;
    if(!consumed_ && ready_.load(std::memory_order_acquire)==1) {
      active_=inbox_;scrub(&inbox_.wifi,sizeof(inbox_.wifi));consumed_=true;deadline_=now<=UINT64_MAX-30000?now+30000:UINT64_MAX;
      if(stop_.load(std::memory_order_acquire))fence(sys);else phase(Phase::WaitingBoot);
    }
    const auto request=stop_.load(std::memory_order_acquire);
    if(request!=seen_stop_) { seen_stop_=request;cleanup_done_=false;fence(sys); }
    if(phase_==Phase::Stopping) {
      if(!sys.owner_closed())return; // Never wait synchronously for our own owner loop.
      if(!cleanup_done_) { cleanup_done_=true;const bool ok=sys.cleanup();if(!ok)failed_=true;clean_.store(ok,std::memory_order_release); }
      phase(failed_?Phase::Failed:Phase::Stopped);return;
    }
    if(phase_==Phase::Empty || phase_==Phase::Stopped || phase_==Phase::Failed)return;
    if((phase_==Phase::WaitingBoot || phase_==Phase::WaitingModel) && now>=deadline_) { failed_=true;fence(sys);return; }
    if(phase_==Phase::WaitingBoot) {
      if(!sys.boot())return;
      if(!sys.arm(active_.identity,active_.endpoint)) { failed_=true;fence(sys);return; }
      phase(Phase::WaitingModel);
    }
    if(phase_==Phase::WaitingModel) {
      if(sys.owner_failed()) { failed_=true;fence(sys);return; }
      if(!sys.model_ready())return;
      const bool ok=sys.resources() && sys.start(active_.wifi);
      scrub(&active_.wifi,sizeof(active_.wifi));
      if(!ok || !sys.resources()) { failed_=true;fence(sys);return; }
      phase(Phase::Running);
    }
    if(phase_==Phase::Running && (sys.owner_failed() || !sys.resources() || !sys.poll(now))) { failed_=true;fence(sys); }
  }
};
}

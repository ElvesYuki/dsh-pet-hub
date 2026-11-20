#pragma once
#include "control_transport.h"
#include <optional>

namespace pet400_transport {
struct Endpoint {
  std::array<uint8_t,4> ip{};uint16_t port=0;
  bool valid() const { return port && ip[0] && ip[0]<224; }
};
class Arm {
  Config config_{};Endpoint endpoint_{};std::atomic<uint32_t> ready_{0},stop_{0};
public:
  // Trusted single publisher. Never expose this through a network request.
  bool publish(const Config &config,const Endpoint &endpoint) {
    if(disabled() || !endpoint.valid() || !config.boot || !nonzero(config.mapping.data(),32))return false;
    uint32_t empty=0;if(!ready_.compare_exchange_strong(empty,3,std::memory_order_acq_rel))return false;
    config_=config;endpoint_=endpoint;ready_.store(1,std::memory_order_release);return true;
  }
  bool read(Config &config,Endpoint &endpoint) const {
    if(ready_.load(std::memory_order_acquire)!=1)return false;
    config=config_;endpoint=endpoint_;return true;
  }
  void disable() { stop_.store(1,std::memory_order_release); }
  bool disabled() const { return stop_.load(std::memory_order_acquire)!=0; }
};
class Link {
  // STA callback is the only publisher. Every event changes epoch, including up/up.
  uint32_t epoch_=0;std::atomic<uint32_t> value_{0};
public:
  void publish(bool up) {
    if(epoch_>=0x7ffffffeU) { value_.store(UINT32_MAX,std::memory_order_release);return; }
    value_.store((++epoch_<<1)|uint32_t(up),std::memory_order_release);
  }
  uint32_t value() const { return value_.load(std::memory_order_acquire); }
};
class Owner {
public:
  enum class Halt:uint8_t { None,Clock,Disabled,Worker,Link,Config,Resources,Generation,Close };
  enum class Failure:uint8_t { None,Link,Dial,Connect,ConnectDeadline,Transport };
private:
  Ports &ports_;Arm &arm_;Link &link_;std::optional<Core> core_;
  Config config_{};Endpoint endpoint_{};
  uint64_t clock_=0,deadline_=0,retry_=0,connected_at_=0;
  uint32_t generation_=0,link_value_=0;unsigned failures_=0;
  int fd_=-1;bool configured_=false;Halt halt_=Halt::None;
  Failure failure_=Failure::None;uint32_t attempts_=0;bool close_uncertain_=false;
  void drain() { Event e;for(unsigned i=0;i<16 && ports_.output.pop(e);++i){} }
  template<class Sys> void close(Sys &sys,uint64_t now) {
    if(core_) { core_->eof();core_.reset(); }
    if(fd_>=0) { if(!sys.close(fd_)) { halt_=Halt::Close;close_uncertain_=true; }fd_=-1; }
    const unsigned shift=failures_<5?failures_:5;
    const uint64_t delay=shift<5?100U<<shift:2000U;
    if(failures_<5)++failures_;
    retry_=now<=UINT64_MAX-delay?now+delay:UINT64_MAX;
  }
public:
  Owner(Ports &ports,Arm &arm,Link &link):ports_(ports),arm_(arm),link_(link) {}
  bool connected() const { return bool(core_); }
  bool halted() const { return halt_!=Halt::None; }
  bool io_closed() const { return fd_<0 && !core_ && !close_uncertain_; } // Owner thread only.
  Halt reason() const { return halt_; }
  uint32_t generation() const { return generation_; }
  uint32_t attempts() const { return attempts_; }
  Failure last_failure() const { return failure_; }
  // Exactly one owner calls step. Sys is a nonblocking fd/resource adapter.
  template<class Sys> void step(uint64_t now,Sys &sys) {
    if(now<clock_ || now>UINT64_MAX-15000)halt_=Halt::Clock;
    if(arm_.disabled())halt_=Halt::Disabled;
    if(ports_.revoked_through()==UINT32_MAX)halt_=Halt::Worker;
    clock_=now;
    const auto link=link_.value();
    if(link==UINT32_MAX)halt_=Halt::Link;
    if(link!=link_value_) { if(fd_>=0) { failure_=Failure::Link;close(sys,now); }link_value_=link; }
    if(halted()) { if(fd_>=0)close(sys,now);drain();return; }
    if(!configured_) {
      if(!arm_.read(config_,endpoint_)) { drain();return; }
      if(config_.boot!=ports_.boot() || !ports_.configure(config_)) { halt_=Halt::Config;drain();return; }
      configured_=true;
    }
    if(!(link&1) || !ports_.model_is_ready()) { if(fd_>=0)close(sys,now);drain();return; }
    if(!sys.admit()) { halt_=Halt::Resources;if(fd_>=0)close(sys,now);drain();return; }
    if(fd_<0) {
      drain();if(now<retry_)return;
      if(attempts_!=UINT32_MAX)++attempts_;
      fd_=sys.dial(endpoint_);
      if(fd_<0) { if(fd_<-1) { halt_=Halt::Close;close_uncertain_=true; }fd_=-1;failure_=Failure::Dial;close(sys,now);return; }
      deadline_=now+2000;return;
    }
    if(!core_) {
      drain();if(now>=deadline_) { failure_=Failure::ConnectDeadline;close(sys,now);return; }
      const auto result=sys.connected(fd_);
      if(result<0) { failure_=Failure::Connect;close(sys,now);return; }
      if(!result)return;
      if(generation_==UINT32_MAX-1) { halt_=Halt::Generation;close(sys,now);return; }
      core_.emplace(ports_,++generation_);connected_at_=now;
      if(!core_->start(config_,now)) { failure_=Failure::Transport;close(sys,now);return; }
    }
    if(!core_->step(now,[&](uint8_t *b,size_t n){return sys.read(fd_,b,n);},
                         [&](const uint8_t *b,size_t n){return sys.write(fd_,b,n);})) { failure_=Failure::Transport;close(sys,now);drain();return; }
    if(now-connected_at_>=30000)failures_=0;
  }
};
} // namespace pet400_transport

#pragma once
#include "tcp_control_draft.h"
#include <atomic>
#include <optional>

namespace pet400_control {
using namespace pet400_tcp_draft;
// One producer and one consumer. The object and all atomic words stay internal RAM.
template<class T,size_t N> class Queue {
  static_assert(N && !(N&(N-1)) && N<=65536,"power-of-two bounded SPSC capacity");
  std::array<T,N> slots_{};std::atomic<uint32_t> write_{0},read_{0};
public:
  bool push(const T &v) {
    const auto w=write_.load(std::memory_order_relaxed);
    if(w-read_.load(std::memory_order_acquire)>=N)return false;
    slots_[w%N]=v;write_.store(w+1,std::memory_order_release);return true;
  }
  bool pop(T &v) {
    const auto r=read_.load(std::memory_order_relaxed);
    if(r==write_.load(std::memory_order_acquire))return false;
    v=slots_[r%N];read_.store(r+1,std::memory_order_release);return true;
  }
};
struct Config { uint64_t boot=0;Digest mapping{};std::array<Asset,4> assets{}; };
enum class InputKind:uint8_t { Connect,Record,Disconnect };
struct Input {
  InputKind kind=InputKind::Disconnect;uint32_t transport=0;
  Type type=Type::Ping;uint64_t session=0,seq=0;size_t size=0;std::array<uint8_t,56> payload{};
};
struct Stamp { Target intent{};uint64_t source=0,cycle=0;uint32_t mail=0;uint16_t action=0;uint32_t transport=0; };
inline bool same(const Target &a,const Target &b) {
  return a.origin==b.origin && a.action==b.action && a.token==b.token && a.session==b.session && a.request==b.request;
}
inline bool same(const Stamp &a,const Stamp &b) {
  return same(a.intent,b.intent) && a.source==b.source && a.cycle==b.cycle && a.mail==b.mail && a.action==b.action && a.transport==b.transport;
}
enum class EventKind:uint8_t { Connected,Ack,WholeSha,FrameReady,Presented,IntentInvalidated,Failure,ConfigRejected,ConnectionClosed,Completed };
enum class Reason:uint8_t { None,Replaced,Disconnected,Invalidated,Overflow,Playback };
struct Event {
  EventKind kind=EventKind::Failure;Reason reason=Reason::None;uint32_t transport=0;
  Stamp stamp{};Decision decision{};bool reused_sha=false;
  uint64_t at_ms=0,observed_ms=0;
};
class Ports {
  Config config_{};uint64_t boot_=0;
  std::atomic<uint32_t> ready_{0},config_state_{0},input_close_{0},worker_close_{0},model_ready_{0};
public:
  Queue<Input,8> input;Queue<Event,16> output;
  // Worker once, after valid catalog and boot idle SHA/metadata. No reset in this boot.
  bool announce(uint64_t boot) {
    if(!boot || ready_.load(std::memory_order_relaxed))return false;
    boot_=boot;ready_.store(1,std::memory_order_release);return true;
  }
  uint64_t boot() const { return ready_.load(std::memory_order_acquire)?boot_:0; }
  void model_ready() { model_ready_.store(1,std::memory_order_release); } // Worker only, after Catalog validation.
  bool model_is_ready() const { return model_ready_.load(std::memory_order_acquire)!=0; }
  // Trusted local firmware code ONLY, never decode this from the network.
  bool configure(const Config &c) {
    if(!boot() || c.boot!=boot_)return false;
    uint32_t empty=0;
    if(!config_state_.compare_exchange_strong(empty,3,std::memory_order_acq_rel))return false;
    config_=c;config_state_.store(1,std::memory_order_release);return true;
  }
  bool configuration(Config &c) { // Worker consumes once, no concurrent rewriting.
    if(config_state_.load(std::memory_order_acquire)!=1)return false;
    c=config_;config_state_.store(2,std::memory_order_release);return true;
  }
  bool post(InputKind kind,uint32_t transport,const Record *r=nullptr) {
    if(!transport)return false;
    if(kind!=InputKind::Connect && kind!=InputKind::Record && kind!=InputKind::Disconnect) { input_revoke(transport);return false; }
    Input v;v.kind=kind;v.transport=transport;
    if(kind==InputKind::Record) {
      if(!r || r->size>v.payload.size() || r->size!=payload_size(r->type) || (r->size && !r->payload) ||
         (r->type!=Type::Open && r->type!=Type::Base && r->type!=Type::Cancel && r->type!=Type::Ping)) { input_revoke(transport);return false; }
      v.type=r->type;v.session=r->session;v.seq=r->seq;v.size=r->size;
      if(v.size)memcpy(v.payload.data(),r->payload,v.size);
    }
    if(input.push(v))return true;
    input_revoke(transport);return false;
  }
  void input_revoke(uint32_t gen) { // Single transport producer; monotonic, no CAS loop.
    if(gen>input_close_.load(std::memory_order_relaxed))input_close_.store(gen,std::memory_order_release);
  }
  void worker_revoke(uint32_t gen) { // Single worker producer.
    if(gen>worker_close_.load(std::memory_order_relaxed))worker_close_.store(gen,std::memory_order_release);
  }
  uint32_t revoked_through() const {
    const auto a=input_close_.load(std::memory_order_acquire),b=worker_close_.load(std::memory_order_acquire);return a>b?a:b;
  }
};
class Bridge {
  Ports &ports_;std::optional<Control> model_;Config config_{};
  uint32_t transport_=0,transport_high_=0;uint64_t connection_=0,cycle_=0,reported_=0,sha_reported_=0,decoded_reported_=0;
  uint64_t terminal_token_=0,completed_cycle_=0,decoded_at_=0,reported_request_=0,drawn_cycle_=0;
  Target applied_{};bool applied_valid_=false,file_sha_=false,decoded_=false;
  Stamp stamp_{};
  bool emit(Event event,uint64_t now) {
    // Old playback telemetry must not revoke a newer transport when its queue is full.
    if(event.transport && transport_ && event.transport!=transport_ && event.kind!=EventKind::ConnectionClosed)return true;
    event.observed_ms=now;if(!event.at_ms)event.at_ms=now;
    if(ports_.output.push(event))return true;
    if(event.transport==transport_ && transport_)revoke(now);
    else ports_.worker_revoke(event.transport);
    // A disconnected observer cannot prevent local touch from completing.
    const bool touch_telemetry=event.stamp.intent.origin==Origin::Touch &&
      (event.kind==EventKind::WholeSha || event.kind==EventKind::FrameReady || event.kind==EventKind::Completed || event.kind==EventKind::Failure || event.kind==EventKind::IntentInvalidated);
    return touch_telemetry;
  }
  void revoke(uint64_t now) {
    if(transport_)ports_.worker_revoke(transport_);
    if(model_ && connection_)model_->disconnect(connection_,now);
    transport_=0;connection_=0;
  }
  const Asset *asset(uint16_t action) const { for(const auto &a:config_.assets)if(a.action==action)return &a;return nullptr; }
  Event event(EventKind kind) const { Event e;e.kind=kind;e.transport=stamp_.transport;e.stamp=stamp_;return e; }
public:
  explicit Bridge(Ports &ports):ports_(ports) {}
  bool active() const { return model_.has_value(); }
  bool configure(const Config &config,const std::array<Asset,4> &actual,uint64_t now) {
    if(active() || !config.boot || config.boot!=ports_.boot() || !nonzero(config.mapping.data(),32))return false;
    for(size_t i=0;i<actual.size();++i) {
      const auto &a=actual[i];for(size_t j=0;j<i;++j)if(actual[j].action==a.action)return false;
      unsigned matches=0;
      for(const auto &b:config.assets)matches+=a.action==b.action && a.sha==b.sha;
      if(matches!=1)return false;
    }
    // Control independently validates allowed unique 0/1/4/11 and nonzero SHA.
    Control check(config.boot,config.mapping,config.assets);if(!check.connect(now))return false;
    config_=config;model_.emplace(config.boot,config.mapping,config.assets);ports_.model_ready();return true;
  }
  void pump(uint64_t now) {
    if(!active())return;
    if(transport_ && ports_.revoked_through()>=transport_)revoke(now);
    Input in;
    for(unsigned n=0;n<8 && ports_.input.pop(in);++n) {
      if(in.kind==InputKind::Connect) {
        if(in.transport<=transport_high_)continue;
        transport_high_=in.transport;revoke(now);
        if(ports_.revoked_through()>=in.transport)continue;
        connection_=model_->connect(now);if(!connection_) { ports_.worker_revoke(in.transport);continue; }
        transport_=in.transport;auto e=event(EventKind::Connected);e.transport=transport_;emit(e,now);
      } else if(in.transport==transport_ && transport_) {
        if(in.kind==InputKind::Disconnect) {
          Event e;e.kind=EventKind::ConnectionClosed;e.transport=transport_;e.reason=Reason::Disconnected;revoke(now);emit(e,now);
        } else {
          const auto d=model_->receive({in.type,in.session,in.seq,in.payload.data(),in.size},connection_,now);
          Event e;e.kind=EventKind::Ack;e.transport=transport_;e.decision=d;
          e.stamp.intent={Origin::Remote,d.action,in.session,in.seq,d.token};emit(e,now);
        }
      }
    }
    model_->desired(now);
    if(transport_ && !model_->connected()) { Event e;e.kind=EventKind::ConnectionClosed;e.transport=transport_;e.reason=Reason::Invalidated;revoke(now);emit(e,now); }
  }
  Target target(uint64_t now) { return active()?model_->desired(now):Target{}; }
  bool needs_start(uint64_t now) {
    const auto desired=target(now);
    return active() && (applied_valid_?!same(applied_,desired):desired.origin!=Origin::Local);
  }
  void touch(uint64_t now) { if(active())model_->touch(now); }
  Stamp begin(Target intent,uint16_t action,uint64_t now) {
    if(!active() || !same(intent,target(now)) || (intent.origin!=Origin::Local && intent.action!=action) || cycle_==UINT64_MAX)return {};
    if(applied_valid_ && !same(applied_,intent) && stamp_.intent.origin!=Origin::Local && terminal_token_!=stamp_.intent.token) {
      auto e=event(EventKind::IntentInvalidated);e.reason=Reason::Replaced;terminal_token_=stamp_.intent.token;emit(e,now);
    }
    // Emitting IntentInvalidated can itself revoke remote on output overflow.
    if(!same(intent,target(now)))return {};
    if(intent.origin==Origin::Remote && !model_->begin_cycle(intent.token,now))return {};
    applied_=intent;applied_valid_=true;file_sha_=decoded_=false;
    stamp_={intent,0,++cycle_,0,action,transport_};return stamp_;
  }
  const Stamp &stamp() const { return stamp_; }
  bool current(const Stamp &s,uint64_t now) {
    return active() && s.cycle && same(s,stamp_) && same(s.intent,target(now));
  }
  bool verified(const Stamp &s,const Digest &sha,bool reused,uint64_t now) {
    if(!current(s,now))return false;
    const auto *a=asset(s.action);if(!a || a->sha!=sha)return false;
    file_sha_=true;
    if(s.intent.origin!=Origin::Local && sha_reported_!=s.intent.token) {
      auto e=event(EventKind::WholeSha);e.reused_sha=reused;if(!emit(e,now))return false;sha_reported_=s.intent.token;
    }
    return true;
  }
  Stamp bind(const Stamp &s,uint64_t source,uint32_t mail,uint64_t now) {
    if(!current(s,now) || !file_sha_ || !source || s.source)return {};
    stamp_.source=source;stamp_.mail=mail;return stamp_;
  }
  bool decoded(const Stamp &s,uint32_t frame,bool valid,uint64_t now) {
    if(!current(s,now) || !file_sha_ || !s.source || frame || !valid)return false;
    if(decoded_)return false;
    if(s.intent.origin==Origin::Remote) {
      const auto *a=asset(s.action);if(!a || !model_->prepare(s.intent.token,s.source,a->sha,now))return false;
    }
    decoded_=true;decoded_at_=now;
    if(s.intent.origin!=Origin::Local && decoded_reported_!=s.intent.token) {
      if(!emit(event(EventKind::FrameReady),now))return false;
      decoded_reported_=s.intent.token;
    }
    return true;
  }
  bool presented(const Stamp &s,uint64_t frame,bool draw_current,uint64_t now,uint64_t draw_at=UINT64_MAX) {
    if(draw_at==UINT64_MAX)draw_at=now;
    if(draw_at>now || draw_at<decoded_at_)return false;
    if(!current(s,now) || !file_sha_ || !decoded_ || !draw_current || frame || !s.source || s.intent.origin!=Origin::Remote || drawn_cycle_==s.cycle)return false;
    // A valid frame0 draw callback is consumed once even when it cannot prove a
    // newer command. Never reuse this cycle's old draw after another renewal.
    drawn_cycle_=s.cycle;
    const auto request=model_->request(s.intent.token,now);
    if(!request || (reported_==s.intent.token && reported_request_==request) ||
       !model_->presented(s.intent.token,s.source,0,now,draw_at))return false;
    auto e=event(EventKind::Presented);e.at_ms=draw_at;e.stamp.intent.request=request;
    if(!emit(e,now))return false;
    reported_=s.intent.token;reported_request_=request;return true;
  }
  bool eof(const Stamp &s,bool complete_source_and_last_ack,uint64_t now) {
    if(!current(s,now) || !s.source || !file_sha_ || !decoded_ || !complete_source_and_last_ack)return false;
    if(completed_cycle_==s.cycle)return false;
    completed_cycle_=s.cycle;emit(event(EventKind::Completed),now);
    if(s.intent.origin==Origin::Touch) { terminal_token_=s.intent.token;return model_->touch_done(s.intent.token,now); }
    return true; // Remote loops under the same intent, new source/cycle on begin.
  }
  void failed(const Stamp &s,uint64_t now) {
    if(!current(s,now))return;
    terminal_token_=s.intent.token;
    auto e=event(EventKind::Failure);e.reason=Reason::Playback;emit(e,now);
    model_->abort_target(s.intent.token,now);
  }
};
// Public firmware port; only defined/allocated in the explicit adapter candidate.
Ports &firmware_ports();
} // namespace pet400_control

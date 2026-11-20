#pragma once
#include "control_bridge.h"
namespace pet400_transport {
using namespace pet400_control;
// A single socket owner calls step. Reader/writer: positive progress, 0 would-block,
// negative terminal failure. Neither callback may block. Caller closes socket on false.
class Core {
  Ports &ports_;Parser parser_;TxCursor tx_;uint32_t generation_;
  uint64_t session_=0,deadline_=0,clock_=0,handshake_end_=0,last_rx_=0;bool started_=false,closed_=false,open_=false;
  bool close() {
    if(!closed_) { closed_=true;ports_.post(InputKind::Disconnect,generation_);ports_.input_revoke(generation_);tx_.disconnect(); }
    return false;
  }
  bool queue(const Record &r,uint64_t now) {
    if(now>UINT64_MAX-2000 || !tx_.start(r))return close();
    deadline_=now+2000;return true;
  }
public:
  explicit Core(Ports &p,uint32_t generation):ports_(p),generation_(generation) {}
  bool start(const Config &trusted,uint64_t now) {
    if(started_ || closed_ || !generation_ || !trusted.boot || trusted.boot!=ports_.boot() || !nonzero(trusted.mapping.data(),32))return close();
    if(now>UINT64_MAX-15000)return close();
    started_=true;clock_=last_rx_=now;handshake_end_=now+5000;
    if(!ports_.post(InputKind::Connect,generation_))return close();
    std::array<uint8_t,56> body{};put(body.data(),trusted.boot,8);memcpy(body.data()+8,trusted.mapping.data(),32);
    put(body.data()+40,400,2);put(body.data()+42,400,2);put(body.data()+44,24,2);put(body.data()+46,4,2);put(body.data()+48,10000,4);put(body.data()+52,256,4);
    return queue({Type::Hello,0,1,body.data(),body.size()},now);
  }
  bool eof() { parser_.eof();return close(); }
  bool closed() const { return closed_; }
  template<class Read,class Write> bool step(uint64_t now,Read read,Write write) {
    if(closed_ || !started_)return false;
    if(now<clock_ || ports_.revoked_through()>=generation_)return close();
    clock_=now;
    if((!open_ && now>=handshake_end_) || (open_ && now-last_rx_>=15000))return close();
    uint8_t incoming[256];const int n=read(incoming,sizeof(incoming));
    if(n<0 || size_t(n)>sizeof(incoming))return close();
    if(n && !parser_.feed(incoming,size_t(n),[&](const Record &r) {
      if(!session_) { if(r.type!=Type::Open)return false;session_=r.session; }
      if(r.session!=session_ || !ports_.post(InputKind::Record,generation_,&r))return false;
      last_rx_=now;return true;
    }))return close();
    if(!tx_.remaining()) {
      Event e;
      for(unsigned i=0;i<16 && ports_.output.pop(e);++i) {
        if(e.transport!=generation_)continue;
        if(e.kind==EventKind::ConnectionClosed || e.kind==EventKind::ConfigRejected || e.kind==EventKind::Failure)return close();
        if(e.kind==EventKind::Ack) {
          if(e.decision.code==Code::Opened)open_=true;
          auto body=ack_payload(e.decision);
          if(e.stamp.intent.session!=session_ || !queue({Type::Ack,session_,e.stamp.intent.request,body.data(),body.size()},now))return close();
          break;
        }
        if(e.kind==EventKind::Presented) {
          if(e.stamp.intent.origin!=Origin::Remote || !e.stamp.source || !e.stamp.intent.token || e.stamp.intent.session!=session_)return close();
          std::array<uint8_t,24> body{};put(body.data(),e.stamp.intent.token,8);put(body.data()+8,e.stamp.source,8);put(body.data()+20,e.stamp.action,2);
          if(!queue({Type::Presented,session_,e.stamp.intent.request,body.data(),body.size()},now))return close();
          break;
        }
        // v0 only: no invented VERIFIED/STATE/EXIT reports, no current-display claim.
      }
    }
    if(tx_.remaining()) {
      if(now>=deadline_)return close();
      const auto left=tx_.remaining();const int wrote=write(tx_.data(),left);
      if(wrote<0 || size_t(wrote)>left || !tx_.advance(size_t(wrote)))return close();
    }
    return true;
  }
};
} // namespace pet400_transport

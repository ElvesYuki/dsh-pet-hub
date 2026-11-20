#pragma once
// Offline, single-owner draft. Not connected to sockets, app_main or View.
#include <array>
#include <cstdint>
#include <cstddef>
#include <cstring>
#include <limits>

namespace pet400_tcp_draft {
using Digest=std::array<uint8_t,32>;
constexpr size_t header_bytes=32,max_payload=256,record_bytes=header_bytes+max_payload;
inline uint16_t u16(const uint8_t *p) { return uint16_t(p[0])|(uint16_t(p[1])<<8); }
inline uint32_t u32(const uint8_t *p) { return uint32_t(u16(p))|(uint32_t(u16(p+2))<<16); }
inline uint64_t u64(const uint8_t *p) { return uint64_t(u32(p))|(uint64_t(u32(p+4))<<32); }
inline void put(uint8_t *p,uint64_t v,size_t n) { for(size_t i=0;i<n;++i)p[i]=uint8_t(v>>(8*i)); }
inline bool nonzero(const uint8_t *p,size_t n) { for(size_t i=0;i<n;++i)if(p[i])return true;return false; }
inline uint32_t crc_update(uint32_t c,const uint8_t *p,size_t n) {
  for(size_t i=0;i<n;++i) { c^=p[i];for(unsigned b=0;b<8;++b)c=(c>>1)^(0xedb88320u&uint32_t(-int32_t(c&1))); }
  return c;
}
enum class Type:uint8_t { Open=1,Base=2,Cancel=3,Ping=4,Hello=128,Ack=129,Presented=130 };
inline size_t payload_size(Type t) {
  switch(t) { case Type::Open:return 56;case Type::Base:return 40;
    case Type::Cancel:case Type::Ping:return 0;case Type::Hello:return 56;case Type::Ack:return 16;case Type::Presented:return 24; }
  return max_payload+1;
}
struct Record { Type type{};uint64_t session=0,seq=0;const uint8_t *payload=nullptr;size_t size=0; };
struct Packet { std::array<uint8_t,record_bytes> bytes{};size_t size=0; };
inline bool encode(const Record &r,Packet &out) {
  out.size=0;
  if((r.type==Type::Hello)!=(r.session==0) || !r.seq || (r.type==Type::Hello && r.seq!=1) || r.size!=payload_size(r.type) || r.size>max_payload || (r.size && !r.payload))return false;
  auto *p=out.bytes.data();
  if(r.size)memmove(p+header_bytes,r.payload,r.size);
  memcpy(p,"PTC1",4);p[4]=1;p[5]=uint8_t(r.type);p[6]=p[7]=0;
  put(p+8,r.size,4);put(p+12,r.session,8);put(p+20,r.seq,8);
  put(p+28,~crc_update(crc_update(0xffffffffu,p,28),p+header_bytes,r.size),4);
  out.size=header_bytes+r.size;return true;
}
class Parser {
  Packet packet_{};size_t expected_=header_bytes;bool failed_=false;
public:
  // Callback payload is borrowed until callback returns; no queue is allocated.
  template<class Consume> bool feed(const uint8_t *data,size_t size,Consume consume) {
    if(failed_ || (size && !data)) { failed_=true;return false; }
    for(size_t i=0;i<size;++i) {
      packet_.bytes[packet_.size++]=data[i];
      if(packet_.size==header_bytes) {
        const auto *p=packet_.bytes.data();const size_t n=u32(p+8);
        if(memcmp(p,"PTC1",4) || p[4]!=1 || p[6] || p[7] || n>max_payload ||
           n!=payload_size(Type(p[5])) || (Type(p[5])==Type::Hello)!=(u64(p+12)==0) || !u64(p+20) ||
           (Type(p[5])==Type::Hello && u64(p+20)!=1)) { failed_=true;return false; }
        expected_=header_bytes+n;
      }
      if(packet_.size==expected_) {
        const auto *p=packet_.bytes.data();const size_t n=expected_-header_bytes;
        if(u32(p+28)!=~crc_update(crc_update(0xffffffffu,p,28),p+header_bytes,n) ||
           !consume(Record{Type(p[5]),u64(p+12),u64(p+20),p+header_bytes,n})) { failed_=true;return false; }
        packet_.size=0;expected_=header_bytes;
      }
    }
    return true;
  }
  bool eof() { if(packet_.size)failed_=true;return !failed_; }
  bool failed() const { return failed_; }
};
class TxCursor {
  Packet packet_{};size_t offset_=0;
public:
  bool start(const Record &r) { if(remaining())return false;offset_=0;return encode(r,packet_); }
  const uint8_t *data() const { return packet_.bytes.data()+offset_; }
  size_t remaining() const { return packet_.size-offset_; }
  bool advance(size_t written) { if(written>remaining())return false;offset_+=written;return true; }
  void disconnect() { packet_.size=offset_=0; }
};

struct Asset { uint16_t action=0;Digest sha{}; };
enum class Origin:uint8_t { Local,Remote,Touch };
struct Target { Origin origin=Origin::Local;uint16_t action=0;uint64_t session=0,request=0,token=0; };
enum class Code:uint16_t { Opened=1,Accepted=2,Deferred=3,Cancelled=4,Pong=5,
  Session=16,Sequence=17,Conflict=18,Identity=19,Invalid=20 };
struct Decision { Code code=Code::Invalid;bool replay=false;uint16_t action=0xffff;uint64_t token=0; };
inline std::array<uint8_t,16> ack_payload(const Decision &d) {
  std::array<uint8_t,16> out{};put(out.data(),uint16_t(d.code),2);put(out.data()+2,d.action,2);put(out.data()+8,d.token,8);return out;
}
class Control {
  static constexpr uint64_t lease_ms=10000,max_ttl_ms=60000;
  uint64_t boot_,session_=0,last_seq_=0,lease_end_=0,base_end_=0,clock_=0,token_=0,connection_=0;
  Digest mapping_;std::array<Asset,4> assets_;
  bool connected_=false,touch_=false,base_=false,clock_ok_=true,prepared_=false;
  uint64_t request_at_=0,presented_request_=0;
  uint16_t action_=0;uint64_t request_=0,source_=0;
  Target target_{};Packet last_{};Decision last_decision_{};
  const Asset *find(uint16_t action) const { for(const auto &a:assets_)if(a.action==action)return &a;return nullptr; }
  bool config_ok() const {
    if(!boot_ || !nonzero(mapping_.data(),mapping_.size()))return false;
    for(size_t i=0;i<assets_.size();++i) {
      if((assets_[i].action!=0 && assets_[i].action!=1 && assets_[i].action!=4 && assets_[i].action!=11) ||
         !nonzero(assets_[i].sha.data(),32))return false;
      for(size_t j=0;j<i;++j)if(assets_[i].action==assets_[j].action)return false;
    }
    return true;
  }
  void refresh() {
    Target next{};
    if(touch_) { next.origin=Origin::Touch;next.action=4; }
    else if(base_) { next.origin=Origin::Remote;next.action=action_;next.session=session_;next.request=request_; }
    // request_ correlates commands; Target.request identifies this playback's start.
    // A valid same-asset BASE extends its lease without replacing the playback.
    if(next.origin==Origin::Remote && target_.origin==Origin::Remote &&
       next.action==target_.action && next.session==target_.session)next.request=target_.request;
    if(next.origin!=target_.origin || next.action!=target_.action || next.session!=target_.session || next.request!=target_.request) {
      // Exhaustion is fatal for this object; never reuse an intent token.
      if(token_==std::numeric_limits<uint64_t>::max()) { clock_ok_=false;connected_=base_=touch_=false;target_={};prepared_=false;presented_request_=0;return; }
      next.token=++token_;target_=next;prepared_=false;presented_request_=0;source_=0;
    }
  }
  bool tick(uint64_t now) {
    if(!clock_ok_ || now<clock_) { clock_ok_=false;connected_=base_=touch_=false;refresh();return false; }
    clock_=now;
    if(session_ && now>=lease_end_) { session_=0;connected_=base_=false; }
    if(base_ && now>=base_end_)base_=false;
    refresh();return true;
  }
  static bool deadline(uint64_t now,uint64_t delta,uint64_t &out) {
    if(now>std::numeric_limits<uint64_t>::max()-delta)return false;
    out=now+delta;return true;
  }
  void clear_connection(uint64_t now) {
    tick(now);connected_=base_=false;session_=last_seq_=0;last_.size=0;refresh();
  }
public:
  Control(uint64_t boot,Digest mapping,std::array<Asset,4> assets):boot_(boot),mapping_(mapping),assets_(assets) {}
  uint64_t connect(uint64_t now) {
    clear_connection(now);
    if(!clock_ok_ || !config_ok() || connection_==std::numeric_limits<uint64_t>::max())return 0;
    connected_=true;return ++connection_;
  }
  bool disconnect(uint64_t connection,uint64_t now) {
    if(!connected_ || connection!=connection_)return false;
    clear_connection(now);return true;
  }
  bool connected() const { return connected_; }
  Target desired(uint64_t now) { tick(now);return target_; }
  void touch(uint64_t now) { if(tick(now)) { touch_=true;refresh(); } }
  bool touch_done(uint64_t token,uint64_t now) {
    if(!touch_ || target_.origin!=Origin::Touch || target_.token!=token)return false;
    if(!tick(now))return false;
    touch_=false;refresh();return true;
  }
  bool abort_target(uint64_t token,uint64_t now) {
    if(target_.token!=token || target_.origin==Origin::Local)return false;
    if(!tick(now) || target_.token!=token || target_.origin==Origin::Local)return false;
    if(target_.origin==Origin::Touch)touch_=false;else base_=false;
    refresh();return true;
  }
  Decision receive(const Record &r,uint64_t connection,uint64_t now) {
    Packet encoded;
    if(!connected_ || connection!=connection_ || !tick(now) || !connected_ || !encode(r,encoded) ||
       (r.type!=Type::Open && r.type!=Type::Base && r.type!=Type::Cancel && r.type!=Type::Ping))return {Code::Invalid,false};
    if(last_seq_ && r.session==session_ && r.seq==last_seq_) {
      if(encoded.size!=last_.size || memcmp(encoded.bytes.data(),last_.bytes.data(),encoded.size))return {Code::Conflict,false};
      auto replay=last_decision_;replay.replay=true;return replay; // No deadline renewal.
    }
    if(r.type==Type::Open) {
      if(session_ || r.seq!=1 || u64(r.payload)!=boot_ || memcmp(r.payload+8,mapping_.data(),32) || !nonzero(r.payload+40,16))return {Code::Session,false};
      if(!deadline(now,lease_ms,lease_end_))return {Code::Invalid,false};
      session_=r.session;last_seq_=1;last_=encoded;last_decision_={Code::Opened,false};return last_decision_;
    }
    if(!session_ || r.session!=session_)return {Code::Session,false};
    if(last_seq_==std::numeric_limits<uint64_t>::max() || r.seq!=last_seq_+1)return {Code::Sequence,false};
    last_seq_=r.seq;last_=encoded;last_decision_={Code::Invalid,false};
    if(r.type==Type::Base) {
      const auto *a=find(u16(r.payload));const auto ttl=u32(r.payload+4);uint64_t end=0;
      if(u16(r.payload+2) || !ttl || ttl>max_ttl_ms || !deadline(now,ttl,end))last_decision_.code=Code::Invalid;
      else if(!a || a->action==4 || memcmp(r.payload+8,a->sha.data(),32))last_decision_.code=Code::Identity;
      else { base_=true;action_=a->action;request_=r.seq;request_at_=now;base_end_=end;refresh();last_decision_={touch_?Code::Deferred:Code::Accepted,false,action_,touch_?0:target_.token}; }
    } else if(r.type==Type::Cancel) { base_=false;refresh();last_decision_.code=Code::Cancelled; }
    else {
      if(!deadline(now,lease_ms,lease_end_))last_decision_.code=Code::Invalid;
      else last_decision_.code=Code::Pong;
    }
    return last_decision_;
  }
  // Current command correlation is separate from the stable playback stamp.
  uint64_t request(uint64_t token,uint64_t now) {
    if(target_.origin!=Origin::Remote || target_.token!=token || !tick(now) ||
       target_.origin!=Origin::Remote || target_.token!=token)return 0;
    return request_;
  }
  // Worker begins a real source cycle, including natural loops. This does not
  // erase the last command's receipt or change playback identity/lease.
  bool begin_cycle(uint64_t token,uint64_t now) {
    if(!request(token,now))return false;
    prepared_=false;source_=0;return true;
  }
  // Future adapter calls only after actual full-file SHA, metadata and frame0 CRC
  // succeeded. The network cannot submit this proof. This is not whole-media decoding.
  bool prepare(uint64_t token,uint64_t source,const Digest &verified_sha,uint64_t now) {
    if(target_.origin!=Origin::Remote || target_.token!=token || !source || prepared_ || !tick(now) || target_.origin!=Origin::Remote || target_.token!=token)return false;
    const auto *a=find(target_.action);if(!a || a->sha!=verified_sha)return false;
    prepared_=true;source_=source;return true;
  }
  // Future View/worker adapter calls only after matching draw ACK, never reception.
  bool presented(uint64_t token,uint64_t source,uint32_t frame,uint64_t now,uint64_t draw_at=UINT64_MAX) {
    if(draw_at==UINT64_MAX)draw_at=now;
    if(target_.origin!=Origin::Remote || target_.token!=token || !prepared_ || presented_request_==request_ ||
       source_!=source || frame!=0 || draw_at>now || draw_at<request_at_ ||
       (request_!=target_.request && draw_at<=request_at_) ||
       !tick(now) || target_.origin!=Origin::Remote || target_.token!=token)return false;
    presented_request_=request_;return true;
  }
};
} // namespace pet400_tcp_draft

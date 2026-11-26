#include "playback_control_policy.h"

#include <cassert>
#include <vector>

using namespace vp8_control;

namespace {
Frame frame(Kind kind, Ticket ticket, uint32_t value = 0) {
  Frame packet{};
  assert(encode({kind, ticket, value}, packet));
  return packet;
}

void reply(Control &model, Kind kind, Ticket ticket, uint32_t value = 0) {
  const Message expected{kind, ticket, value};
  assert(model.pop() == expected);
}
} // namespace

int main() {
  const Ticket wave{1, 1, 0, 4}, happy{1, 2, 0, 57}, ping{1, 3, 0, 0};
  const auto wave_frame = frame(Kind::play, wave, 500);
  const Frame golden{'V','P','C','1',1,1,0,0,1,0,0,0,1,0,0,0,0,0,4,0,0xf4,1,0,0};
  assert(wave_frame == golden);
  assert(!decode(Frame{}));
  Frame out{};
  assert(!encode({Kind::play, wave, 0}, out));
  assert(!encode({Kind::play, wave, maximum_ttl_ms + 1}, out));
  assert(!encode({Kind::play, {1,1,65535,0}, 10}, out));
  assert(!encode({Kind::presented, wave, 0}, out));
  assert(!encode({Kind::ping, wave, 0}, out));
  assert(!encode({Kind(99), wave, 0}, out));

  for (size_t split = 1; split < wave_frame.size(); ++split) {
    Control model;
    assert(!model.receive(wave_frame, 0));
    assert(model.begin_verified(1, 1));
    assert(model.receive(std::span{wave_frame}.first(split), 2) && !model.pop());
    assert(model.receive(std::span{wave_frame}.subspan(split), 3));
    reply(model, Kind::accepted, wave);
    assert(!model.claim(4, true) && !model.pop());
    assert(model.claim(5, false) == wave);
    assert(!model.presented(happy, 5, 100) && !model.pop());
    assert(model.presented(wave, 6, 17));
    reply(model, Kind::presented, wave, 17);
    assert(!model.presented(wave, 7, 18) && !model.pop());
  }

  Control model;
  assert(model.begin_verified(1, 0));
  assert(!model.begin_verified(1, 1) && model.connected());
  assert(model.receive(wave_frame, 1));
  reply(model, Kind::accepted, wave);
  assert(model.claim(2, false) == wave);
  const auto next = frame(Kind::play, happy, 50);
  const auto keepalive = frame(Kind::ping, ping);
  std::vector<uint8_t> batch(next.begin(), next.end());
  batch.insert(batch.end(), keepalive.begin(), keepalive.end());
  assert(model.receive(batch, 3));
  reply(model, Kind::superseded, wave);
  reply(model, Kind::accepted, happy);
  reply(model, Kind::pong, ping);
  assert(!model.owns(wave) && !model.presented(wave, 4, 99));
  assert(model.receive(keepalive, 5));
  reply(model, Kind::duplicate, ping);
  assert(!model.claim(10, true));
  assert(model.claim(40, false) == happy && model.owns(happy));
  assert(!model.presented(happy, 53, 20));
  reply(model, Kind::expired, happy);
  assert(!model.pop());
  const Ticket missing{1, 4, 0, 900};
  assert(model.receive(frame(Kind::play, missing, 100), 60));
  reply(model, Kind::accepted, missing);
  assert(model.claim(61, false) == missing && model.missing(missing, 62));
  reply(model, Kind::missing, missing);
  const Ticket interrupted{1,5,0,67};
  assert(model.receive(frame(Kind::play, interrupted, 100), 63));
  reply(model, Kind::accepted, interrupted);
  assert(model.claim(64, false) == interrupted && model.cancel(interrupted, 65));
  reply(model, Kind::cancelled, interrupted);
  assert(!model.presented(interrupted, 66, 21));
  const Ticket pending{1,6,0,56};
  assert(model.receive(frame(Kind::play, pending, 100), 67));
  reply(model, Kind::accepted, pending);
  assert(!model.claim(167, false));
  reply(model, Kind::expired, pending);

  // Restarting the transport resets the request numbering and discards all old work.
  const Ticket old{1,7,0,4}, fresh{2,1,0,4};
  assert(model.receive(frame(Kind::play, old, 500), 168));
  assert(model.claim(169, false) == old);
  model.close();
  assert(!model.owns(old) && !model.pop() && !model.connected() && !model.begin_verified(1, 170));
  assert(model.begin_verified(2, 170));
  assert(model.receive(frame(Kind::play, fresh, 500), 171));
  reply(model, Kind::accepted, fresh);
  assert(model.claim(172, false) == fresh);
  assert(!model.presented(old, 173, 33) && model.presented(fresh, 174, 22));
  reply(model, Kind::presented, fresh, 22);
  const Ticket seek{2,2,0,4};
  assert(model.receive(frame(Kind::play, seek, 500), 175));
  reply(model, Kind::accepted, seek);
  assert(model.claim(176, false) == seek);
  assert(!model.presented(seek, 177, 22) && model.presented(seek, 178, 23));
  reply(model, Kind::presented, seek, 23);
  assert(!model.receive(wave_frame, 179) && !model.connected());

  Control malformed;
  assert(malformed.begin_verified(1, 0));
  auto broken = wave_frame;
  broken[6] = 1;
  assert(!malformed.receive(broken, 1) && !malformed.connected());
  assert(malformed.begin_verified(2, 2));
  const auto exact = frame(Kind::play, {2,1,0,4}, 500);
  assert(malformed.receive(exact, 3) && malformed.receive(exact, 4));
  assert(!malformed.receive(frame(Kind::play, {2,1,0,11}, 500), 5) && !malformed.pop());
  assert(malformed.begin_verified(3, 6));
  assert(malformed.receive(frame(Kind::ping, {3,2,0,0}), 7));
  assert(!malformed.receive(frame(Kind::ping, {3,1,0,0}), 8));
  assert(malformed.begin_verified(4, 9));
  assert(!malformed.receive(frame(Kind::accepted, {4,1,0,4}), 10));

  // Duplicate heartbeat traffic cannot extend the current lease.
  Control lease;
  assert(lease.begin_verified(1, 0));
  const auto hb = frame(Kind::ping, {1,1,0,0});
  assert(lease.receive(hb, 100) && lease.receive(hb, 15099));
  assert(!lease.tick(15100) && !lease.pop());
  assert(!lease.begin_verified(2, 15099) && lease.begin_verified(2, 15100));
  assert(!lease.tick(15099));
  assert(lease.begin_verified(3, 15100));
  for (uint32_t seq = 1; seq <= 8; ++seq) assert(lease.receive(frame(Kind::ping, {3,seq,0,0}), 15101));
  assert(!lease.receive(frame(Kind::ping, {3,9,0,0}), 15102) && !lease.pop());

  Playback playback;
  auto &session = playback.control();
  assert(session.begin_verified(1, 10));
  assert(session.receive(wave_frame, 11));
  reply(session, Kind::accepted, wave);
  assert(!playback.claim(12, true));
  assert(playback.claim(13, false) == wave);
  assert(playback.can_submit(wave, 14) && !session.pop());
  assert(playback.should_yield(15, true, false));
  playback.finish(16);
  reply(session, Kind::cancelled, wave);
  assert(!playback.first_dma(wave, 17));

  assert(session.receive(next, 20));
  reply(session, Kind::accepted, happy);
  assert(playback.claim(21, false) == happy);
  assert(playback.first_dma(happy, 22) && !playback.first_dma(happy, 22));
  reply(session, Kind::presented, happy, 1);
  assert(!playback.should_yield(23, true, false));
  const Ticket replacement{1,3,0,4};
  assert(session.receive(frame(Kind::play, replacement, 100), 24));
  reply(session, Kind::accepted, replacement);
  assert(playback.should_yield(25, false, false));
  playback.finish(26);
  assert(playback.claim(27, false) == replacement);
  session.close();
  assert(!playback.first_dma(replacement, 28) && playback.should_yield(28, false, false));
  assert(session.begin_verified(2, 29));
  playback.finish(30);
  assert(!session.pop());
  const Ticket new_wave{2,1,0,4};
  assert(session.receive(frame(Kind::play, new_wave, 100), 31));
  reply(session, Kind::accepted, new_wave);
  assert(playback.claim(32, false) == new_wave);
  playback.finish(33, true);
  reply(session, Kind::missing, new_wave);

  // Automatic idle can yield before EOF. Explicit local playback and contact retain priority.
  Playback background;
  auto &remote = background.control();
  const Ticket work{1, 1, 0, 2};
  assert(remote.begin_verified(1, 0));
  assert(remote.receive(frame(Kind::play, work, 1500), 100));
  reply(remote, Kind::accepted, work);
  assert(!background.should_yield(200, false, false));
  assert(!background.should_yield(300, true, true));
  assert(background.should_yield(400, false, true));
  assert(background.claim(401, false) == work);
  assert(!background.should_yield(402, false, true) && !remote.pop());
  assert(background.first_dma(work, 500));
  reply(remote, Kind::presented, work, 1);
  background.finish(501);
  assert(!background.should_yield(502, false, true));

  const Ticket blocked{1, 2, 0, 2};
  assert(remote.receive(frame(Kind::play, blocked, 1500), 600));
  reply(remote, Kind::accepted, blocked);
  assert(!background.should_yield(2099, false, false));
  assert(!background.should_yield(2100, false, true));
  reply(remote, Kind::expired, blocked);
  assert(!background.claim(2101, false));

  const Ticket lost{1, 3, 0, 2};
  assert(remote.receive(frame(Kind::play, lost, 1500), 2200));
  reply(remote, Kind::accepted, lost);
  remote.close();
  assert(!background.should_yield(2201, false, true));
  assert(!background.first_dma(lost, 2202));
}

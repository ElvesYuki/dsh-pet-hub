#include "daily_policy.h"

#include <cassert>

int main() {
  using namespace vp8_daily;
  Policy p;
  assert(p.next(idle, false, 0) == idle);
  assert(p.next(idle, false, 0) == idle);
  assert(p.next(idle, false, 1) == first_auto);
  assert(p.next(first_auto, false, 0) == idle);
  assert(p.next(idle, false, 0) == idle);
  assert(p.next(idle, true, 0) == wave);
  assert(p.next(wave, true, 0) == idle);
  assert(p.next(idle, false, 0) == idle);
  assert(p.next(idle, false, 0) == idle);
  assert(p.next(idle, false, 0) == second_auto);
  assert(p.next(second_auto, true, 0) == wave);

  TouchEdge edge;
  assert(edge.observe(true, true, 1000));
  assert(!edge.observe(false, false, 2000));
  assert(!edge.observe(true, true, 300000));
  assert(!edge.observe(true, false, 301000));
  assert(edge.observe(true, true, 302000));
  assert(!edge.observe(true, false, 303000));
  assert(!edge.observe(true, true, 320000));
  assert(!edge.observe(true, true, 610000));
  assert(!edge.observe(true, false, 611000));
  assert(edge.observe(true, true, 612000));

  FrameGate queued;
  queued.cancel();
  assert(!queued.begin() && queued.cancelled());
  FrameGate active;
  assert(active.begin());
  assert(!active.begin());
  active.cancel();
  active.end();
  assert(active.cancelled() && !active.begin());
  FrameGate reusable;
  assert(reusable.begin());
  reusable.end();
  assert(reusable.begin());
  reusable.end();
}

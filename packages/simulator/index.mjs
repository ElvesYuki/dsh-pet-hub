import { clone, requireThat } from '../core/protocol.mjs';
export class VirtualClock {
  #time = 0;#records=0;#historyLimit;timeline = [];
  constructor({historyLimit=1024}={}){requireThat(Number.isSafeInteger(historyLimit)&&historyLimit>=0&&historyLimit<=65536);this.#historyLimit=historyLimit;}
  historyStats(){return {recorded:this.#records,retained:this.timeline.length,dropped:this.#records-this.timeline.length};}
  now() { return this.#time; }
  advance(ms) { requireThat(Number.isSafeInteger(ms) && ms >= 0 && Number.isSafeInteger(this.#time + ms)); this.#time += ms; this.#records++;this.timeline.push({ advance_ms: ms, now_ms: this.#time });if(this.timeline.length>this.#historyLimit)this.timeline.shift(); }
}
export class MemoryStore {
  #data; failNext = false; writes = 0;
  constructor(data) { this.#data = clone({ revision: '0', ...data }); }
  read() { return clone(this.#data); }
  commit(expected, value) {
    requireThat(expected === this.#data.revision, 'revision_conflict');
    if (this.failNext) { this.failNext = false; requireThat(false, 'storage_failed'); }
    this.#data = clone({ ...value, revision: String(BigInt(expected) + 1n) }); this.writes++; return this.read();
  }
}
/** No sockets/timers. The caller explicitly selects delivery order. */
export class FaultQueue {
  events = [];
  #clock; #items = []; #seq = 0;#records=0;
  #record(event){this.#records++;this.events.push(event);if(this.events.length>1024)this.events.shift();}
  historyStats(){return {recorded:this.#records,retained:this.events.length,dropped:this.#records-this.events.length,pending:this.#items.length};}
  constructor(clock) { this.#clock = clock; }
  send(deliver, { delay = 0, copies = 1, drop = false } = {}) {
    requireThat(Number.isSafeInteger(delay) && delay >= 0 && Number.isSafeInteger(copies) && copies >= 0 && copies <= 8);
    requireThat(this.#items.length + copies <= 1024, 'capacity_exceeded');
    this.#record({ event: drop ? 'drop' : 'send', at_ms: this.#clock.now(), delay_ms: delay, copies });
    if (drop) return;
    for (let n = 0; n < copies; n++) this.#items.push({ at: this.#clock.now() + delay, seq: this.#seq++, deliver });
  }
  flush({ reverse = false } = {}) {
    const ready = this.#items.filter(v => v.at <= this.#clock.now()).sort((a,b) => a.seq-b.seq); this.#items = this.#items.filter(v => v.at > this.#clock.now());
    if (reverse) ready.reverse(); return ready.map(item => { try { const value = item.deliver(); this.#record({ event: 'deliver', at_ms: this.#clock.now() }); return { ok: true, value }; } catch (e) { this.#record({ event: 'reject', code: e.code, at_ms: this.#clock.now() }); return { ok: false, code: e.code }; } });
  }
}
export function fixtureAuth() {
  const trusted = new WeakMap();
  return {
    issue(identity) { const proof = Object.freeze({ synthetic: true }); trusted.set(proof, identity); return proof; },
    verify(proof, identity) { return trusted.get(proof) === identity; },
  };
}

import { clone, requireThat, uint64, increment, id, same, keys } from './protocol.mjs';
export class IntentScheduler {
  #clock; #instance; #revision = '0'; #requests = new Map(); #mode = 'auto'; #manual = null; #source = null; #sourceStatus = 'unavailable'; #unavailable = null; #touch = null; #events = new Set(); #lastTouch = -Infinity;#touchRequests=new Map();#touchSeq=null;#touchMode=null;
  constructor({ clock, instance, mapping }) { this.#clock = clock; this.#unavailable = clock.now(); this.#instance = instance; this.mapping = clone(mapping); }
  submit(input) {
    keys(input, ['intent_id','client_id','service_instance_id','expected_revision','kind','action_id']);
    id(input.intent_id); id(input.client_id); uint64(input.expected_revision);
    requireThat(input.service_instance_id === this.#instance, 'stale_session');
    const key = `${input.client_id}:${input.intent_id}`;
    if (this.#requests.has(key)) { const old = this.#requests.get(key); requireThat(same(input, old.input), 'idempotency_conflict'); return clone(old.result); }
    requireThat(input.expected_revision === this.#revision, 'revision_conflict');
    requireThat(['manual','auto','stop_preview'].includes(input.kind));
    if (input.kind === 'manual') requireThat(Object.values(this.mapping).includes(input.action_id), 'unknown_action');
    this.#revision = increment(this.#revision); this.#mode = input.kind === 'manual' ? 'manual' : 'auto'; this.#manual = input.action_id ?? null;
    const result = { revision: this.#revision }; this.#requests.set(key, { input: clone(input), result });if(this.#requests.size>256)this.#requests.delete(this.#requests.keys().next().value);return clone(result);
  }
  source(status, state = null) {
    requireThat(['connected','unavailable'].includes(status));
    requireThat(state === null || Object.hasOwn(this.mapping, state));
    this.#sourceStatus = status;
    if (status === 'connected') { this.#source = state; this.#unavailable = null; }
    else if (this.#unavailable === null) this.#unavailable = this.#clock.now();
  }
  touch(eventId, duration = 10040, eventSeq) {
    id(eventId); requireThat(Number.isSafeInteger(duration) && duration > 0 && duration <= 30000);
    const mode=eventSeq===undefined?'legacy':'sequenced',seq=eventSeq===undefined?null:uint64(eventSeq);requireThat(this.#touchMode===null||this.#touchMode===mode,'invalid_message');
    if(mode==='sequenced'){
      const old=this.#touchRequests.get(eventId);if(old){requireThat(old.seq===eventSeq&&old.duration===duration,'idempotency_conflict');return false;}
      if(this.#touchSeq!==null&&seq<=uint64(this.#touchSeq))return false;
      const accepted=this.#clock.now()-this.#lastTouch>=1000;this.#touchMode=mode;this.#touchSeq=eventSeq;this.#touchRequests.set(eventId,{seq:eventSeq,duration});if(this.#touchRequests.size>256)this.#touchRequests.delete(this.#touchRequests.keys().next().value);
      if(!accepted)return false;this.#lastTouch=this.#clock.now();this.#touch={until:this.#clock.now()+duration};return true;
    }
    if (this.#events.has(eventId) || this.#clock.now() - this.#lastTouch < 1000) return false;
    requireThat(this.#events.size < 256, 'capacity_exceeded');
    this.#touchMode=mode;this.#events.add(eventId); this.#lastTouch = this.#clock.now(); this.#touch = { until: this.#clock.now() + duration }; return true;
  }
  desired() {
    if (this.#touch && this.#clock.now() < this.#touch.until) return this.mapping.touch;
    if (this.#mode === 'manual') return this.#manual;
    const state = this.#unavailable !== null && this.#clock.now() - this.#unavailable > 2000 ? null : this.#source;
    return this.mapping[state ?? 'idle'];
  }
  summary() { return { synthetic: true, mode: this.#mode, intent_revision: this.#revision, action_id: this.desired(), source_status: this.#sourceStatus }; }
  resources(){return {intent_receipts:this.#requests.size,touch_receipts:this.#events.size+this.#touchRequests.size,touch_mode:this.#touchMode,event_seq:this.#touchSeq};}
}

/** Legacy fixture only. No network or assertion of authenticated device identity. */
export class LegacySlot {
  #owner = null;
  attach(slot, writer) { requireThat(slot === 'legacy_slot', 'unsupported_protocol'); requireThat(!this.#owner || this.#owner === writer, 'lease_busy'); this.#owner = writer; }
  observe(state, acknowledged) {
    requireThat(typeof state === 'string' && /^\d+ \d+ -?\d+\n?$/.test(state));
    const [action, revision, hint] = state.trim().split(' ').map(Number);
    requireThat([action,hint].every(v => v >= -1 && v < 78) && action >= 0 && Number.isSafeInteger(revision));
    return { synthetic: true, slot: 'legacy_slot', identity: 'unverified', phase: acknowledged ? 'legacy_acknowledged' : 'unknown', action_id: action, heartbeat: null };
  }
}

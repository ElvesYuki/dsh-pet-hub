import { clone, requireThat, keys, id, uint64, increment, capabilities, frame, target, same, bounded } from './protocol.mjs';

/** Trusted binding administration and verified-peer boundary are injected, never read from wire booleans. */
export class Registry {
  #store; #verify; #clock; #manifest; #capabilities; #target; #records = new Map(); #discovered = new Map();
  constructor({ store, verifyPeer = () => false, clock, manifest, validateCapabilities = capabilities, validateTarget = target }) { requireThat(typeof validateCapabilities==='function'&&typeof validateTarget==='function','invalid_device_profile'); this.#capabilities=validateCapabilities; this.#target=validateTarget; this.#manifest = clone(manifest); this.#store = store; this.#verify = verifyPeer; this.#clock = clock; }
  discover(candidate) { id(candidate.candidate_id); requireThat(this.#discovered.has(candidate.candidate_id) || this.#discovered.size < 128, 'capacity_exceeded'); this.#discovered.set(candidate.candidate_id, { candidate_id: candidate.candidate_id, status: 'discovered', synthetic: true }); }
  bind(record) {
    keys(record, ['device_id','binding_id','binding_epoch','identity_ref','controller_id']);
    for (const key of ['device_id','binding_id','identity_ref','controller_id']) id(record[key]); uint64(record.binding_epoch);
    const data = this.#store.read(); requireThat(!Object.hasOwn(data.bindings,record.device_id), 'identity_conflict'); requireThat(Object.keys(data.bindings).length < 64, 'capacity_exceeded');
    Object.defineProperty(data.bindings,record.device_id,{ value: { ...clone(record), state: 'bound', mapping: {} }, enumerable:true, configurable:true, writable:true }); this.#store.commit(data.revision, data);
  }
  connect(hello, proof) {
    frame(hello); keys(hello, ['protocol','device_id','binding_id','binding_epoch','boot_id','session_id','capabilities']);
    requireThat(hello.protocol === 'hub-device/1', 'unsupported_protocol');
    for (const k of ['device_id','binding_id','boot_id','session_id']) id(hello[k]); uint64(hello.binding_epoch);
    const binding = this.#binding(hello.device_id);
    requireThat(this.#store.isAdmitted?.(hello.device_id)!==false,'stale_binding');
    requireThat(this.#verify(proof, clone(binding),clone(hello)) === true, 'identity_conflict');
    requireThat(binding.state === 'bound' && hello.binding_id === binding.binding_id && hello.binding_epoch === binding.binding_epoch, 'stale_binding');
    const caps = this.#capabilities(hello.capabilities);
    this.#records.set(hello.device_id, { device_id: hello.device_id, binding_id: hello.binding_id, binding_epoch: hello.binding_epoch, boot_id: hello.boot_id, session_id: hello.session_id, caps, connected:true, lastSeen: this.#clock.now(), seq: null, desired: null, actual: null, reportSeq: null, started: null });
    return this.context(hello.device_id);
  }
  #binding(deviceId) { const bindings = this.#store.read().bindings; requireThat(Object.hasOwn(bindings,deviceId), 'identity_conflict'); const record=bindings[deviceId]; return record; }
  context(deviceId) {
    const r = this.#get(deviceId); return Object.fromEntries(['device_id','binding_id','binding_epoch','boot_id','session_id'].map(k => [k,r[k]]));
  }
  #get(deviceId) { const r = this.#records.get(deviceId); requireThat(r, 'stale_session'); return r; }
  #match(context) {
    const r = this.#get(context.device_id), binding = this.#binding(context.device_id);
    requireThat(this.#store.isAdmitted?.(context.device_id)!==false&&binding.state === 'bound' && binding.binding_epoch===r.binding_epoch&&binding.binding_id===r.binding_id&&context.binding_epoch === r.binding_epoch && context.binding_id === r.binding_id, 'stale_binding');
    requireThat(r.connected!==false,'stale_session');requireThat(context.boot_id === r.boot_id, 'stale_boot'); requireThat(context.session_id === r.session_id, 'stale_session'); return r;
  }
  heartbeat(context, seq) {
    const r = this.#match(context); const n = uint64(seq);
    if (r.seq !== null && n <= uint64(r.seq)) return false;
    r.seq = seq; r.lastSeen = this.#clock.now(); return true;
  }
  /** Observe a trusted device grant. Optional sent_at is host-local; lease_ms is device remaining TTL.
   * Optional uint64 request_seq fences same-tick renewals and cannot be dropped once observed.
   * Throws on stale/expired observations without mutation. No timers or clock synchronization. */
  control(context, control, observation) {
    const r = this.#match(context);
    keys(control, ['controller_id','service_instance_id','control_epoch','lease_id','expires_at']);
    for (const k of ['controller_id','service_instance_id','lease_id']) id(control[k]); uint64(control.control_epoch);
    requireThat(control.controller_id === this.#binding(context.device_id).controller_id, 'stale_control');
    const relative=observation!==undefined;requireThat(relative||!r.relative,'invalid_message');
    let deadline=control.expires_at;
    if(relative){
      keys(observation,['sent_at','lease_ms','request_seq']);
      if(Object.hasOwn(control,'expires_at'))bounded(control.expires_at,0,Number.MAX_SAFE_INTEGER);
      bounded(observation.sent_at,0,this.#clock.now());bounded(observation.lease_ms,1,30000);
      deadline=observation.sent_at+observation.lease_ms;bounded(deadline,0,Number.MAX_SAFE_INTEGER);
      requireThat(deadline>this.#clock.now(),'lease_expired');
      if(observation.request_seq!==undefined)uint64(observation.request_seq);
      const previous=r.observation;
      if(previous){
        requireThat(observation.sent_at>=previous.sent_at,'stale_control');
        const duplicate=same(observation,previous)&&same(control,r.control);
        const newerSequence=observation.request_seq!==undefined&&(previous.request_seq===undefined||uint64(observation.request_seq)>uint64(previous.request_seq));
        if(previous.request_seq!==undefined)requireThat(observation.request_seq!==undefined&&(newerSequence||duplicate),'stale_control');
        if(observation.sent_at===previous.sent_at&&!newerSequence)requireThat(duplicate||uint64(control.control_epoch)>uint64(r.control.control_epoch),'stale_control');
      }
    }else bounded(control.expires_at, this.#clock.now() + 1, this.#clock.now() + 30000);
    if (r.control) {
      const a = { ...r.control }, b = { ...control }; delete a.expires_at; delete b.expires_at;
      requireThat(same(a,b) || ((relative||this.#clock.now() >= r.control.expires_at) && uint64(control.control_epoch) > uint64(r.control.control_epoch)), 'stale_control');
    }
    r.control = clone(control);r.deadline=deadline;if(relative){r.relative=true;r.observation=clone(observation);}
  }
  expect(context, command, control, observation) {
    const r = this.#match(context);
    this.#target(command, this.#manifest, r.caps);
    if (r.desired && r.commandControl?.lease_id === control.lease_id) {
      if (r.desired.command_id === command.command_id) requireThat(same(r.desired,command), 'idempotency_conflict');
      else requireThat(uint64(command.revision) > uint64(r.desired.revision), 'stale_revision');
    }
    this.control(context, control, observation);
    const previous = r.commandControl ? { ...r.commandControl } : null, current = { ...control };
    if (previous) delete previous.expires_at; delete current.expires_at;
    if (same(r.desired, command) && same(previous, current)) return;
    r.commandControl = clone(control);
    r.desired = clone(command); r.control = clone(control); r.reportSeq = null; r.phase = 'accepted'; r.started = null;r.expectedAt=this.#clock.now();
  }
  report(context, report) {
    frame(report); keys(report, ['target','control','report_seq','phase','elapsed_ms']);
    const r = this.#match(context); uint64(report.report_seq);
    requireThat(r.desired && same(report.target, r.desired), 'stale_revision');
    requireThat(same(report.control, r.control), 'stale_control');
    requireThat(r.control && this.#clock.now() < r.deadline, 'lease_expired');
    requireThat(['accepted','downloading','verified','playing','failed','cancelled','ended'].includes(report.phase));
    requireThat(Number.isSafeInteger(report.elapsed_ms) && report.elapsed_ms >= 0 && (r.relative?report.elapsed_ms<=Number.MAX_SAFE_INTEGER:report.elapsed_ms<=this.#clock.now()));
    if (r.reportSeq !== null && uint64(report.report_seq) <= uint64(r.reportSeq)) return false;
    if (['failed','cancelled','ended'].includes(r.phase)) return false;
    const order = ['accepted','downloading','verified','playing','ended'];
    if (order.includes(report.phase) && order.indexOf(report.phase) < order.indexOf(r.phase)) return false;
    requireThat(report.phase !== 'playing' || ['verified','playing'].includes(r.phase), 'invalid_message');
    r.reportSeq = report.report_seq; r.phase = report.phase;
    if (report.phase === 'playing') {
      if (r.started === null) r.started = Math.max(r.relative?r.expectedAt:0,this.#clock.now() - report.elapsed_ms);
      r.actual = clone(report.target);
    }
    return true;
  }
  /** Explicit transport loss: retain last actual, fence queued messages until a new hello. */
  disconnect(context){const r=this.#match(context);r.connected=false;}
  /** Trusted owner invalidation: no binding authorization needed; stale close cannot fence a new session. */
  invalidate(context){const r=this.#records.get(context.device_id);if(!r||!['device_id','binding_id','binding_epoch','boot_id','session_id'].every(k=>r[k]===context[k]))return false;r.connected=false;delete r.control;delete r.deadline;delete r.observation;delete r.commandControl;return true;}
  /** Last in-memory observation for trusted cleanup, including when persistent metadata is unavailable. */
  lastActual(context){const r=this.#records.get(context.device_id);return r&&['device_id','binding_id','binding_epoch','boot_id','session_id'].every(k=>r[k]===context[k])?clone(r.actual):null;}
  freeze(deviceId, state = 'pending_revocation') {
    requireThat(['pending_revocation','forget_pending'].includes(state));
    const data = this.#store.read(); this.#binding(deviceId); data.bindings[deviceId].state = state; this.#store.commit(data.revision, data);
  }
  confirmRevocation(deviceId, receipt, verifyReceipt = () => false) {
    const data = this.#store.read(), binding = this.#binding(deviceId);
    requireThat(binding.state === 'pending_revocation' && verifyReceipt(receipt) === true && receipt.old_epoch === binding.binding_epoch, 'revocation_unconfirmed');
    requireThat(receipt.binding_epoch === increment(binding.binding_epoch), 'stale_binding');
    delete data.bindings[deviceId].identity_ref; data.bindings[deviceId].state = 'revoked'; data.bindings[deviceId].binding_epoch = receipt.binding_epoch;
    this.#store.commit(data.revision, data);
  }
  mapping(deviceId, expected, value) {
    const data = this.#store.read(); requireThat(data.revision === expected, 'revision_conflict');
    requireThat(data.bindings[deviceId]?.state === 'bound', 'stale_binding');
    keys(value, ['character_id']); id(value.character_id); data.bindings[deviceId].mapping = clone(value); this.#store.commit(expected, data);
  }
  summary() {
    const data = this.#store.read();
    return { synthetic: true, discovered: [...this.#discovered.values()].map(clone), devices: Object.values(data.bindings).map(binding => {
      const r = this.#records.get(binding.device_id), age = r ? this.#clock.now() - r.lastSeen : Infinity;
      return { device_id: binding.device_id, binding: binding.state, connection: r?.connected===false ? 'offline' : age > 30000 ? 'offline' : age > 15000 ? 'stale' : 'online', desired: r?.desired?.action_id ?? null, actual: r?.actual?.action_id ?? null, controlled: this.#store.isAdmitted?.(binding.device_id)!==false&&r?.binding_id===binding.binding_id&&r?.binding_epoch===binding.binding_epoch&&r?.connected!==false && binding.state === 'bound' && !!r?.control && this.#clock.now() < r.deadline, phase: r?.phase ?? null, started: r?.started ?? null, synthetic: true };
    }) };
  }
}

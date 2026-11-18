import { clone, requireThat, uint64, increment, id, target, same } from './protocol.mjs';

/** Device-side reference state machine. Transport/auth and asset verification are injected. */
export class DeviceModel {
  #store; #clock; #ids; #verify; #sessions = new Map(); #ops = new Map(); #lease = null; #commands = new Map(); #cache = []; #age = 0;
  #desired = null; #actual = null; #phase = null; #started = null; #download = null; #reportSeq = '0'; #revision = '0';
  constructor({ deviceId, bindingId, controllerId, store, clock, ids, verifyPeer = () => false, caps, manifest, verifyAsset = () => false }) {
    requireThat(caps.schema_version === 1, 'unsupported_cache_model');
    Object.assign(this, { deviceId, bindingId, controllerId, caps: clone(caps), manifest: clone(manifest), verifyAsset });
    this.#store = store; this.#clock = clock; this.#ids = ids; this.#verify = verifyPeer;
    this.bootId = ids();
  }
  connect(controllerId, instance, proof) {
    id(controllerId); id(instance);
    requireThat(controllerId === this.controllerId && this.#verify(proof) === true, 'identity_conflict');
    const state = this.#store.read(); requireThat(!state.revoked, 'stale_binding');
    const context = { device_id: this.deviceId, binding_id: this.bindingId, binding_epoch: state.binding_epoch, boot_id: this.bootId, session_id: this.#ids(), controller_id: controllerId, service_instance_id: instance };
    if(!this.#sessions.has(instance)&&this.#sessions.size>=16){
      const owner=this.#lease&&this.#clock.now()<this.#lease.expires_at?this.#lease.service_instance_id:null;
      const victim=[...this.#sessions.keys()].find(key=>key!==owner);requireThat(victim!==undefined,'capacity_exceeded');this.#sessions.delete(victim);
    }
    if (this.#lease?.service_instance_id === instance) this.#lease = null;
    this.#sessions.set(instance, context); return clone(context);
  }
  #check(ctx) {
    const state = this.#store.read(); requireThat(!state.revoked && ctx.binding_id === this.bindingId && ctx.binding_epoch === state.binding_epoch, 'stale_binding');
    requireThat(ctx.device_id === this.deviceId, 'identity_conflict'); requireThat(ctx.boot_id === this.bootId, 'stale_boot');
    requireThat(same(ctx, this.#sessions.get(ctx.service_instance_id)), 'stale_session');
  }
  #valid(ctx, grant) {
    this.#check(ctx); requireThat(this.#lease && this.#clock.now() < this.#lease.expires_at, 'lease_expired');
    requireThat(this.#lease.service_instance_id === ctx.service_instance_id && same(grant, this.#lease), 'stale_control');
  }
  acquire(ctx, operationId, expectedEpoch) {
    this.#check(ctx); id(operationId); uint64(expectedEpoch);
    const opKey = `${ctx.session_id}:${operationId}`;
    if (this.#ops.has(opKey)) {
      const old = this.#ops.get(opKey);requireThat(old.expectedEpoch===expectedEpoch,'idempotency_conflict');requireThat(this.#lease && same(old.grant, this.#lease) && this.#clock.now() < old.grant.expires_at, 'lease_expired'); return clone(old.grant);
    }
    requireThat(!this.#lease || this.#clock.now() >= this.#lease.expires_at, 'lease_busy');
    const state = this.#store.read(); requireThat(state.control_epoch === expectedEpoch, 'stale_control');
    const epoch = increment(state.control_epoch); this.#store.commit(state.revision, { ...state, control_epoch: epoch });
    this.#lease = { controller_id: ctx.controller_id, service_instance_id: ctx.service_instance_id, control_epoch: epoch, lease_id: this.#ids(), expires_at: this.#clock.now() + 15000 };
    this.#ops.clear();this.#ops.set(opKey, {expectedEpoch,grant:clone(this.#lease)}); this.#revision = '0'; this.#commands.clear(); this.#desired = null; this.#download = null;
    return clone(this.#lease);
  }
  renew(ctx, grant) {
    this.#valid(ctx, grant); this.#lease.expires_at = this.#clock.now() + 15000;
    // Keep the immutable grant operation replay linked to the renewed lease.
    for (const [key, old] of this.#ops) if (old.grant.lease_id === grant.lease_id) this.#ops.set(key, {...old,grant:clone(this.#lease)});
    return clone(this.#lease);
  }
  release(ctx, grant) { this.#check(ctx); if (!this.#lease) return; this.#valid(ctx, grant); this.#lease = null; this.#download = null; }
  disconnect(ctx) { this.#check(ctx); this.#sessions.delete(ctx.service_instance_id); if (this.#lease?.service_instance_id === ctx.service_instance_id) { this.#lease = null; this.#download = null; } }
  set(ctx, grant, command) {
    this.#valid(ctx, grant); id(command.command_id);
    const old = this.#commands.get(command.command_id);
    if (old) { requireThat(same(command, old), 'idempotency_conflict'); return this.snapshot(); }
    target(command, this.manifest, this.caps);
    requireThat(uint64(command.revision) > uint64(this.#revision), 'stale_revision');
    this.#commands.set(command.command_id, clone(command));if(this.#commands.size>256)this.#commands.delete(this.#commands.keys().next().value);this.#revision = command.revision;
    this.#desired = clone(command); this.#started = null; this.#phase = 'accepted';
    this.#download = this.#cache.some(c => c.hash === command.asset_sha256) ? null : command.command_id;
    return this.snapshot();
  }
  verify(commandId, asset) {
    requireThat(this.#desired?.command_id === commandId, 'stale_revision');
    requireThat(['accepted','downloading','verified'].includes(this.#phase), 'invalid_message');
    const command = this.#desired, expected = target(command, this.manifest, this.caps);
    if (!this.verifyAsset(asset, expected, this.manifest)) { this.#phase = 'failed'; this.#download = null; requireThat(false, 'asset_integrity_failed'); }
    let cached = this.#cache.find(c => c.hash === command.asset_sha256);
    if (!cached) {
      if (this.#cache.length === this.caps.cache.slots) {
        const victims = this.#cache.filter(c => c.hash !== this.#actual?.asset_sha256 && c.hash !== this.#desired.asset_sha256).sort((a,b) => a.age - b.age);
        requireThat(victims.length > 0, 'cache_busy'); this.#cache.splice(this.#cache.indexOf(victims[0]), 1);
      }
      cached = { hash: command.asset_sha256, age: ++this.#age }; this.#cache.push(cached);
    }
    cached.age = ++this.#age; this.#phase = 'verified'; this.#download = null;
  }
  submitFrame(ctx, grant, commandId) {
    this.#valid(ctx, grant); requireThat(this.#desired?.command_id === commandId, 'stale_revision');
    requireThat(['verified','playing'].includes(this.#phase), 'invalid_message');
    if (this.#started === null) this.#started = this.#clock.now(); this.#phase = 'playing'; this.#actual = clone(this.#desired);
  }
  report() {
    requireThat(this.#desired && this.#phase, 'invalid_message'); this.#reportSeq = increment(this.#reportSeq);
    return { target: clone(this.#desired), control: clone(this.#lease), report_seq: this.#reportSeq, phase: this.#phase, elapsed_ms: this.#started === null ? 0 : this.#clock.now() - this.#started };
  }
  cancel(ctx, grant, commandId) {
    this.#valid(ctx, grant); requireThat(commandId === this.#desired?.command_id, 'stale_revision'); this.#phase = 'cancelled'; this.#download = null;
  }
  revoke(ctx, operationId, expectedEpoch) {
    id(operationId); const state = this.#store.read();
    if (Object.hasOwn(state.revoke_ops,operationId)) {
      requireThat(ctx.device_id === this.deviceId && ctx.boot_id === this.bootId && same(ctx,this.#sessions.get(ctx.service_instance_id)) && state.revoke_ops[operationId].old_epoch === expectedEpoch, 'stale_binding');
      return clone(state.revoke_ops[operationId]); // Trusted local delivery fixture; wire auth must separately permit receipt recovery.
    }
    this.#check(ctx); requireThat(state.binding_epoch === expectedEpoch, 'stale_binding');
    const receipt = { old_epoch: expectedEpoch, binding_epoch: increment(expectedEpoch), operation_id: operationId };
    this.#store.commit(state.revision, { ...state, binding_epoch: receipt.binding_epoch, revoked: true, revoke_ops: { ...state.revoke_ops, [operationId]: receipt } });
    this.#lease = null; this.#download = null; this.#phase = 'cancelled'; return clone(receipt);
  }
  reboot() {
    this.bootId = this.#ids(); this.#sessions.clear(); this.#ops.clear(); this.#lease = null; this.#commands.clear(); this.#cache = [];
    this.#desired = this.#actual = this.#started = this.#download = this.#phase = null; this.#revision = this.#reportSeq = '0';
  }
  resources(){return {sessions:this.#sessions.size,acquire_receipts:this.#ops.size,command_receipts:this.#commands.size,command_revision:this.#revision,cache_slots:this.#cache.length};}
  snapshot() {
    return { synthetic: true, device_id: this.deviceId, boot_id: this.bootId, controlled: !!this.#lease && this.#clock.now() < this.#lease.expires_at,
      desired: clone(this.#desired), actual: clone(this.#actual), phase: this.#phase, started: this.#started, downloading: this.#download, cache: this.#cache.map(c => c.hash) };
  }
}

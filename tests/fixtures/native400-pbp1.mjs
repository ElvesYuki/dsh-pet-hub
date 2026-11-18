import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {decodePbp1Frame, encodePbp1Frame} from '../../packages/core/native400-pbp1-wire.mjs';

const empty = {proposal: 0, fingerprint: '0'.repeat(32), phase: 'empty'};

export function mockPbp1Usb({boot, device, intercept, initial = {}}) {
  const state = {kind: 'state', boot, device, event: 'ok', ...empty, ...initial};
  const history = [];
  const confirmed = Promise.withResolvers();
  let key, closed = 0, offerPacket;
  function forget() {
    key?.fill(0);
    key = undefined;
    Object.assign(state, empty);
  }
  function activate() {
    if (state.phase !== 'host-confirmed') return false;
    state.phase = 'active';
    return true;
  }
  return {
    transport: {
      async exchange(packet, {signal}) {
        signal.throwIfAborted();
        assert.equal(closed, 0);
        const message = decodePbp1Frame(packet);
        history.push(message.kind);
        switch (message.kind) {
          case 'offer': {
            assert.equal(state.phase, 'empty');
            assert.equal(message.boot, boot);
            assert.equal(message.device, device);
            offerPacket = packet;
            key = Buffer.from(message.psk);
            const identity = Buffer.alloc(68);
            identity.writeBigUInt64LE(BigInt(boot));
            identity.writeUInt32LE(17, 8);
            for (const [index, id] of [device, message.controller, message.binding].entries()) {
              Buffer.from(id, 'hex').copy(identity, 12 + index * 16);
            }
            identity.writeBigUInt64LE(BigInt(message.epoch), 60);
            const fingerprint = createHmac('sha256', key).update('PBP1/fingerprint/v1').update(identity).digest('hex').slice(0, 32);
            Object.assign(state, {proposal: 17, phase: 'pending', fingerprint});
            break;
          }
          case 'confirm':
          case 'cancel':
            assert.equal(state.phase, 'pending');
            assert.equal(message.boot, boot);
            assert.equal(message.proposal, state.proposal);
            assert.equal(message.fingerprint, state.fingerprint);
            if (message.kind === 'confirm') {
              state.phase = 'host-confirmed';
              confirmed.resolve();
            } else forget();
            break;
          case 'info': break;
          default: assert.fail('unexpected USB request');
        }
        const reply = {...state};
        const response = intercept?.(message.kind, reply);
        return response === null ? null : encodePbp1Frame(response ?? reply);
      },
      async close() {
        assert.equal(++closed, 1);
        if (state.phase === 'pending' || state.phase === 'host-confirmed') forget();
      }
    },
    history,
    confirmed: confirmed.promise,
    screen: () => state.fingerprint,
    longPress: activate,
    pressBoot: activate,
    activeSecret: () => state.phase === 'active' ? key.toString('hex') : undefined,
    get closeCount() { return closed; },
    get offerCleared() { return offerPacket?.every(byte => byte === 0); }
  };
}

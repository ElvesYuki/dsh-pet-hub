import './build.mjs';
import {verifyIsolated} from './lib/isolated-verifier.mjs';
await verifyIsolated({files:['tests/round-pet-a7.test.mjs'],expected:24,timeoutMs:120000,layer:'round-pet-session-root-recovery-candidate',prefix:'ha7-',scope:'Trusted model session boundary, caller-owned temporary root checkpoints, real loopback TLS/new hub owner with a running actor, rollback maintenance and deferred/cancel/commit races; no physical device, production listener, automatic durable approval or configured services.'});

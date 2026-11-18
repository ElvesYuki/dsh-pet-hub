import './build.mjs';
import {verifyIsolated} from './lib/isolated-verifier.mjs';
await verifyIsolated({files:['tests/round-pet-g0-r7.test.mjs'],expected:30,timeoutMs:120000,layer:'round-pet-wire-gated-commit-recovery',prefix:'hgr7-',scope:'Original A2 media, existing A1 synchronous logical Flash, new-wire loopback TLS/A8 and virtual clocks. Local gated completion after loss/expiry/pause, stale receipts and competing sessions, actual model call exit; no hardware, firmware, production listener or existing configuration.'});

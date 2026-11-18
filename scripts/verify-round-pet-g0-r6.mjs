import './build.mjs';
import {verifyIsolated} from './lib/isolated-verifier.mjs';
await verifyIsolated({files:['tests/round-pet-g0-r6.test.mjs'],expected:30,timeoutMs:120000,layer:'round-pet-wire-a1-actor-execution',prefix:'hgr6-',scope:'Original A2 PET4 and existing A1 actor/logical Flash through real private loopback new-wire mTLS/GET, separate virtual clocks, frame/commit tokens, eviction and reconnect; no physical device, firmware, real assets or production listener.'});

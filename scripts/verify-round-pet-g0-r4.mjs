import './build.mjs';
import {verifyIsolated} from './lib/isolated-verifier.mjs';
await verifyIsolated({files:['tests/round-pet-g0-r4.test.mjs'],expected:30,timeoutMs:120000,layer:'round-pet-wire-temporary-host-adapter',prefix:'hgr4-',scope:'Original A2 media, temporary CAS/binding roots/PKI, virtual clock and real loopback mTLS only. Explicit enable, new hello and schema2 projection, cancellation/cache-hit/late/unknown recovery and durable-before-publication. No device, firmware, existing configuration or production listener; no new GET transport.'});

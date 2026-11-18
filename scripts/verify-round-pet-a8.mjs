import './build.mjs';
import {verifyIsolated} from './lib/isolated-verifier.mjs';
await verifyIsolated({files:['tests/round-pet-a8.test.mjs'],expected:34,timeoutMs:120000,layer:'round-pet-binding-root-authority-candidate',prefix:'ha8-',scope:'Explicit temporary binding/root single-file authority, durable CAS before projection, real loopback TLS, new owner recovery and owned SIGKILL cutpoints; no real devices, production listener, legacy migration or claim of cross-process disk anti-rollback.'});

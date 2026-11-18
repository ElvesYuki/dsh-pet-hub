import './build.mjs';
import {verifyIsolated} from './lib/isolated-verifier.mjs';
await verifyIsolated({files:['tests/round-pet-a3.test.mjs'],expected:46,layer:'round-pet-observation-review',prefix:'ha3-',scope:'Synthetic object attestation/virtual clock, independent observation streams, temporary UDS and loopback host proxy, read-only UI and candidate VM lifecycle; no firmware/device/TLS integration or plugin installation.'});

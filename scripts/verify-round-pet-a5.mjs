import './build.mjs';
import {verifyIsolated} from './lib/isolated-verifier.mjs';
await verifyIsolated({files:['tests/round-pet-a5.test.mjs'],expected:41,layer:'round-pet-assembly-candidate',prefix:'ha5-',scope:'Default-off UDS owner integrating A2 strict disk CAS, A3 read-only projection and A4 temporary loopback mTLS; initial inventory/write gates, file proof, power and actual-I/O cleanup; original PET4 only, no real device, production listener or configured services.'});

import './build.mjs';
import {verifyIsolated} from './lib/isolated-verifier.mjs';
await verifyIsolated({files:['tests/round-pet-a6.test.mjs'],expected:30,timeoutMs:120000,layer:'round-pet-model-execution-candidate',prefix:'ha6-',scope:'A1 logical Flash/refresh executor through A2 disk CAS, A4 temporary mTLS and default-off A5/A3 projection; original PET4 and independent virtual clocks, injected storage/link failures; no physical device, firmware, production listener or configured services.'});

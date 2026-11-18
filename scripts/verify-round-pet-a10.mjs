import './build.mjs';
import {verifyIsolated} from './lib/isolated-verifier.mjs';
import {validateRootReductionEvidence} from './lib/root-reduction-evidence.mjs';
await verifyIsolated({files:['tests/round-pet-a10.test.mjs'],expected:24,timeoutMs:120000,layer:'root-reduction-review',prefix:'ha10-',scope:'Private authority and real loopback TLS; fresh matched full/reduced four-profile workload, unchanged full-file/CAS/dynamic checks and failure fencing. Host observations only; no device or production listener.',evidence:{file:'root-reduction-observations.json',validate:validateRootReductionEvidence}});

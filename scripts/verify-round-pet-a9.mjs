import './build.mjs';
import {verifyIsolated} from './lib/isolated-verifier.mjs';
import {validateRootLoadEvidence} from './lib/root-load-evidence.mjs';
await verifyIsolated({files:['tests/round-pet-a9.test.mjs'],expected:14,timeoutMs:120000,layer:'root-persistence-load-review',prefix:'ha9-',scope:'Private PKI/authority and real loopback TLS, four matched v1/v2 and 1/64-binding workloads, optional counters/capacity and hypothetical budgets; host samples only, no device or production listener.',evidence:{file:'root-load-observations.json',validate:validateRootLoadEvidence}});

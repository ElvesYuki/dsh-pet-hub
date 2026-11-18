import {verifyIsolated} from './lib/isolated-verifier.mjs';
import {validateVerificationComparison} from '../packages/runtime/load-metrics.mjs';
await verifyIsolated({files:['tests/verification-reduction.test.mjs'],expected:14,layer:'verification-reduction',prefix:'hvrr-',scope:'Private PKI/metadata and actual loopback TLS, same four full/scoped workloads plus static-cache and dynamic-authority negatives; host samples only, no device, production listener or physical delay bounds.',evidence:{file:'verification-observations.json',validate:validateVerificationComparison}});

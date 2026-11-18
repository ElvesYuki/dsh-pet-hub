import {verifyIsolated} from './lib/isolated-verifier.mjs';
import {validateTransportObservations} from '../packages/runtime/load-metrics.mjs';
await verifyIsolated({files:['tests/transport-load.test.mjs'],expected:9,layer:'transport-load-delay-review',prefix:'htlr-',scope:'Four fixed synthetic profiles over actual loopback TLS, private metadata/PKI and offline reference queue; host samples, not physical bounds, production scheduling, device or OS sleep validation.',evidence:{file:'transport-observations.json',validate:validateTransportObservations}});

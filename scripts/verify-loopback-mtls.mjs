import {verifyIsolated} from './lib/isolated-verifier.mjs';
await verifyIsolated({files:['tests/loopback-mtls.test.mjs'],expected:22,layer:'node-loopback-mtls',prefix:'hub-loopback-',scope:'Actual Node TLS1.2 mutual peer/binding/lease and bounded synthetic Range; no ESP, physical delay/drift, production listener, or persistent credentials.'});

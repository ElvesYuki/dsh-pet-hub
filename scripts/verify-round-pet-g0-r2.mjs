import './build.mjs';
import {verifyIsolated} from './lib/isolated-verifier.mjs';
await verifyIsolated({files:['tests/round-pet-g0-r2.test.mjs'],expected:35,timeoutMs:120000,layer:'first-window-policy-and-commit-gate-review',prefix:'hgr2-',scope:'Original media/private temporary authority and loopback TLS; pure local-touch policy, cached-only admission, logical commit gate and unknown/I-O recovery. Not firmware concurrency, device receipts, a production listener or physical durability.'});

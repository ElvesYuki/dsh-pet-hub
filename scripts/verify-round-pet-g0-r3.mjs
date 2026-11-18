import './build.mjs';
import {verifyIsolated} from './lib/isolated-verifier.mjs';
await verifyIsolated({files:['tests/round-pet-g0-r3.test.mjs'],expected:24,timeoutMs:120000,layer:'round-pet-wire-v1-host-contract-review',prefix:'hgr3-',scope:'Original canonical bytes, independent Node/C++ host parsing and closed contract checks, pure bounded correlation; temporary compiler artifact only. No socket, firmware build, device, TLS auth, package approval or production listener.'});

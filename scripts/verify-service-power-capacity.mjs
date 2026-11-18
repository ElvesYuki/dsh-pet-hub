import {verifyIsolated} from './lib/isolated-verifier.mjs';
if(process.platform!=='darwin')throw new Error('native power review requires macOS');
await verifyIsolated({files:['tests/service-power-capacity.test.mjs'],expected:17,layer:'managed-service-power-capacity-review',prefix:'hspr-',scope:'Temporary UDS owner assembly, native macOS IOKit registration only, controlled sleep/resume events and 320 actual loopback TLS reconnects; no physical sleep cycle, LAN/device listener, ESP or production configuration.'});

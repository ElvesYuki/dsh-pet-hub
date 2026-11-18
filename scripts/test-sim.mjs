import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
const result = spawnSync(process.execPath, ['--test', '--test-reporter=tap', 'tests/s1.test.mjs'], { encoding: 'utf8', env: { ...process.env, PETHUB_SIM_EVIDENCE: '1' }, maxBuffer: 8 * 1024 * 1024 });
mkdirSync('.cache/s1', { recursive: true });
writeFileSync('.cache/s1/results.tap', result.stdout ?? '');
const cases = [];
for (const line of (result.stdout ?? '').split('\n')) {
  const start = line.indexOf('{"case":');
  if (start >= 0) cases.push(JSON.parse(line.slice(start)));
}
const complete = Array.from({ length: 30 }, (_,i) => `SIM-${String(i+1).padStart(2,'0')}`).every(id => cases.some(c => c.case === id));
writeFileSync('.cache/s1/results.json', JSON.stringify({ layer: 'simulated', passed: result.status === 0 && complete, cases }, null, 2));
console.log(`S1 offline: ${cases.filter(c => c.case.startsWith('SIM-')).length}/30 checklist cases; ${cases.length} total evidence records; ${result.status === 0 && complete ? 'PASS' : 'FAIL'}`);
console.log('Evidence: .cache/s1/results.json and results.tap (ignored by Git)');
if (result.status !== 0 || !complete) { console.error(result.stderr ?? '', (result.stdout ?? '').slice(-8000)); process.exit(1); }

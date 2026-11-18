import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
function check(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) check(path);
    else if (path.endsWith('.mjs')) {
      const result = spawnSync(process.execPath, ['--check', path], { stdio: 'inherit' });
      if (result.status !== 0) process.exit(1);
    }
  }
}
for (const dir of ['packages', 'apps', 'scripts', 'tests']) check(dir);

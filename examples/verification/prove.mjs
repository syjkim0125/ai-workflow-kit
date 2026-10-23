import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const app = fileURLToPath(new URL('./app.mjs', import.meta.url));
const add = spawnSync(process.execPath, [app, '2', '2'], { encoding: 'utf8' });
assert.equal(add.status, 0, add.stderr);
assert.equal(add.stdout.trim(), '4');
const invalid = spawnSync(process.execPath, [app, 'invalid', '2'], { encoding: 'utf8' });
assert.equal(invalid.status, 2);
assert.match(invalid.stderr, /Usage:/);
console.log('PASS CLI addition and rejected invalid input');

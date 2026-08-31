import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(packageRoot, 'bin/ai-workflow-kit.mjs');

test('doctor succeeds for a valid Claude-only installation', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ai-workflow-cli-'));
  const init = spawnSync(process.execPath, [cli, 'init', '--host', 'claude', '--root', root], { encoding: 'utf8' });
  assert.equal(init.status, 0, init.stdout + init.stderr);
  const doctor = spawnSync(process.execPath, [cli, 'doctor', '--root', root], { encoding: 'utf8' });
  assert.equal(doctor.status, 0, doctor.stdout + doctor.stderr);
  assert.match(doctor.stdout, /PASS\s+Claude skill/);
  assert.doesNotMatch(doctor.stdout, /MISS\s+Codex skill/);
});

test('doctor fails clearly before installation', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ai-workflow-cli-'));
  const doctor = spawnSync(process.execPath, [cli, 'doctor', '--root', root], { encoding: 'utf8' });
  assert.equal(doctor.status, 1);
  assert.match(doctor.stdout, /MISS\s+workflow config/);
});


test('init prints the native next command for selected hosts', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ai-workflow-cli-'));
  const init = spawnSync(process.execPath, [cli, 'init', '--host', 'all', '--root', root], { encoding: 'utf8' });
  assert.equal(init.status, 0, init.stdout + init.stderr);
  assert.match(init.stdout, /Claude[^\n]*\/workflow/);
  assert.match(init.stdout, /Codex[^\n]*\$workflow/);
});

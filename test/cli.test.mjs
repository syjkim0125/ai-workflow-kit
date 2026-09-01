import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
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

async function gitRepo(gitignore) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ai-workflow-git-'));
  spawnSync('git', ['init', '-q'], { cwd: root });
  if (gitignore !== undefined) await writeFile(path.join(root, '.gitignore'), gitignore);
  return root;
}

test('doctor fails when a .gitignore rule hides the checker from git', async () => {
  const root = await gitRepo('bin/\n');
  spawnSync(process.execPath, [cli, 'init', '--root', root], { encoding: 'utf8' });
  const doctor = spawnSync(process.execPath, [cli, 'doctor', '--root', root], { encoding: 'utf8' });
  assert.equal(doctor.status, 1, doctor.stdout + doctor.stderr);
  assert.match(doctor.stdout, /PASS\s+Checker: /, 'the file is on disk, so the existence check must still pass');
  assert.match(doctor.stdout, /MISS\s+Checker reaches git: \.gitignore:1:bin\//);
  assert.match(doctor.stdout, /!\.ai-workflow\/bin\//, 'the fix must be spelled out');
});

test('doctor passes once the .gitignore exception is added', async () => {
  const root = await gitRepo('bin/\n!.ai-workflow/bin/\n');
  spawnSync(process.execPath, [cli, 'init', '--root', root], { encoding: 'utf8' });
  const doctor = spawnSync(process.execPath, [cli, 'doctor', '--root', root], { encoding: 'utf8' });
  assert.equal(doctor.status, 0, doctor.stdout + doctor.stderr);
  assert.match(doctor.stdout, /PASS\s+Checker reaches git/);
  const staged = spawnSync('git', ['add', '-A'], { cwd: root });
  assert.equal(staged.status, 0);
  const listed = spawnSync('git', ['ls-files', '--cached', '--', '.ai-workflow/bin/check.mjs'], { cwd: root, encoding: 'utf8' });
  assert.match(listed.stdout, /check\.mjs/, 'doctor passing must mean git actually stages it');
});

test('doctor stays quiet about git outside a work tree', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ai-workflow-nogit-'));
  spawnSync(process.execPath, [cli, 'init', '--root', root], { encoding: 'utf8' });
  const doctor = spawnSync(process.execPath, [cli, 'doctor', '--root', root], { encoding: 'utf8' });
  assert.equal(doctor.status, 0, doctor.stdout + doctor.stderr);
  assert.doesNotMatch(doctor.stdout, /Checker reaches git/);
});

test('init warns at install time when the checker is ignored', async () => {
  const root = await gitRepo('bin/\n');
  const init = spawnSync(process.execPath, [cli, 'init', '--root', root], { encoding: 'utf8' });
  assert.equal(init.status, 0, init.stdout + init.stderr);
  assert.match(init.stdout, /WARNING/);
  assert.match(init.stdout, /!\.ai-workflow\/bin\//);
});

test('a tracked checker is never reported as hidden', async () => {
  const root = await gitRepo('bin/\n');
  spawnSync(process.execPath, [cli, 'init', '--root', root], { encoding: 'utf8' });
  spawnSync('git', ['add', '-f', '--', '.ai-workflow/bin/check.mjs'], { cwd: root });
  const doctor = spawnSync(process.execPath, [cli, 'doctor', '--root', root], { encoding: 'utf8' });
  assert.equal(doctor.status, 0, doctor.stdout + doctor.stderr);
  assert.match(doctor.stdout, /PASS\s+Checker reaches git/);
});

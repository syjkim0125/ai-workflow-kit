import assert from 'node:assert/strict';
import { appendFile, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

// An upgrade run by a stale CLI (for example a cached npx copy) must not read as
// finished: init and doctor name the running and installed versions, and doctor
// flags managed files that do not match the running release.
const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(packageRoot, 'bin/ai-workflow-kit.mjs');
const version = JSON.parse(await readFile(path.join(packageRoot, 'package.json'), 'utf8')).version;
const configFile = (root) => path.join(root, '.ai-workflow/config.json');

const project = () => mkdtemp(path.join(os.tmpdir(), 'ai-workflow-version-'));
const run = (root, ...args) => spawnSync(process.execPath, [cli, ...args, '--root', root], { encoding: 'utf8' });

async function installed(root) {
  const init = run(root, 'init');
  assert.equal(init.status, 0, init.stdout + init.stderr);
  return init;
}

async function setInstalledVersion(root, value) {
  const config = JSON.parse(await readFile(configFile(root), 'utf8'));
  config.packageVersion = value;
  await writeFile(configFile(root), `${JSON.stringify(config, null, 2)}\n`);
}

// What a project formatter (prettier) does to a managed file: same code, different bytes.
const reformat = (file) => appendFile(file, '\n');

test('init names the version it installs on a fresh project', async () => {
  const init = await installed(await project());
  assert.ok(init.stdout.includes(`Installed AI Workflow Kit ${version}.`), init.stdout);
});

test('init that changes nothing names the running and installed versions', async () => {
  const root = await project();
  await installed(root);
  const again = await installed(root);
  assert.ok(again.stdout.includes(`AI Workflow Kit ${version} is already up to date (installed ${version}).`), again.stdout);
});

test('init names both versions when it updates an older install', async () => {
  const root = await project();
  await installed(root);
  await setInstalledVersion(root, '5.0.3');
  const update = await installed(root);
  assert.ok(update.stdout.includes(`Updated AI Workflow Kit 5.0.3 → ${version}.`), update.stdout);
  assert.doesNotMatch(update.stdout, /downgrade/i);
  assert.equal(JSON.parse(await readFile(configFile(root), 'utf8')).packageVersion, version);
});

test('init warns when a CLI older than the install downgrades it', async () => {
  const root = await project();
  await installed(root);
  await setInstalledVersion(root, '99.0.0');
  const update = await installed(root);
  assert.ok(update.stdout.includes(`Updated AI Workflow Kit 99.0.0 → ${version}.`), update.stdout);
  assert.match(update.stdout, new RegExp(`WARNING[^\\n]*${version.replaceAll('.', '\\.')}[^\\n]*older than[^\\n]*99\\.0\\.0`));
  assert.match(update.stdout, /--registry=https:\/\/registry\.npmjs\.org\//);
});

test('doctor prints the running and installed versions when they match', async () => {
  const root = await project();
  await installed(root);
  const doctor = run(root, 'doctor');
  assert.equal(doctor.status, 0, doctor.stdout + doctor.stderr);
  assert.ok(doctor.stdout.includes(`PASS  Kit version: CLI ${version}, installed ${version}`), doctor.stdout);
});

test('doctor warns but passes when the install is older than the CLI', async () => {
  const root = await project();
  await installed(root);
  await setInstalledVersion(root, '5.0.3');
  await reformat(path.join(root, '.ai-workflow/bin/check.mjs'));
  const doctor = run(root, 'doctor');
  assert.equal(doctor.status, 0, doctor.stdout + doctor.stderr);
  assert.ok(doctor.stdout.includes(`WARN  Kit version: CLI ${version}, installed 5.0.3`), doctor.stdout);
  assert.match(doctor.stdout, /run init/i);
  // Every file differs between releases; per-file lines would only repeat "run init".
  assert.doesNotMatch(doctor.stdout, /Mixed version/);
});

test('doctor fails when the CLI is older than the install', async () => {
  const root = await project();
  await installed(root);
  await setInstalledVersion(root, '99.0.0');
  const doctor = run(root, 'doctor');
  assert.equal(doctor.status, 1, doctor.stdout + doctor.stderr);
  assert.ok(doctor.stdout.includes(`FAIL  Kit version: CLI ${version}, installed 99.0.0`), doctor.stdout);
  assert.match(doctor.stdout, /npx --registry=https:\/\/registry\.npmjs\.org\/ @pazmo\/ai-workflow-kit@99\.0\.0 doctor/);
});

test('an upgrade that keeps a formatted checker reports a mixed-version install', async () => {
  const root = await project();
  await installed(root);
  await setInstalledVersion(root, '3.1.1');
  await reformat(path.join(root, '.ai-workflow/bin/check.mjs'));

  const update = await installed(root);
  assert.ok(update.stdout.includes(`Updated AI Workflow Kit 3.1.1 → ${version}.`), update.stdout);
  assert.match(update.stdout, /Preserved modified files: \.ai-workflow\/bin\/check\.mjs/);
  assert.match(update.stdout, new RegExp(`WARNING  Mixed-version install[^\\n]*${version.replaceAll('.', '\\.')}`));
  assert.match(update.stdout, /delete[^\n]*re-run init/);

  const doctor = run(root, 'doctor');
  assert.equal(doctor.status, 0, doctor.stdout + doctor.stderr);
  assert.match(doctor.stdout, /PASS\s+Checker: \.ai-workflow\/bin\/check\.mjs/, 'the file is present, so existence still passes');
  assert.ok(doctor.stdout.includes(`WARN  Mixed version: .ai-workflow/bin/check.mjs differs from ${version}`), doctor.stdout);
  assert.match(doctor.stdout, /delete[^\n]*re-run init/);
});

test('deleting the kept file and re-running init clears the mixed-version warning', async () => {
  const root = await project();
  await installed(root);
  const checker = path.join(root, '.ai-workflow/bin/check.mjs');
  await reformat(checker);
  assert.match(run(root, 'doctor').stdout, /Mixed version: \.ai-workflow\/bin\/check\.mjs/);

  await rm(checker);
  const repair = await installed(root);
  assert.doesNotMatch(repair.stdout, /Preserved modified files|Mixed-version/);
  assert.equal(await readFile(checker, 'utf8'), await readFile(path.join(packageRoot, 'assets/check.mjs'), 'utf8'));
  const doctor = run(root, 'doctor');
  assert.equal(doctor.status, 0, doctor.stdout + doctor.stderr);
  assert.doesNotMatch(doctor.stdout, /Mixed version|WARN/);
});

test('doctor names the graph runtime directory and the file inside it that differs', async () => {
  const root = await project();
  await installed(root);
  await reformat(path.join(root, '.ai-workflow/graph/executor.mjs'));
  await reformat(path.join(root, '.ai-workflow/bin/graph.mjs'));
  const doctor = run(root, 'doctor');
  assert.equal(doctor.status, 0, doctor.stdout + doctor.stderr);
  assert.ok(doctor.stdout.includes(`WARN  Mixed version: .ai-workflow/graph differs from ${version} (executor.mjs)`), doctor.stdout);
  assert.ok(doctor.stdout.includes(`WARN  Mixed version: .ai-workflow/bin/graph.mjs differs from ${version}`), doctor.stdout);
});

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { installWorkflow, removeWorkflow } from '../src/install.mjs';

const packageRoot = path.resolve(import.meta.dirname, '..');

async function fixture() {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'workflow-atomic-')));
  await fs.writeFile(path.join(root, 'AGENTS.md'), '# Existing rules\n');
  await fs.writeFile(path.join(root, 'CLAUDE.md'), '# Existing Claude rules\n');
  return root;
}

async function snapshot(root) {
  const result = {};
  async function visit(dir) {
    for (const name of (await fs.readdir(dir)).sort()) {
      const file = path.join(dir, name);
      const stat = await fs.lstat(file);
      const relative = path.relative(root, file);
      result[relative] = stat.isSymbolicLink() ? { link: await fs.readlink(file) }
        : stat.isDirectory() ? { directory: true, mode: stat.mode }
          : { bytes: (await fs.readFile(file)).toString('base64'), mode: stat.mode };
      if (stat.isDirectory()) await visit(file);
    }
  }
  await visit(root);
  return result;
}

test('a blocked skill parent leaves every existing path byte-for-byte unchanged', async () => {
  const root = await fixture();
  await fs.writeFile(path.join(root, '.agents'), 'not a directory');
  const before = await snapshot(root);
  await assert.rejects(installWorkflow({ root, hosts: ['codex'] }), /directory|ENOTDIR|EEXIST/i);
  assert.deepEqual(await snapshot(root), before);
});

test('a missing package asset leaves no instructions, skills, templates or config behind', async () => {
  const root = await fixture();
  const broken = await fs.mkdtemp(path.join(os.tmpdir(), 'workflow-broken-source-'));
  await fs.cp(path.join(packageRoot, 'skills'), path.join(broken, 'skills'), { recursive: true });
  await fs.copyFile(path.join(packageRoot, 'package.json'), path.join(broken, 'package.json'));
  const before = await snapshot(root);
  await assert.rejects(installWorkflow({ root, packageRoot: broken }), /ENOENT|missing/i);
  assert.deepEqual(await snapshot(root), before);
});

test('a mid-commit failure restores files, removed host trees, modes and empty parents', async (t) => {
  const root = await fixture();
  await installWorkflow({ root });
  await fs.chmod(path.join(root, 'AGENTS.md'), 0o640);
  const before = await snapshot(root);
  const rename = fs.rename;
  let injected = false;
  t.mock.method(fs, 'rename', async (source, target) => {
    if (!injected && target === path.join(root, '.ai-workflow/config.json')) {
      injected = true;
      throw Object.assign(new Error('EIO: injected commit failure'), { code: 'EIO' });
    }
    return rename(source, target);
  });
  await assert.rejects(installWorkflow({ root, hosts: ['codex'] }), /injected commit failure/);
  assert.equal(injected, true);
  assert.deepEqual(await snapshot(root), before);
});

test('instruction and managed-tree symlinks are refused without touching their targets', async () => {
  for (const relative of ['AGENTS.md', '.agents', 'templates/ai-workflow/STORY.md']) {
    const root = await fixture();
    const outside = await fixture();
    const target = path.join(root, relative);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.rm(target, { force: true });
    await fs.symlink(relative === '.agents' ? outside : path.join(outside, 'AGENTS.md'), target);
    const before = await snapshot(root);
    const outsideBefore = await snapshot(outside);
    await assert.rejects(installWorkflow({ root }), /symlink/i);
    assert.deepEqual(await snapshot(root), before);
    assert.deepEqual(await snapshot(outside), outsideBefore);
  }
});

test('concurrent installers never interleave their changes', async () => {
  const root = await fixture();
  const results = await Promise.allSettled([
    installWorkflow({ root, hosts: ['codex'] }), installWorkflow({ root, hosts: ['claude'] }),
  ]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.match(results.find((result) => result.status === 'rejected').reason.message, /in progress|locked/i);
  const config = JSON.parse(await fs.readFile(path.join(root, '.ai-workflow/config.json'), 'utf8'));
  const winner = config.hosts[0];
  const installed = await snapshot(root);
  assert.equal(Boolean(installed['.agents/skills/workflow/SKILL.md']), winner === 'codex');
  assert.equal(Boolean(installed['.claude/skills/workflow/SKILL.md']), winner === 'claude');
});

test('process interruption and rollback failure recover originals before the next attempt', async () => {
  for (const mode of ['crash', 'rollback-failure']) {
    for (const existing of [false, true]) {
      const root = await fixture();
      if (existing) await installWorkflow({ root });
      const before = await snapshot(root);
      const child = spawnSync(process.execPath, [path.join(packageRoot, 'test/fixtures/interrupt-install.mjs'), root, mode], { encoding: 'utf8' });
      assert.equal(child.status, mode === 'crash' ? 73 : 1, child.stderr);
      assert.equal(Boolean((await snapshot(root))['.ai-workflow-install']), true);
      // The next init recovers the transaction before discovering the bad source.
      await assert.rejects(installWorkflow({ root, packageRoot: path.join(root, 'missing-source') }));
      assert.deepEqual(await snapshot(root), before);
      await installWorkflow({ root });
      assert.equal(Boolean((await snapshot(root))['.ai-workflow-install']), false);
    }
  }
});

test('corrupt backups and malformed journals stop recovery without changing live files', async () => {
  for (const corruption of ['backup', 'journal']) {
    const root = await fixture();
    const child = spawnSync(process.execPath, [path.join(packageRoot, 'test/fixtures/interrupt-install.mjs'), root, 'crash'], { encoding: 'utf8' });
    assert.equal(child.status, 73, child.stderr);
    const directory = path.join(root, '.ai-workflow-install');
    if (corruption === 'backup') await fs.writeFile(path.join(directory, 'backup/AGENTS.md'), '# Corrupt backup\n');
    else {
      const file = path.join(directory, 'journal.json');
      const journal = JSON.parse(await fs.readFile(file, 'utf8'));
      delete journal.entries[0].before;
      await fs.writeFile(file, JSON.stringify(journal));
    }
    const before = await snapshot(root);
    await assert.rejects(installWorkflow({ root }), /backup|journal|recovery/i);
    assert.deepEqual(await snapshot(root), before);
  }
});

test('user edits during staging survive the refused commit', async (t) => {
  const root = await fixture();
  const cp = fs.cp;
  let edited = false;
  t.mock.method(fs, 'cp', async (...args) => {
    const result = await cp(...args);
    if (!edited) { edited = true; await fs.writeFile(path.join(root, 'AGENTS.md'), '# Concurrent user edit\n'); }
    return result;
  });
  await assert.rejects(installWorkflow({ root }), /changed during installation/);
  assert.equal(await fs.readFile(path.join(root, 'AGENTS.md'), 'utf8'), '# Concurrent user edit\n');
  assert.deepEqual((await fs.readdir(root)).sort(), ['AGENTS.md', 'CLAUDE.md']);
});

test('a user edit at the commit rename is restored instead of discarded with the backup', async (t) => {
  const root = await fixture();
  const rename = fs.rename;
  let edited = false;
  t.mock.method(fs, 'rename', async (source, target) => {
    if (!edited && source === path.join(root, 'AGENTS.md')) {
      edited = true;
      await fs.writeFile(source, '# User edit just before commit\n');
    }
    return rename(source, target);
  });
  await assert.rejects(installWorkflow({ root }), /changed during installation/);
  assert.equal(await fs.readFile(path.join(root, 'AGENTS.md'), 'utf8'), '# User edit just before commit\n');
  assert.deepEqual((await fs.readdir(root)).sort(), ['AGENTS.md', 'CLAUDE.md']);
});

test('recovery refuses to erase edits made after an interrupted install', async () => {
  const root = await fixture();
  const child = spawnSync(process.execPath, [path.join(packageRoot, 'test/fixtures/interrupt-install.mjs'), root, 'crash']);
  assert.equal(child.status, 73);
  await fs.writeFile(path.join(root, 'AGENTS.md'), '# Work done after the crash\n');
  await assert.rejects(installWorkflow({ root }), /recovery|changed|modified/i);
  assert.equal(await fs.readFile(path.join(root, 'AGENTS.md'), 'utf8'), '# Work done after the crash\n');
  assert.equal(await fs.readFile(path.join(root, '.ai-workflow-install/backup/AGENTS.md'), 'utf8'), '# Existing rules\n');
  await fs.rename(path.join(root, 'AGENTS.md'), path.join(root, 'saved-user-edit.md'));
  await installWorkflow({ root });
  assert.equal(await fs.readFile(path.join(root, 'saved-user-edit.md'), 'utf8'), '# Work done after the crash\n');
});

test('remove cannot interleave with install or another remove', async (t) => {
  const root = await fixture();
  await installWorkflow({ root });
  const rename = fs.rename;
  let attempted = false;
  t.mock.method(fs, 'rename', async (source, target) => {
    await rename(source, target);
    if (!attempted && source === path.join(root, 'CLAUDE.md')) {
      attempted = true;
      await assert.rejects(removeWorkflow({ root }), /in progress|locked/i);
    }
  });
  await installWorkflow({ root, hosts: ['codex'] });
  assert.equal(attempted, true);
  t.mock.restoreAll();
  const results = await Promise.allSettled([removeWorkflow({ root }), removeWorkflow({ root })]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.deepEqual((await fs.readdir(root)).sort(), ['AGENTS.md', 'CLAUDE.md']);
});

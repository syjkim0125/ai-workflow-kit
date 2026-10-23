import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { createSnapshot } from '../src/graph/snapshot.mjs';

async function fixture(t, git = false) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'workflow-snapshot-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const put = async (file, body) => { await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true }); await fs.writeFile(path.join(root, file), body); };
  await put('app.mjs', 'export const value = 1;\n');
  if (git) {
    assert.equal(spawnSync('git', ['init', '-q'], { cwd: root }).status, 0);
    assert.equal(spawnSync('git', ['add', 'app.mjs'], { cwd: root }).status, 0);
  }
  return { root, put, snapshot: options => createSnapshot({ root, inputs: ['app.mjs'], ...options }) };
}

test('snapshot detects changed, missing, binary and executable product inputs', async t => {
  const f = await fixture(t);
  const first = await f.snapshot();
  assert.equal((await f.snapshot()).fingerprint, first.fingerprint);
  await f.put('app.mjs', Buffer.from([0xff, 0x00]));
  const binary = await f.snapshot();
  assert.notEqual(binary.fingerprint, first.fingerprint);
  await f.put('app.mjs', Buffer.from([0xfe, 0x00]));
  assert.notEqual((await f.snapshot()).fingerprint, binary.fingerprint);
  const beforeMode = await f.snapshot();
  await fs.chmod(path.join(f.root, 'app.mjs'), 0o755);
  assert.notEqual((await f.snapshot()).fingerprint, beforeMode.fingerprint);
  await fs.rm(path.join(f.root, 'app.mjs'));
  assert.notEqual((await f.snapshot()).fingerprint, first.fingerprint);
});

test('snapshot ignores dedicated evidence but includes new Git inputs and index changes', async t => {
  const f = await fixture(t, true);
  const first = await f.snapshot();
  await f.put('.ai-workflow/evidence/run/stdout', 'new observation');
  await f.put('.ai-workflow/runs/run.json', '{}');
  assert.equal((await f.snapshot()).fingerprint, first.fingerprint);
  await f.put('new.mjs', 'new input');
  const added = await f.snapshot();
  assert.notEqual(added.fingerprint, first.fingerprint);
  assert.equal(spawnSync('git', ['add', 'new.mjs'], { cwd: f.root }).status, 0);
  assert.notEqual((await f.snapshot()).fingerprint, added.fingerprint);
});

test('snapshot requires explicit non-Git inputs and refuses output inputs and escaping links', async t => {
  const f = await fixture(t);
  await assert.rejects(createSnapshot({ root: f.root }), /inputs.*non.git|non.git.*inputs/i);
  await f.put('.ai-workflow/evidence/product', 'product');
  await assert.rejects(f.snapshot({ inputs: ['.ai-workflow/evidence/product'] }), /output|evidence/i);
  await fs.symlink(os.tmpdir(), path.join(f.root, 'outside'));
  await assert.rejects(f.snapshot({ inputs: ['outside'] }), /symlink|outside|escape/i);
  await assert.rejects(f.snapshot({ inputs: ['../outside'] }), /relative|escape/i);
});

test('snapshot fingerprints canonical Story requirements without mutable gate metadata', async t => {
  const f = await fixture(t);
  await f.put('story.md', '# Story: test\nStatus: Approved\n## MUST\n- M1. Works.\n');
  const first = await f.snapshot({ story: 'story.md' });
  await f.put('story.md', '# Story: test\nStatus: Delivered\n## MUST\n- M1. Works.\nG4: PASS — human response\n');
  assert.equal((await f.snapshot({ story: 'story.md' })).fingerprint, first.fingerprint);
  await f.put('story.md', '# Story: test\nStatus: Approved\n## MUST\n- M1. Different.\n');
  assert.notEqual((await f.snapshot({ story: 'story.md' })).fingerprint, first.fingerprint);
});

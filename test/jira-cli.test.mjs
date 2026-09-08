import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import test from 'node:test';

const cli = path.resolve(import.meta.dirname, '../bin/ai-workflow-kit.mjs');

test('CLI Jira preview renders readable sections without a connector or side effects', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'workflow-preview-cli-'));
  const story = '# Story: small example\nStatus: Draft\nOwner: fixture\n\n' + [
    ['Goal', 'Publish visibly.'], ['Domain', 'Story is canonical.'], ['MUST', '- M1. Stay read only.'],
    ['SHOULD', 'N/A: minimal fixture.'], ['OUT', 'No issue creation.'],
    ['Decisions', 'ASSUMED: no connector.'], ['Verify', '- V1 [M1]. Read without writes.'],
  ].map(([heading, text]) => `## ${heading}\n${text}\n`).join('\n');
  await writeFile(path.join(root, 'story.md'), story);
  const run = (...args) => spawnSync(process.execPath, [cli, ...args, '--root', root], { encoding: 'utf8' });
  const preview = run('jira', 'preview', 'story.md');
  assert.equal(preview.status, 0, preview.stderr);
  assert.match(preview.stdout, /PREVIEW.*no issue created/i);
  assert.match(preview.stdout, /## Goal[\s\S]*## Domain[\s\S]*## MUST[\s\S]*## SHOULD[\s\S]*## OUT[\s\S]*## Decisions[\s\S]*## Verify/);
  assert.match(preview.stdout, /V1 \[M1\]/);
  assert.deepEqual(await readdir(root), ['story.md']);
  assert.notEqual(run('jira', 'publish', 'story.md').status, 0);
  assert.notEqual(run('jira', 'preview', 'story.md', '--publish').status, 0);
});

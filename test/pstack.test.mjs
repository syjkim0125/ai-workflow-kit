import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { digest } from '../src/graph/storage.mjs';
import { installWorkflow } from '../src/install.mjs';
import { graphProject } from './fixtures/graph-project.mjs';

const root = path.resolve(import.meta.dirname, '..');
test('pinned Pstack reference bytes, license and relative feature-map dependencies ship intact', async t => {
  const base = path.join(root, 'skills/workflow/references/pstack');
  const provenance = JSON.parse(await fs.readFile(path.join(base, 'provenance.json')));
  assert.equal(provenance.commit, '0c3333f09655d7933919795fbf4f9946d62b6f77');
  for (const file of provenance.files) assert.equal(digest(await fs.readFile(path.join(base, file.file))), file.sha256);
  assert.match(await fs.readFile(path.join(base, 'LICENSE'), 'utf8'), /MIT License[\s\S]*Lauren Tan/);
  for (const host of ['codex', 'claude']) {
    const f = await graphProject(t);
    await installWorkflow({ root: f.root, hosts: [host] });
    const installed = path.join(f.root, host === 'codex' ? '.agents' : '.claude', 'skills/workflow/references/pstack');
    for (const file of provenance.files) assert.equal(digest(await fs.readFile(path.join(installed, file.file))), file.sha256);
  }
});

test('verification example drives the actual CLI success and failure path', () => {
  const result = spawnSync(process.execPath, ['examples/verification/prove.mjs'], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /PASS CLI/);
});

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { installWorkflow } from '../src/install.mjs';

const packageRoot = path.resolve(import.meta.dirname, '..');
const read = (file) => fs.readFile(path.join(packageRoot, file), 'utf8');
const hosts = [['.agents', 'AGENTS.md'], ['.claude', 'CLAUDE.md']];
const references = ['SKILL.md', 'references/execution.md', 'EVALS.md'];

test('execution puts a bounded simplification pass before final-diff review and revalidation', async () => {
  const execution = await read('skills/workflow/references/execution.md');
  const steps = execution.slice(execution.indexOf('## Execute'));
  const stages = ['related tests pass', 'ce-simplify-code', 'final diff', 'Revalidate', 'understanding-gate.md'];
  let previous = -1;
  for (const stage of stages) {
    const index = steps.indexOf(stage);
    assert.ok(index > previous, `${stage} must follow the previous stage`);
    previous = index;
  }
  // This checks routing/contract structure, not whether an LLM obeys it.
  assert.match(execution, /read.*SKILL\.md.*execute/i);
  assert.match(execution, /unavailable.*same criteria.*directly/i);
  assert.match(execution, /no changes.*valid/i);
  assert.match(execution, /result order.*side effects.*domain boundaries.*failure handling.*safety checks/i);
  assert.match(execution, /chaining.*traversals/i);
  assert.match(execution, /existing.*design.*scope-change/i);
  assert.match(execution, /repository.*runtime.*instructions/i);
  assert.doesNotMatch(execution, /(?:spawn|launch|dispatch) (?:three|3) agents/i);
  assert.match(await read('skills/workflow/SKILL.md'), /Implemented or `finish`:.*execution\.md.*understanding-gate\.md/);
});

test('fresh installs carry the same simplify policy into both runtimes', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'workflow-simplify-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await installWorkflow({ root });
  for (const [host, instruction] of hosts) {
    assert.match(await fs.readFile(path.join(root, instruction), 'utf8'), /ce-simplify-code/);
    for (const file of references) {
      assert.equal(await fs.readFile(path.join(root, host, 'skills/workflow', file), 'utf8'), await read(`skills/workflow/${file}`));
    }
    assert.match(await fs.readFile(path.join(root, host, 'skills/workflow/references/execution.md'), 'utf8'), /ce-simplify-code/);
  }
});

test('update replaces owned legacy instructions and references, preserves prose, then becomes idempotent', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'workflow-simplify-update-'));
  const legacy = await fs.mkdtemp(path.join(os.tmpdir(), 'workflow-legacy-source-'));
  t.after(async () => {
    await fs.rm(root, { recursive: true, force: true });
    await fs.rm(legacy, { recursive: true, force: true });
  });
  for (const file of ['skills', 'assets', 'package.json']) {
    await fs.cp(path.join(packageRoot, file), path.join(legacy, file), { recursive: true });
  }
  await fs.writeFile(path.join(legacy, 'skills/workflow/references/execution.md'), '# Legacy execution\nRefactor while green.\n');
  await fs.writeFile(path.join(legacy, 'skills/workflow/SKILL.md'), '# Legacy routing\nFinish goes directly to G4.\n');
  await fs.writeFile(path.join(legacy, 'skills/workflow/EVALS.md'), '# Legacy evaluations\n');
  await installWorkflow({ root, packageRoot: legacy });
  for (const [, instruction] of hosts) {
    await fs.writeFile(path.join(root, instruction), '# Team rules\n\n<!-- BEGIN ai-workflow-kit -->\nOld instructions\n<!-- END ai-workflow-kit -->\n\nKeep this footer.\n');
  }
  assert.equal((await installWorkflow({ root })).changed, true);
  for (const [host, instruction] of hosts) {
    const text = await fs.readFile(path.join(root, instruction), 'utf8');
    assert.match(text, /^# Team rules/);
    assert.match(text, /Keep this footer\./);
    assert.match(text, /ce-simplify-code/);
    assert.equal(text.split('<!-- BEGIN ai-workflow-kit -->').length, 2);
    for (const file of references) {
      assert.equal(await fs.readFile(path.join(root, host, 'skills/workflow', file), 'utf8'), await read(`skills/workflow/${file}`));
    }
  }
  assert.equal((await installWorkflow({ root })).changed, false);
});

test('updates report and preserve a user-edited execution reference instead of forcing alignment', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'workflow-simplify-owned-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await installWorkflow({ root });
  const file = path.join(root, '.agents/skills/workflow/references/execution.md');
  await fs.writeFile(file, '# Team-owned execution\n');
  const result = await installWorkflow({ root });
  assert.ok(result.preserved.includes('.agents/skills/workflow'));
  assert.equal(await fs.readFile(file, 'utf8'), '# Team-owned execution\n');
});

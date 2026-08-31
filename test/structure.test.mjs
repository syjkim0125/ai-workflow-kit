import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => readFile(path.join(root, relative), 'utf8');
const nonEmptyLines = (text) => text.split(/\r?\n/).filter((line) => line.trim()).length;
const wordCount = (text) => text.trim().split(/\s+/).filter(Boolean).length;

test('package exposes a zero-dependency Node CLI', async () => {
  const pkg = JSON.parse(await read('package.json'));
  assert.equal(pkg.name, '@pazmo/ai-workflow-kit');
  assert.equal(pkg.type, 'module');
  assert.equal(pkg.bin['ai-workflow-kit'], 'bin/ai-workflow-kit.mjs');
  assert.deepEqual(pkg.dependencies ?? {}, {});
  assert.match(pkg.engines.node, />=20/);
});

test('one concise workflow skill progressively discloses stage references', async () => {
  const skill = await read('skills/workflow/SKILL.md');
  assert.match(skill, /^---\nname: workflow\ndescription: Use when /);
  assert.ok(wordCount(skill) <= 260, `SKILL.md has ${wordCount(skill)} words`);
  for (const ref of ['intake.md', 'execution.md', 'understanding-gate.md', 'domain-risks.md']) {
    assert.match(skill, new RegExp(ref.replace('.', '\\.')));
    await read(`skills/workflow/references/${ref}`);
  }
  assert.match(skill, /\$ARGUMENTS/);
});

test('story contract keeps one human-readable source of truth', async () => {
  const story = await read('skills/workflow/assets/STORY.md');
  for (const heading of ['## Goal', '## Domain', '## MUST', '## SHOULD', '## OUT', '## Decisions', '## Verify']) {
    assert.match(story, new RegExp(heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.doesNotMatch(story, /Implementation approach|Change surfaces/);
  assert.ok(nonEmptyLines(story) <= 36, `Story template has ${nonEmptyLines(story)} non-empty lines`);
});

test('task is one-screen and does not duplicate the implementation plan', async () => {
  const task = await read('skills/workflow/assets/TASK.md');
  assert.ok(nonEmptyLines(task) <= 30, `Task template has ${nonEmptyLines(task)} non-empty lines`);
  assert.match(task, /Covers.*M\/V IDs|M\/V IDs/);
  assert.doesNotMatch(task, /Implementation approach|Change surfaces|API \/ data contract|Parallelizable/);
});

test('intake limits questions and surfaces assumptions', async () => {
  const intake = await read('skills/workflow/references/intake.md');
  assert.match(intake, /only blocking/i);
  assert.match(intake, /at most three/i);
  assert.match(intake, /two question rounds/i);
  assert.match(intake, /ASSUMED/);
  assert.match(intake, /never ask.*HOW|Do not ask.*implementation/is);
  assert.match(intake, /MUST.*SHOULD.*OUT/is);
});

test('execution routes to Compound Engineering without duplicating ce-plan', async () => {
  const execution = await read('skills/workflow/references/execution.md');
  assert.match(execution, /ce-plan/);
  assert.match(execution, /ce-work/);
  assert.match(execution, /ce-code-review/);
  assert.match(execution, /Plan source: N\/A/);
  assert.match(execution, /high-risk|high risk/i);
  assert.match(execution, /HOW belongs to|HOW.*plan/is);
});

test('G4 forces prediction before explanation and checks evidence boundaries', async () => {
  const gate = await read('skills/workflow/references/understanding-gate.md');
  const rawIndex = gate.indexOf('raw diff');
  const askIndex = gate.indexOf('END THE TURN');
  const revealIndex = gate.indexOf('compare');
  assert.ok(rawIndex >= 0 && askIndex > rawIndex && revealIndex > askIndex);
  assert.match(gate, /behavior/i);
  assert.match(gate, /invariant|failure path/i);
  assert.match(gate, /unproven|evidence boundary/i);
  assert.match(gate, /restatement/i);
  assert.match(gate, /G4: PASS/);
});

test('distribution manifests point at the canonical skill', async () => {
  const plugin = JSON.parse(await read('.claude-plugin/plugin.json'));
  const codexPlugin = JSON.parse(await read('.codex-plugin/plugin.json'));
  const marketplace = JSON.parse(await read('.claude-plugin/marketplace.json'));
  assert.equal(plugin.name, 'ai-workflow-kit');
  assert.ok(Array.isArray(plugin.skills) && plugin.skills.includes('./skills/'));
  assert.equal(codexPlugin.name, 'ai-workflow-kit');
  assert.equal(codexPlugin.skills, './skills/');
  assert.equal(marketplace.plugins[0].source, '.');
  assert.equal(marketplace.plugins[0].name, 'ai-workflow-kit');
  await read('skills/workflow/agents/openai.yaml');
});

test('README documents invocation or selection behavior for each supported host', async () => {
  const readme = await read('README.md');
  assert.match(readme, /Claude[^\n]*\/workflow/);
  assert.match(readme, /Codex[^\n]*\$workflow/);
  assert.match(readme, /ChatGPT[^\n]*(자동|automatically)/i);
});

test('gate references and the managed block name the checker command, not just the rule', async () => {
  // A checker nobody is told to run enforces nothing. Each gate reference, and the
  // always-on block that survives session boundaries and context compaction, must
  // carry the literal command — not prose like "the checker passes".
  const command = /check\.mjs\b/;
  const reportExit = /exit code/i;

  const intake = await read('skills/workflow/references/intake.md');
  assert.match(intake, command, 'intake.md must name the checker command for G1');
  assert.match(intake, reportExit, 'intake.md must ask for the exit code');

  const gate = await read('skills/workflow/references/understanding-gate.md');
  assert.match(gate, command, 'understanding-gate.md must name the checker command for G4');
  assert.match(gate, reportExit, 'understanding-gate.md must ask for the exit code');

  const { MANAGED_BLOCK } = await import('../src/managed-block.mjs');
  assert.match(MANAGED_BLOCK, command, 'the managed block must name the checker command');
});

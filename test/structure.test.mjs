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
  assert.ok(nonEmptyLines(story) <= 37, `Story template has ${nonEmptyLines(story)} non-empty lines`);
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

test('risk lenses shape intake before G1 and keep migration choices blocking', async () => {
  const skill = await read('skills/workflow/SKILL.md');
  const intakeRoute = skill.split('\n').find((line) => line.includes('No approved Story'));
  assert.match(intakeRoute, /domain-risks\.md/);
  const intake = await read('skills/workflow/references/intake.md');
  assert.match(intake, /domain-risks\.md/);
  assert.match(intake, /Payment\/money.*migration.*`OPEN BLOCKING`, never `ASSUMED`/is);
  const risks = await read('skills/workflow/references/domain-risks.md');
  const migration = risks.split(/^## /m).find((section) => /^Data or system migration/.test(section));
  assert.ok(migration, 'migration lens covers system switches');
  for (const item of [/coexist/, /rollback trigger/, /fails open/, /closed/, /disagree/, /deploy order/]) {
    assert.match(migration, item);
  }
});

test('execution defaults to focused Superpowers stages and keeps CE planning and review as explicit alternatives', async () => {
  const execution = await read('skills/workflow/references/execution.md');
  for (const skill of ['writing-plans', 'test-driven-development', 'requesting-code-review', 'verification-before-completion']) {
    assert.match(execution, new RegExp(`superpowers:${skill}`));
  }
  const normal = execution.split('\n').find((line) => line.startsWith('- **Normal:**'));
  assert.doesNotMatch(normal, /ce-plan|ce-code-review/);
  assert.match(execution, /Plan source: N\/A/);
  assert.match(execution, /high-risk|high risk/i);
  assert.match(execution, /HOW belongs to|HOW.*plan/is);

  const integration = await read('skills/workflow/references/skill-integration.md');
  const row = (role) => integration.split('\n').find((line) => line.startsWith(`| ${role}`));
  assert.match(row('Team lead'), /superpowers:writing-plans/);
  assert.match(row('Reviewer'), /superpowers:requesting-code-review/);
  assert.match(integration, /Skip the Execution Handoff/);
  assert.match(integration, /explicitly selects CE planning.*`ce-plan`/s);
  assert.match(integration, /explicitly selects? CE review.*`ce-code-review mode:agent/s);

  const { MANAGED_BLOCK } = await import('../src/managed-block.mjs');
  assert.doesNotMatch(MANAGED_BLOCK, /CE caller-owned planning|CE review/);
  assert.doesNotMatch(await read('src/graph/roles.mjs'), /CE planning|CE review/);
});

test('intake shows divergent behavior options itself', async () => {
  const intake = await read('skills/workflow/references/intake.md');
  assert.match(intake, /two or three options/i);
  assert.match(intake, /trade-off/i);
  assert.match(intake, /recommended default/i);
});

test('ce-brainstorm runs only for an open idea or an explicit selection, announced and returned to the kit', async () => {
  const integration = await read('skills/workflow/references/skill-integration.md');
  const pm = integration.split('\n').find((line) => line.startsWith('| PM'));
  assert.doesNotMatch(pm, /material unresolved alternatives/);
  assert.match(integration, /goal or problem but no concrete change/i);
  assert.match(integration, /(does|do) not know what to build/i);
  assert.match(integration, /announce the choice/i);
  assert.match(integration, /Caller-owned exploration/);
  assert.match(integration, /do not show a next-step handoff menu/i);
});

test('payment lens asks how a changed charge is rolled back', async () => {
  const risks = await read('skills/workflow/references/domain-risks.md');
  const payment = risks.split(/^## /m).find((section) => /^Payment/.test(section));
  assert.match(payment, /rollback/i);
});

test('G4 forces prediction before explanation and checks evidence boundaries', async () => {
  const gate = await read('skills/workflow/references/understanding-gate.md');
  // Prediction before reveal is the human-restatement procedure; check its order inside that section.
  const restatement = gate.slice(gate.indexOf('## Mode `human-restatement`'));
  const rawIndex = restatement.indexOf('raw diff');
  const askIndex = restatement.indexOf('END THE TURN');
  const revealIndex = restatement.indexOf('compare');
  assert.ok(rawIndex >= 0 && askIndex > rawIndex && revealIndex > askIndex);
  assert.match(gate, /behavior/i);
  assert.match(gate, /invariant|failure path/i);
  assert.match(gate, /unproven|evidence boundary/i);
  assert.match(gate, /restatement/i);
  assert.match(gate, /G4: PASS/);
  // Two modes: an AI summary the human approves by default, human restatement on request and for G3 work.
  assert.match(gate, /## Mode `ai-summary`/);
  assert.match(gate, /## Mode `human-restatement`/);
  for (const label of ['사용자가 겪는 변화', '지킨 규칙과 실패할 때 동작', '확인한 테스트', '확인하지 못한 것']) {
    assert.ok(gate.includes(label), label);
  }
  assert.match(gate, /G4: APPROVED/);
  assert.match(gate, /G3[^\n]*human-restatement|human-restatement[^\n]*G3/);
  const skill = await read('skills/workflow/SKILL.md');
  assert.match(skill, /ai-summary/);
  assert.doesNotMatch(skill, /Keep G4 prediction-before-reveal intact/);
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

  // `check story` only enforces a gate once Status says the gate should exist. The
  // strict form names the gate outright, so it cannot pass by being run too early.
  assert.match(intake, /check\.mjs gate G1/, 'intake.md must run the strict G1 check');
  assert.match(gate, /check\.mjs gate G4/, 'understanding-gate.md must run the strict G4 check');

  const { MANAGED_BLOCK } = await import('../src/managed-block.mjs');
  assert.match(MANAGED_BLOCK, command, 'the managed block must name the checker command');
});

test('the shipped Story template uses the v2 layout and a record footer', async () => {
  const { STORY_LAYOUTS } = await import('../assets/check.mjs');
  const story = await read('skills/workflow/assets/STORY.md');
  const headings = [...story.matchAll(/^##\s+(.+?)\s*$/gmu)].map((match) => match[1]);
  assert.deepEqual(headings, [...STORY_LAYOUTS.v2]);
  for (const label of ['1. As-is:', '2. To-be:', '3. Unchanged:']) assert.ok(story.includes(label), label);
  const footer = story.slice(story.lastIndexOf('\n---\n'));
  assert.match(footer, /^Status:/mu);
  assert.match(footer, /^Understanding gate \(G4\):/mu);
  assert.match(footer, /^Lane: /mu);
});

const reference = (name) => read(`skills/workflow/references/${name}`);

test('SKILL.md routes the normal path through the model-facing fast path', async () => {
  const skill = await read('skills/workflow/SKILL.md');
  for (const state of ['No approved Story', 'Approved, not implemented', 'Implemented or']) {
    assert.match(skill.split('\n').find((line) => line.includes(state)), /fast-path\.md/, state);
  }
  const fast = await reference('fast-path.md');
  assert.ok(Buffer.byteLength(fast) <= 4800, `fast-path.md has ${Buffer.byteLength(fast)} bytes`);
  for (const command of ['approve G1', 'go', 'complete', 'approve G4', 'check', 'review']) assert.match(fast, new RegExp(`graph\\.mjs ${command}`));
  assert.match(fast, /one message/i);
  assert.match(fast, /model: haiku/);
  assert.match(fast, /model: sonnet/);
  assert.match(fast, /never read code/i);
  assert.match(fast, /never write a test runner/i);
  const minimal = await reference('graph-minimal.md');
  for (const command of ['go', 'begin', 'complete', 'delivery']) assert.match(minimal, new RegExp(`graph\\.mjs ${command}`));
  assert.match(await reference('graph-advanced.md'), /graph\.mjs record/);
  assert.ok(nonEmptyLines(await reference('graph-engineering.md')) <= 3);
  const light = await reference('light-lane.md');
  for (const command of ['light', 'check', 'review', 'delivery']) assert.match(light, new RegExp(`graph\\.mjs ${command}`));
  for (const rule of [/reversible/, /one module/, /external contract/, /persistent data/, /domain-risks\.md/]) assert.match(light, rule);
});

test('light lane reading is small', async () => {
  const files = ['skills/workflow/references/intake.md', 'skills/workflow/assets/STORY.md', 'skills/workflow/references/light-lane.md'];
  const bytes = (await Promise.all(files.map(read))).reduce((sum, text) => sum + Buffer.byteLength(text), 0);
  assert.ok(bytes < 12000, `light lane reading is ${bytes} bytes`);
});

test('model-selection names the implementer tier and escalation', async () => {
  const text = await reference('model-selection.md');
  for (const phrase of [/mid tier/, /two failed attempts/, /main model/]) assert.match(text, phrase);
});

test('execution limits tests to one per Verify item', async () => {
  const text = await reference('execution.md');
  assert.match(text, /one focused test per Verify item/i);
  assert.match(text, /second[^.]*distinct failure path/i);
});

test('intake delegates code reading to an exploration subagent', async () => {
  const text = await reference('intake.md');
  assert.match(text, /exploration subagent/);
  assert.match(text, /cheaper/);
  assert.match(text, /\bmap\b/);
  assert.match(text, /Lane: light/);
});

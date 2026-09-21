// Explicit release smoke check; never contacts Jira or starts a host application.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const tarball = path.resolve(process.argv[2]);
const expectedVersion = JSON.parse(await fs.readFile(new URL('../../package.json', import.meta.url))).version;
const root = await fs.mkdtemp(path.join(os.tmpdir(), 'workflow-tarball-'));
const npm = path.resolve(path.dirname(process.execPath), '../lib/node_modules/npm/bin/npm-cli.js');
for (const host of ['codex', 'claude']) {
  const install = path.join(root, host);
  const project = path.join(install, 'project');
  await fs.mkdir(project, { recursive: true });
  execFileSync(process.execPath, [npm, 'install', '--offline', '--ignore-scripts', '--no-audit', '--no-fund', '--prefix', install, '--cache', path.join(root, 'cache'), tarball]);
  const pkg = path.join(install, 'node_modules/@pazmo/ai-workflow-kit');
  const cli = (args) => execFileSync(process.execPath, [path.join(pkg, 'bin/ai-workflow-kit.mjs'), ...args, '--root', project], { encoding: 'utf8' });
  assert.equal(JSON.parse(await fs.readFile(path.join(pkg, 'package.json'))).version, expectedVersion);
  cli(['init', '--host', host]);
  const instruction = path.join(project, host === 'codex' ? 'AGENTS.md' : 'CLAUDE.md');
  const before = await fs.readFile(instruction, 'utf8');
  assert.ok(before.includes(host === 'codex' ? '$workflow' : '/workflow'));
  cli(['init', '--host', host]);
  assert.equal(await fs.readFile(instruction, 'utf8'), before);
  cli(['doctor']);
  const skill = path.join(project, host === 'codex' ? '.agents' : '.claude', 'skills/workflow/SKILL.md');
  await fs.access(skill);
  const graphCli = (args) => JSON.parse(execFileSync(process.execPath,
    [path.join(project, '.ai-workflow/bin/graph.mjs'), ...args], { cwd: project, encoding: 'utf8' }));
  // Synthetic approval is confined to this disposable release fixture.
  await fs.writeFile(path.join(project, 'approval.md'), 'Fixture approval evidence.');
  await fs.writeFile(path.join(project, 'story.md'), `# Story: tarball smoke check
Status: Approved
Owner: fixture owner
Understanding gate (G1): approval.md · 2026-09-19 · Check-in: accepted
## Goal
Exercise the installed graph.
## Domain
- Invariant: no external effects.
## MUST
- M1. Complete the fixture.
## SHOULD
- S1. Keep evidence.
## OUT
- O1. Real human approval.
## Decisions
- D1. Disposable fixture only.
## Verify
- V1 [M1]. All nodes have recorded fixture evidence.
`);
  let graphStatus = graphCli(['init', '-', '.ai-workflow/runs/smoke.json', 'story.md']);
  while (graphStatus.action === 'execute') {
    const ready = graphStatus.ready[0];
    const node = graphCli(['start', '.ai-workflow/runs/smoke.json', ready.id, ready.token]).started;
    await fs.writeFile(path.join(project, `${node.id}.txt`), `Fixture observation: ${node.id}`);
    await fs.writeFile(path.join(project, 'result.json'), JSON.stringify({ token: node.token,
      output: { summary: `Fixture ${node.id}`, evidence: [`${node.id}.txt`] }, evaluation: { passed: true } }));
    graphStatus = graphCli(['record', '.ai-workflow/runs/smoke.json', node.id, 'result.json']);
  }
  assert.equal(graphStatus.action, 'g4');
  assert.doesNotMatch(await fs.readFile(path.join(project, 'story.md'), 'utf8'), /G4: PASS|Status: Delivered/);
  const other = path.join(project, host === 'codex' ? '.claude' : '.agents');
  await assert.rejects(fs.access(other));
  const template = path.join(project, 'templates/ai-workflow/STORY.md');
  const modified = (await fs.readFile(template, 'utf8')) + '\nTeam-owned note.\n';
  await fs.writeFile(template, modified);
  cli(['init', '--host', host]);
  assert.equal(await fs.readFile(template, 'utf8'), modified);
  const api = await import(pathToFileURL(path.join(pkg, 'src/jira.mjs')));
  assert.equal(typeof api.publishStory, 'function');
  assert.equal(typeof api.formatStory, 'function');
  cli(['remove']);
  assert.equal(await fs.readFile(template, 'utf8'), modified);
  await assert.rejects(fs.access(skill));
  await assert.rejects(fs.access(path.join(project, '.ai-workflow-install')));
  await fs.access(path.join(project, '.ai-workflow/runs/smoke.json'));
  await assert.rejects(fs.access(path.join(project, '.ai-workflow/graph')));
  console.log(`PASS ${host}: offline tarball, init/update/doctor, graph execution through G4 readiness, preserved evidence, remove`);
}
console.log(`Fixtures retained: ${root}`);

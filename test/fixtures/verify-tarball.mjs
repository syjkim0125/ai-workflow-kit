// Explicit release smoke check; never contacts Jira or starts a host application.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
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
  const pstack = path.join(path.dirname(skill), 'references/pstack');
  const provenance = JSON.parse(await fs.readFile(path.join(pstack, 'provenance.json')));
  assert.equal(provenance.commit, '0c3333f09655d7933919795fbf4f9946d62b6f77');
  for (const file of provenance.files) {
    assert.equal(createHash('sha256').update(await fs.readFile(path.join(pstack, file.file))).digest('hex'), file.sha256);
  }
  const graphCli = (args) => JSON.parse(execFileSync(process.execPath,
    [path.join(project, '.ai-workflow/bin/graph.mjs'), ...args], { cwd: project, encoding: 'utf8' }));
  // Synthetic approval is confined to this disposable release fixture.
  const { storyContract } = await import(pathToFileURL(path.join(pkg, 'src/graph/workflow.mjs')));
  await fs.cp(path.join(pkg, 'examples/verification'), path.join(project, 'examples/verification'), {recursive:true});
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
  const storyText = await fs.readFile(path.join(project, 'story.md'), 'utf8');
  await fs.writeFile(path.join(project, 'approval.md'), JSON.stringify({gate:'G1', storyHash:storyContract(storyText).fingerprint, responseRef:'fixture:approved'}));
  const profile = JSON.parse(await fs.readFile(path.join(project, 'examples/verification/verification.json')));
  profile.checks[0].argv[0] = process.execPath;
  await fs.writeFile(path.join(project, '.ai-workflow/verification.json'), JSON.stringify(profile));
  const appFile = path.join(project, 'examples/verification/app.mjs');
  const goodApp = await fs.readFile(appFile, 'utf8');
  await fs.writeFile(appFile, goodApp.replace('Number(values[0]) + Number(values[1])', '0'));
  let observedFailure = false;
  let graphStatus = graphCli(['init', '-', '.ai-workflow/runs/smoke.json', 'story.md']);
  while (graphStatus.action === 'execute') {
    const ready = graphStatus.ready[0];
    const node = graphCli(['start', '.ai-workflow/runs/smoke.json', ready.id, ready.token]).started;
    await fs.writeFile(path.join(project, `${node.id}.txt`), `Fixture observation: ${node.id}`);
    await fs.writeFile(path.join(project, 'result.json'), JSON.stringify({ token: node.token,
      output: { summary: `Fixture ${node.id}`, evidence: [`${node.id}.txt`] }, evaluation: { passed: true } }));
    if (node.id === 'workflow-verify') {
      const execution = graphCli(['verify', '.ai-workflow/runs/smoke.json', node.id, node.token, 'addition']);
      if (!observedFailure) {
        assert.equal(execution.verification.passed, false);
        assert.throws(() => graphCli(['record', '.ai-workflow/runs/smoke.json', node.id, 'result.json']));
        await fs.writeFile(path.join(project, 'result.json'), JSON.stringify({ token: node.token,
          output: { summary: 'Observed failing addition', evidence: [`${node.id}.txt`] },
          evaluation: { passed: false, action: 'fix', feedback: 'Addition returned zero; correct the implementation.' } }));
        assert.equal(graphCli(['record', '.ai-workflow/runs/smoke.json', node.id, 'result.json']).action, 'fix');
        observedFailure = true;
        graphStatus = graphCli(['reset', '.ai-workflow/runs/smoke.json', 'implement', 'Fix failed addition']);
        await fs.writeFile(appFile, goodApp);
        continue;
      }
      assert.equal(execution.verification.passed, true);
    }
    graphStatus = graphCli(['record', '.ai-workflow/runs/smoke.json', node.id, 'result.json']);
  }
  assert.equal(graphStatus.action, 'g4');
  assert.equal(observedFailure, true);
  await fs.appendFile(appFile, '\n// changed after verification\n');
  assert.equal(graphCli(['status', '.ai-workflow/runs/smoke.json']).action, 'stale');
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
  console.log(`PASS ${host}: offline tarball, init/update/doctor, real failure/fix/pass/stale verification, preserved evidence, remove`);
}
console.log(`Fixtures retained: ${root}`);

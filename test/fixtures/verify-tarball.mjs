// Explicit release smoke check; never contacts Jira or starts a host application.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const tarball = path.resolve(process.argv[2]);
const root = await fs.mkdtemp(path.join(os.tmpdir(), 'workflow-tarball-'));
const npm = path.resolve(path.dirname(process.execPath), '../lib/node_modules/npm/bin/npm-cli.js');
for (const host of ['codex', 'claude']) {
  const install = path.join(root, host);
  const project = path.join(install, 'project');
  await fs.mkdir(project, { recursive: true });
  execFileSync(process.execPath, [npm, 'install', '--offline', '--ignore-scripts', '--no-audit', '--no-fund', '--prefix', install, '--cache', path.join(root, 'cache'), tarball]);
  const pkg = path.join(install, 'node_modules/@pazmo/ai-workflow-kit');
  const cli = (args) => execFileSync(process.execPath, [path.join(pkg, 'bin/ai-workflow-kit.mjs'), ...args, '--root', project], { encoding: 'utf8' });
  assert.equal(JSON.parse(await fs.readFile(path.join(pkg, 'package.json'))).version, '3.1.0');
  cli(['init', '--host', host]);
  const instruction = path.join(project, host === 'codex' ? 'AGENTS.md' : 'CLAUDE.md');
  const before = await fs.readFile(instruction, 'utf8');
  assert.ok(before.includes(host === 'codex' ? '$workflow' : '/workflow'));
  cli(['init', '--host', host]);
  assert.equal(await fs.readFile(instruction, 'utf8'), before);
  cli(['doctor']);
  const skill = path.join(project, host === 'codex' ? '.agents' : '.claude', 'skills/workflow/SKILL.md');
  await fs.access(skill);
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
  console.log(`PASS ${host}: offline tarball install, init, repeat, doctor, native routing, user edits, exports, remove`);
}
console.log(`Fixtures retained: ${root}`);

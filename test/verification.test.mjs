import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import test from 'node:test';
import { graphProject } from './fixtures/graph-project.mjs';

async function ready(t, code, check = {}) {
  const f = await graphProject(t, { profile: { checks: [{ id: 'addition', covers: ['V1'], argv: [process.execPath, 'check.mjs'], ...check }] } });
  if (code) await f.put('check.mjs', code);
  f.ok('init', '-', 'run.json', 'story.md');
  await f.record('implement'); await f.record('workflow-review');
  return { ...f, task: f.start('workflow-verify') };
}

for (const [name, code, check, field] of [
  ['timeout', 'setInterval(()=>{},1000);', { timeoutMs: 300 }, 'timedOut'],
  ['signal', 'process.kill(process.pid,"SIGTERM");', {}, 'signal'],
  ['spawn error', null, { argv: ['/definitely-missing-workflow-command'] }, 'spawnError'],
  ['input mutation', 'import fs from "node:fs"; fs.appendFileSync("app.mjs","// changed");', {}, 'snapshotAfter'],
]) test(`actual ${name} cannot issue a passing verification`, async t => {
  const f = await ready(t, code, check);
  const executed = f.ok('verify', 'run.json', f.task.id, f.task.token, 'addition').verification;
  assert.equal(executed.passed, false);
  assert.ok(executed[field]);
  assert.equal((await f.result(f.task)).status, 1);
});

test('silent successful execution retains empty raw logs; binary log tampering is detected', async t => {
  const f = await ready(t);
  const result = f.ok('verify', 'run.json', f.task.id, f.task.token, 'addition').verification;
  assert.equal(result.passed, true);
  assert.equal((await fs.readFile(path.join(f.root, result.stdout))).length, 0);
  assert.equal((await fs.readFile(path.join(f.root, result.stderr))).length, 0);
  await f.put(result.stdout, Buffer.from([255, 254]));
  assert.match(f.cli('status', 'run.json').stderr, /raw log changed/);
});

test('reset fences a late execution without holding the run lock over the subprocess', async t => {
  const f = await ready(t, 'import fs from "node:fs"; fs.writeFileSync(".ai-workflow/evidence/started", "yes"); setTimeout(()=>{},1500);');
  const child = spawn(process.execPath, [path.join(f.root, '.ai-workflow/bin/graph.mjs'), 'verify', 'run.json', f.task.id, f.task.token, 'addition'], { cwd: f.root });
  let stderr = ''; child.stderr.on('data', chunk => { stderr += chunk; }); child.stdout.resume();
  const completion = new Promise(resolve => child.on('close', resolve));
  for (let i = 0; i < 100; i++) {
    try { await fs.access(path.join(f.root, '.ai-workflow/evidence/started')); break; }
    catch { if (i === 99) assert.fail('child did not start'); await new Promise(resolve => setTimeout(resolve, 30)); }
  }
  f.ok('reset', 'run.json', f.task.id, 'Cancelled attempt; inspected child side effects');
  assert.equal(await completion, 1);
  assert.match(stderr, /late|reset|token/i);
  const state = JSON.parse(await fs.readFile(path.join(f.root, 'run.json'))).state.nodes[f.task.id];
  assert.equal(state.status, 'pending');
  assert.equal(state.attempts, 1);
  assert.equal(state.executions, undefined);
});

test('profile rejects references outside the Story verification scope', async t => {
  const f = await graphProject(t, { profile: { checks: [{ id: 'noop', covers: ['V9'], argv: [process.execPath, '-e', ''] }] } });
  assert.equal(f.cli('init', '-', 'run.json', 'story.md').status, 1);
});

test('a question invalidates old verification receipts and permits fresh execution after the answer', async t => {
  const f = await ready(t);
  f.ok('verify', 'run.json', f.task.id, f.task.token, 'addition');
  await f.put('question.json', { token: f.task.token, text: 'Confirm the fixture expectation?' });
  const waiting = f.ok('question', 'run.json', f.task.id, 'question.json');
  await f.put('.ai-workflow/evidence/answer.txt', 'Fixture answer: four.');
  await f.put('answer.json', { token: waiting.question.token, questionId: waiting.question.id, text: 'Four.', evidence: ['.ai-workflow/evidence/answer.txt'] });
  const resumed = f.ok('answer', 'run.json', f.task.id, 'answer.json').resumed;
  assert.notEqual(resumed.token, f.task.token);
  assert.equal((await f.result(resumed)).status, 1);
  f.ok('verify', 'run.json', resumed.id, resumed.token, 'addition');
  assert.equal((await f.result(resumed)).status, 0);
});

test('timeout cleans up this execution process group, including a child ignoring SIGTERM', { skip: process.platform === 'win32' }, async t => {
  const f = await ready(t, `import {spawn} from 'node:child_process';
    import fs from 'node:fs';
    const child=spawn(process.execPath,['-e','process.on("SIGTERM",()=>{});setInterval(()=>{},1000)'],{stdio:'ignore'});
    fs.writeFileSync('.ai-workflow/evidence/child.pid',String(child.pid));
    setInterval(()=>{},1000);`, { timeoutMs: 5000 });
  assert.equal(f.ok('verify', 'run.json', f.task.id, f.task.token, 'addition').verification.timedOut, true);
  const pid = Number(await fs.readFile(path.join(f.root, '.ai-workflow/evidence/child.pid'), 'utf8'));
  let alive = true;
  for (let i = 0; i < 30; i++) {
    try { process.kill(pid, 0); await new Promise(resolve => setTimeout(resolve, 30)); }
    catch (error) { if (error.code !== 'ESRCH') throw error; alive = false; break; }
  }
  assert.equal(alive, false, 'owned child process must be reaped after timeout');
});

test('snapshot collection failure still preserves the actual process logs and failed receipt', async t => {
  const f = await ready(t, 'import fs from "node:fs"; console.error("observed before unsafe link"); fs.unlinkSync("app.mjs"); fs.symlinkSync("/etc/hosts","app.mjs");');
  assert.equal(f.cli('verify', 'run.json', f.task.id, f.task.token, 'addition').status, 1);
  const run = JSON.parse(await fs.readFile(path.join(f.root, 'run.json')));
  const directory = path.join(f.root, '.ai-workflow/evidence', run.runId);
  const [execution] = await fs.readdir(directory);
  const receipt = JSON.parse(await fs.readFile(path.join(directory, execution, 'receipt.json')));
  assert.equal(receipt.passed, false);
  assert.match(receipt.snapshotError, /symlink/);
  assert.match(await fs.readFile(path.join(f.root, receipt.stderr), 'utf8'), /observed before unsafe link/);
});

test('an escaped descendant holding output pipes cannot delay completion indefinitely', { skip: process.platform === 'win32' }, async t => {
  const f = await ready(t, `import {spawn} from 'node:child_process';
    import fs from 'node:fs';
    const child=spawn(process.execPath,['-e','setTimeout(()=>{},3500)'],{detached:true,stdio:'inherit'});
    fs.writeFileSync('.ai-workflow/evidence/escaped.pid',String(child.pid));
    child.unref();`, { timeoutMs: 1000 });
  let pid;
  t.after(() => {
    try { if (pid) process.kill(pid, 'SIGKILL'); }
    catch (error) { if (error.code !== 'ESRCH') throw error; }
  });
  const result = f.ok('verify', 'run.json', f.task.id, f.task.token, 'addition').verification;
  pid = Number(await fs.readFile(path.join(f.root, '.ai-workflow/evidence/escaped.pid'), 'utf8'));
  const duration = Date.parse(result.finishedAt) - Date.parse(result.startedAt);
  assert.ok(duration < 2500, `completion took ${duration}ms despite bounded cleanup`);
  assert.equal(result.outputIncomplete, true);
  assert.equal(result.passed, false);
  assert.equal((await f.result(f.task)).status, 1);
});

test('inherited property names are valid check IDs regardless of execution order', async t => {
  const ids = ['addition', 'toString', 'hasOwnProperty'];
  const f = await graphProject(t, { profile: { checks: ids.map(id => ({ id, covers: ['V1'], argv: [process.execPath, 'check.mjs'] })) } });
  f.ok('init', '-', 'run.json', 'story.md');
  await f.record('implement'); await f.record('workflow-review');
  const task = f.start('workflow-verify');
  for (const id of ids) assert.equal(f.ok('verify', 'run.json', task.id, task.token, id).verification.passed, true);
  assert.equal((await f.result(task)).status, 0);
  assert.equal(f.ok('status', 'run.json').action, 'g4');
});

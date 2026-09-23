import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { installWorkflow } from '../src/install.mjs';

const story = `# Story: assigned edit
Status: Approved
Owner: fixture owner
Understanding gate (G1): approval.md · 2026-09-23 · Check-in: accepted
## Goal
Make the requested edit.
## Domain
- Invariant: preserve unrelated behavior.
## MUST
- M1. Requested behavior works.
## SHOULD
- S1. Keep it simple.
## OUT
- O1. Other changes.
## Decisions
- D1. Fixture approval only.
## Verify
- V1 [M1]. Exercise the behavior.
`;

async function fixture(t, role = 'developer', host = 'codex') {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'workflow-role-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const put = (file, value) => fs.writeFile(path.join(root, file), typeof value === 'string' ? value : JSON.stringify(value));
  await put('story.md', story);
  await put('request.md', 'Please clarify the requested edit.');
  await put('approval.md', 'Synthetic fixture approval; not real acceptance.');
  const assignment = { version: 1, taskId: 'task-1', role, source: role === 'pm' ? 'request.md' : 'story.md',
    scope: role === 'pm' ? [] : ['M1', 'V1'], targetRevision: 'snapshot-1' };
  await put('assignment.json', assignment);
  await installWorkflow({ root, hosts: [host] });
  const cli = (...args) => spawnSync(process.execPath, [path.join(root, '.ai-workflow/bin/graph.mjs'), ...args], { cwd: root, encoding: 'utf8' });
  const ok = (...args) => {
    const result = cli(...args);
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout);
  };
  const getRun = async () => JSON.parse(await fs.readFile(path.join(root, 'run.json'), 'utf8'));
  const start = () => {
    const task = ok('status', 'run.json').ready[0];
    assert.ok(task, 'A ready task must be available');
    return ok('start', 'run.json', task.id, task.token).started;
  };
  const resultFor = async (task, extra = {}, evaluation = { passed: true }) => {
    const file = `evidence-${task.token}.txt`;
    await put(file, 'Observed local fixture result.');
    await put('result.json', { token: task.token, output: { summary: 'Checked assigned work', evidence: [file], ...extra }, evaluation });
  };
  const record = async (extra, evaluation) => {
    const task = start();
    await resultFor(task, extra, evaluation);
    return ok('record', 'run.json', task.id, 'result.json');
  };
  return { root, put, assignment, cli, ok, getRun, start, record, resultFor };
}

for (const host of ['codex', 'claude']) {
  for (const role of ['pm', 'team-lead', 'developer', 'reviewer']) {
    test(`${host}: ${role} finishes assigned work without completing delivery`, async t => {
      const f = await fixture(t, role, host);
      let status = f.ok('init-role', 'assignment.json', 'run.json');
      assert.equal(status.assignment.taskId, 'task-1');
      assert.equal(status.ready[0].input.assignment.role, role);
      assert.equal(status.ready[0].input.story, f.assignment.source);
      while (status.action === 'execute') {
        status = await f.record(role === 'reviewer' ? { verdict: 'needs_changes', reviewedRevision: 'snapshot-1' } : { producedRevision: 'snapshot-2' });
      }
      assert.equal(status.action, 'role-complete');
      assert.equal(status.submission.output.summary, 'Checked assigned work');
      if (role === 'reviewer') assert.equal(status.submission.output.verdict, 'needs_changes');
      assert.ok(status.revisionToken);
      assert.ok(!status.completed.includes('workflow-verify'));
      assert.equal(await fs.readFile(path.join(f.root, 'story.md'), 'utf8'), story);
      const before = await f.getRun();
      await installWorkflow({ root: f.root, hosts: [host] });
      assert.deepEqual(await f.getRun(), before);
      assert.equal(f.ok('status', 'run.json').action, 'role-complete');
    });
  }
}

test('role input rejects draft implementation, invalid assignments and changed requirements', async t => {
  const f = await fixture(t);
  await f.put('story.md', story.replace('Status: Approved', 'Status: Draft'));
  assert.equal(f.cli('init-role', 'assignment.json', 'run.json').status, 1);
  await f.put('story.md', story);
  for (const change of [{ role: 'admin' }, { version: 99 }, { scope: [] }, { scope: ['M99'] }, { taskId: '' }, { targetRevision: '' }]) {
    await f.put('assignment.json', { ...f.assignment, ...change });
    assert.equal(f.cli('init-role', 'assignment.json', 'run.json').status, 1);
  }
  await f.put('assignment.json', f.assignment);
  f.ok('init-role', 'assignment.json', 'run.json');
  const before = await f.getRun();
  await f.put('story.md', story.replace('Requested behavior works.', 'Different requirement.'));
  assert.match(f.cli('status', 'run.json').stderr, /requirements changed/i);
  assert.deepEqual(await f.getRun(), before);
  await f.put('story.md', story);
  await f.put('assignment.json', { ...f.assignment, targetRevision: 'snapshot-3' });
  assert.match(f.cli('status', 'run.json').stderr, /assignment changed/i);
});

test('PM source is immutable and cannot silently become an approved implementation run', async t => {
  const f = await fixture(t, 'pm');
  f.ok('init-role', 'assignment.json', 'run.json');
  await f.put('request.md', 'A different request');
  assert.match(f.cli('status', 'run.json').stderr, /requirements changed/i);
});

test('status rejects an incomplete persisted role submission instead of announcing completion', async t => {
  const f = await fixture(t, 'reviewer');
  f.ok('init-role', 'assignment.json', 'run.json');
  await f.record({ verdict: 'pass', reviewedRevision: 'snapshot-1' });
  const run = await f.getRun();
  delete run.state.nodes.review.output.verdict;
  await f.put('run.json', run);
  assert.equal(f.cli('status', 'run.json').status, 1);
});

test('reviewer must report a verdict for the assigned snapshot, developer must identify produced work', async t => {
  for (const role of ['developer', 'reviewer']) {
    const f = await fixture(t, role);
    f.ok('init-role', 'assignment.json', 'run.json');
    if (role === 'developer') await f.record();
    const task = f.start();
    const before = await f.getRun();
    for (const extra of [{}, { verdict: 'pass', reviewedRevision: 'wrong' }]) {
      await f.resultFor(task, extra);
      assert.equal(f.cli('record', 'run.json', task.id, 'result.json').status, 1);
      assert.deepEqual(await f.getRun(), before);
    }
    await f.resultFor(task, role === 'developer' ? { producedRevision: 'snapshot-2' } : { verdict: 'pass', reviewedRevision: 'snapshot-1' });
    assert.equal(f.ok('record', 'run.json', task.id, 'result.json').action, 'role-complete');
  }
});

test('question survives restart, resumes the same attempt and rejects stale replies/results', async t => {
  const f = await fixture(t, 'pm');
  f.ok('init-role', 'assignment.json', 'run.json');
  const original = f.start();
  await f.put('question.json', { token: original.token, text: 'What output is required?' });
  const waiting = f.ok('question', 'run.json', original.id, 'question.json');
  assert.equal(waiting.action, 'question');
  assert.deepEqual(waiting.ready, []);
  assert.equal(f.ok('status', 'run.json').question.id, waiting.question.id);
  await f.resultFor(original);
  assert.equal(f.cli('record', 'run.json', original.id, 'result.json').status, 1);
  assert.equal(f.cli('reset', 'run.json', original.id, 'Bypass the question').status, 1);
  await f.put('reply-proof.md', 'Fixture answer: a report. Not approval.');
  const reply = { token: waiting.question.token, questionId: waiting.question.id, text: 'A report.', evidence: ['reply-proof.md'] };
  const before = await f.getRun();
  for (const change of [{ questionId: 'wrong' }, { token: original.token }, { text: '' }, { evidence: [] }]) {
    await f.put('answer.json', { ...reply, ...change });
    assert.equal(f.cli('answer', 'run.json', original.id, 'answer.json').status, 1);
    assert.deepEqual(await f.getRun(), before);
  }
  await f.put('answer.json', reply);
  const resumed = f.ok('answer', 'run.json', original.id, 'answer.json').resumed;
  assert.notEqual(resumed.token, original.token);
  assert.notEqual(resumed.token, waiting.question.token);
  assert.equal(resumed.input.messages.at(-1).text, 'A report.');
  assert.equal((await f.getRun()).state.nodes[original.id].attempts, 1);
  assert.equal(f.cli('answer', 'run.json', original.id, 'answer.json').status, 1);
  await f.resultFor(resumed);
  assert.equal(f.ok('record', 'run.json', original.id, 'result.json').action, 'execute');
  await f.put('reply-proof.md', 'Changed answer evidence');
  assert.match(f.cli('status', 'run.json').stderr, /evidence changed/i);
});

test('question exchanges are bounded without turning questions into failed tests', async t => {
  const f = await fixture(t, 'pm');
  f.ok('init-role', 'assignment.json', 'run.json');
  let task = f.start();
  for (let index = 0; index < 3; index++) {
    await f.put('question.json', { token: task.token, text: 'Please clarify.' });
    const { question } = f.ok('question', 'run.json', task.id, 'question.json');
    await f.put(`answer-${index}.md`, 'Fixture clarification.');
    await f.put('answer.json', { token: question.token, questionId: question.id, text: 'Clarified.', evidence: [`answer-${index}.md`] });
    task = f.ok('answer', 'run.json', task.id, 'answer.json').resumed;
  }
  await f.put('question.json', { token: task.token, text: 'Again?' });
  assert.match(f.cli('question', 'run.json', task.id, 'question.json').stderr, /question limit/i);
  assert.equal((await f.getRun()).state.nodes[task.id].attempts, 1);
  assert.equal((await f.getRun()).state.nodes[task.id].status, 'running');
});

test('external feedback reopens affected work with context and cannot erase retry limits', async t => {
  const f = await fixture(t);
  f.ok('init-role', 'assignment.json', 'run.json');
  await f.record();
  let done = await f.record({ producedRevision: 'snapshot-2' });
  const firstToken = done.revisionToken;
  for (let attempt = 1; attempt <= 3; attempt++) {
    await f.put(`feedback-${attempt}.md`, 'Reviewer found missing error handling.');
    const feedback = { token: done.revisionToken, summary: 'Handle rejected payments.', evidence: [`feedback-${attempt}.md`] };
    await f.put('feedback.json', feedback);
    if (attempt === 3) {
      assert.match(f.cli('feedback', 'run.json', 'implement', 'feedback.json').stderr, /limit|stop/i);
      break;
    }
    const pending = f.ok('feedback', 'run.json', 'implement', 'feedback.json');
    assert.deepEqual(pending.completed, []);
    assert.equal(pending.ready[0].input.messages.at(-1).summary, 'Handle rejected payments.');
    assert.equal(f.cli('feedback', 'run.json', 'implement', 'feedback.json').status, 1);
    await f.record();
    done = await f.record({ producedRevision: `snapshot-${attempt + 2}` });
  }
  assert.equal((await f.getRun()).state.nodes.implement.attempts, 3);
  await f.put('feedback.json', { token: firstToken, summary: 'Late feedback', evidence: ['feedback-1.md'] });
  assert.equal(f.cli('feedback', 'run.json', 'implement', 'feedback.json').status, 1);
});

test('feedback requires evidence and cannot invalidate actively running descendants', async t => {
  const f = await fixture(t);
  f.ok('init-role', 'assignment.json', 'run.json');
  await f.record();
  const status = f.ok('status', 'run.json');
  await f.put('feedback.json', { token: status.revisionToken, summary: 'Missing case', evidence: [] });
  const before = await f.getRun();
  assert.equal(f.cli('feedback', 'run.json', 'implement', 'feedback.json').status, 1);
  assert.deepEqual(await f.getRun(), before);
  f.start();
  await f.put('feedback.md', 'Missing case');
  await f.put('feedback.json', { token: f.ok('status', 'run.json').revisionToken, summary: 'Missing case', evidence: ['feedback.md'] });
  assert.match(f.cli('feedback', 'run.json', 'implement', 'feedback.json').stderr, /running/i);
});

test('failed local checks supply actionable feedback to the corrective attempt', async t => {
  const f = await fixture(t);
  f.ok('init-role', 'assignment.json', 'run.json');
  await f.record({}, { passed: false, action: 'fix', feedback: 'Handle empty input.' });
  const reset = f.ok('reset', 'run.json', 'implement', 'Correct failed behavior');
  assert.ok(reset.ready[0].input.messages.some(message => message.feedback === 'Handle empty input.'));
});

test('resetting implementation brings failed downstream verification feedback into its input', async t => {
  const f = await fixture(t);
  f.ok('init-role', 'assignment.json', 'run.json');
  await f.record();
  await f.record({}, { passed: false, action: 'fix', feedback: 'Missing idempotency check.' });
  const reset = f.ok('reset', 'run.json', 'implement', 'Fix the behavior identified by self-check');
  assert.ok(reset.ready[0].input.messages.some(message => message.feedback === 'Missing idempotency check.'));
});

test('delivery questions allow an independent reader to finish; feedback preserves its evidence', async t => {
  const f = await fixture(t);
  await f.put('plan.json', { nodes: [
    { id: 'A', description: 'Read code', access: 'read', covers: ['M1'], verify: 'Inspect code' },
    { id: 'B', description: 'Read tests', access: 'read', covers: ['V1'], verify: 'Inspect tests' },
  ], edges: [] });
  const first = f.ok('init', 'plan.json', 'run.json', 'story.md');
  const a = f.ok('start', 'run.json', 'A', first.ready[0].token).started;
  const b = f.ok('start', 'run.json', 'B', first.ready[1].token).started;
  await f.put('question.json', { token: a.token, text: 'Which case should A inspect?' });
  const { question } = f.ok('question', 'run.json', 'A', 'question.json');
  await f.resultFor(b);
  assert.equal(f.ok('record', 'run.json', 'B', 'result.json').action, 'question');
  const savedB = (await f.getRun()).state.nodes.B;
  await f.put('answer.md', 'Inspect the rejected case.');
  await f.put('answer.json', { token: question.token, questionId: question.id, text: 'Inspect the rejected case.', evidence: ['answer.md'] });
  const resumed = f.ok('answer', 'run.json', 'A', 'answer.json').resumed;
  await f.resultFor(resumed);
  const joined = f.ok('record', 'run.json', 'A', 'result.json');
  assert.equal(joined.ready[0].id, 'workflow-review');
  await f.put('feedback.md', 'Check the timeout case too.');
  await f.put('feedback.json', { token: joined.revisionToken, summary: 'Check timeout.', evidence: ['feedback.md'] });
  const reopened = f.ok('feedback', 'run.json', 'A', 'feedback.json');
  assert.deepEqual(reopened.completed, ['B']);
  assert.deepEqual((await f.getRun()).state.nodes.B, savedB);
});

import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { digest, projectFile, readJson, updateRun } from './storage.mjs';
import { taskToken } from './workflow.mjs';

export const PROFILE = '.ai-workflow/verification.json';
/** A profile check as this run executes it: its argv with the run's scope resolved. */
export const runCheck = (run, check) => ({ ...check, argv: run.checkArgv?.[check.id]
  ?? check.argv.filter(arg => !['{scope}', '{gradle-tests}'].includes(arg)).map(arg => (arg === '{gradle-test}' ? 'test' : arg)) });

/** Reuse key: the same check (id, argv, timeout) on the same code snapshot. */
export const receiptKey = (check, snapshot) =>
  `${check.id}:${digest(JSON.stringify({ argv: check.argv, timeoutMs: check.timeoutMs ?? null }))}:${snapshot}`;

export const needsExecution = (run, nodeId) => nodeId === 'workflow-verify'
  || (run.kind === 'role' && run.assignment.value.role === 'developer' && nodeId === 'self-check');

export async function verificationProfile(root, ids) {
  const value = await readJson(root, PROFILE);
  if (value.version !== 1 || !Array.isArray(value.checks) || value.checks.length === 0
    || (value.inputs !== undefined && (!Array.isArray(value.inputs) || value.inputs.length === 0))
    || (value.requiresG3 !== undefined && typeof value.requiresG3 !== 'boolean')) throw new Error('Invalid verification profile.');
  const seen = new Set();
  for (const check of value.checks) {
    if (typeof check.id !== 'string' || !/^[a-zA-Z0-9][\w-]*$/.test(check.id) || ['constructor', 'prototype'].includes(check.id) || seen.has(check.id)
      || !Array.isArray(check.covers) || !check.covers.length || check.covers.some(id => !/^V-?\d+$/.test(id) || !ids.includes(id))
      || !Array.isArray(check.argv) || !check.argv.length || check.argv.some(arg => typeof arg !== 'string' || arg.includes('\0')) || !check.argv[0]
      || (check.timeoutMs !== undefined && (!Number.isInteger(check.timeoutMs) || check.timeoutMs < 1 || check.timeoutMs > 300000))) {
      throw new Error('Invalid verification check: unique id, Story V references, argv and timeout (1..300000ms) are required.');
    }
    seen.add(check.id);
  }
  for (const id of ids.filter(id => /^V-?\d+$/.test(id))) {
    if (!value.checks.some(check => check.covers.includes(id))) throw new Error(`Verification profile does not cover ${id}.`);
  }
  if (value.requiresG3 && (typeof value.design !== 'string' || !value.design.trim())) throw new Error('G3 requires a design artifact path.');
  let recipe;
  if (value.recipe !== undefined) {
    const bytes = await fs.readFile(await projectFile(root, value.recipe));
    if (!bytes.toString('utf8').trim()) throw new Error('Verification recipe must not be empty.');
    recipe = { path: value.recipe, hash: digest(bytes) };
  }
  return { value, fingerprint: digest(JSON.stringify(value)), ...(recipe ? { recipe } : {}) };
}

async function execute(argv, root, timeoutMs) {
  return new Promise(resolve => {
    const stdout = [], stderr = [];
    let bytes = 0, timedOut = false, truncated = false, spawnError, killer, settled = false;
    const child = spawn(argv[0], argv.slice(1), { cwd: root, shell: false, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] });
    const kill = signal => {
      try { process.platform === 'win32' ? child.kill(signal) : process.kill(-child.pid, signal); }
      catch (error) { if (error.code !== 'ESRCH') spawnError ??= error.message; }
    };
    const finish = (exitCode, signal, outputIncomplete = false) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer); clearTimeout(killer);
      if (process.platform !== 'win32' && child.pid) kill('SIGKILL');
      if (outputIncomplete) { child.stdout.destroy(); child.stderr.destroy(); child.unref(); }
      resolve({ exitCode, signal, timedOut, truncated, outputIncomplete, ...(spawnError ? { spawnError } : {}), stdout: Buffer.concat(stdout), stderr: Buffer.concat(stderr) });
    };
    const stop = () => {
      if (settled) return;
      kill('SIGTERM');
      // An escaped descendant may keep the pipes open after our process group exits.
      killer ??= setTimeout(() => {
        kill('SIGKILL');
        finish(child.exitCode, child.signalCode, true);
      }, 500);
    };
    const capture = target => chunk => {
      if (settled) return;
      bytes += chunk.length;
      if (bytes <= 10 * 1024 * 1024) target.push(chunk);
      else { truncated = true; stop(); }
    };
    child.stdout.on('data', capture(stdout));
    child.stderr.on('data', capture(stderr));
    child.on('error', error => { spawnError = error.message; });
    // Kill descendants belonging to this command when the parent exits, too.
    child.on('exit', () => { if (process.platform !== 'win32') stop(); });
    const timer = setTimeout(() => { timedOut = true; stop(); }, timeoutMs);
    child.on('close', (exitCode, signal) => finish(exitCode, signal));
  });
}

export async function checkExecutions(root, run, nodeId, { requirePass = false } = {}) {
  const state = run.state.nodes[nodeId];
  const receipts = [];
  for (const [checkId, binding] of Object.entries(state.executions ?? {})) {
    if (binding.pending) { if (requirePass) throw new Error('Verification execution is still running.'); continue; }
    const receipt = await readJson(root, binding.file);
    // A reused receipt was produced earlier in this run for the same check and snapshot.
    const owned = binding.reused
      ? run.receipts?.[binding.reused]?.file === binding.file && run.receipts[binding.reused].hash === binding.hash
        && receipt.checkId === checkId && receipt.passed === true
      : receipt.token === taskToken(run, nodeId);
    if (digest(JSON.stringify(receipt)) !== binding.hash || !owned
      || receipt.runId !== run.runId || receipt.storyHash !== run.story.fingerprint) throw new Error('Verification receipt changed or belongs to stale work.');
    for (const stream of ['stdout', 'stderr']) {
      const bytes = await fs.readFile(await projectFile(root, receipt[stream]));
      if (digest(bytes) !== receipt[`${stream}Hash`]) throw new Error('Verification raw log changed.');
    }
    if (requirePass && (!receipt.passed || receipt.snapshotBefore !== state.snapshot || receipt.snapshotAfter !== state.snapshot)) {
      throw new Error('Verification execution failed or its code snapshot changed.');
    }
    receipts.push(receipt);
  }
  if (requirePass) {
    const ids = run.graph.nodes.find(node => node.id === nodeId).covers.filter(id => /^V-?\d+$/.test(id));
    for (const id of ids) if (!receipts.some(receipt => receipt.covers.includes(id))) throw new Error(`Verification execution required for ${id}.`);
    for (const check of run.verification.value.checks.filter(check => check.covers.some(id => ids.includes(id)))) {
      if (!receipts.some(receipt => receipt.checkId === check.id)) throw new Error(`Verification execution required for configured check ${check.id}.`);
    }
  }
  return receipts;
}

/** A passing receipt from this run for the same check and snapshot, if its file is intact. */
export async function findReusableReceipt(root, run, check, snapshot) {
  const indexed = run.receipts?.[receiptKey(check, snapshot)];
  if (!indexed) return null;
  const receipt = await readJson(root, indexed.file);
  if (digest(JSON.stringify(receipt)) !== indexed.hash || !receipt.passed || receipt.runId !== run.runId
    || receipt.snapshotBefore !== snapshot || receipt.snapshotAfter !== snapshot) return null;
  return { receipt, file: indexed.file, hash: indexed.hash };
}

/** Index a passing receipt so later nodes on the same snapshot reuse it. */
export async function indexReceipt(root, runFile, check, receipt, file) {
  if (!receipt.passed) return;
  await updateRun(root, runFile, async previous => {
    if (previous.runId !== receipt.runId) throw new Error('Receipt belongs to another run.');
    return { ...structuredClone(previous), receipts: { ...previous.receipts,
      [receiptKey(check, receipt.snapshotBefore)]: { file, hash: digest(JSON.stringify(receipt)) } } };
  });
}

/** Run one profile check against the current code and write its receipt and raw logs. */
export async function executeCheck({ root, run, nodeId, token, check, snapshotBefore, snapshot, executionId = randomUUID() }) {
  const directory = `.ai-workflow/evidence/${run.runId}/${executionId}`;
  await fs.mkdir(await projectFile(root, directory), { recursive: true, mode: 0o700 });
  const startedAt = new Date().toISOString();
  const result = await execute(check.argv, root, check.timeoutMs ?? 30000);
  const receipt = { version: 1, runId: run.runId, storyHash: run.story.fingerprint, nodeId, token, checkId: check.id, covers: check.covers,
    ...(run.verification.recipe ? { recipe: run.verification.recipe } : {}),
    argv: check.argv, cwd: '.', startedAt, finishedAt: new Date().toISOString(),
    ...result, stdout: `${directory}/stdout.log`, stderr: `${directory}/stderr.log`,
    stdoutHash: digest(result.stdout), stderrHash: digest(result.stderr),
    snapshotBefore, snapshotAfter: null };
  for (const stream of ['stdout', 'stderr']) await fs.writeFile(await projectFile(root, receipt[stream]), result[stream], { flag: 'wx', mode: 0o600 });
  try { receipt.snapshotAfter = (await snapshot(run)).fingerprint; }
  catch (error) { receipt.snapshotError = error.message; }
  receipt.passed = receipt.exitCode === 0 && !receipt.signal && !receipt.timedOut && !receipt.truncated && !receipt.outputIncomplete && !receipt.spawnError
    && !receipt.snapshotError && receipt.snapshotBefore === receipt.snapshotAfter;
  const file = `${directory}/receipt.json`;
  await fs.writeFile(await projectFile(root, file), `${JSON.stringify(receipt, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  return { receipt, file, hash: digest(JSON.stringify(receipt)) };
}

/** The last lines of a failed check's output, for feedback that fits in a compact result. */
export async function receiptTail(root, receipt, lines = 20) {
  // Both streams: Gradle and others print the failure to stdout and only JVM notices to stderr.
  const read = async stream => (await fs.readFile(await projectFile(root, receipt[stream]))).toString('utf8');
  const noise = /^Picked up (?:JAVA_TOOL_OPTIONS|_JAVA_OPTIONS|JDK_JAVA_OPTIONS)/;
  const kept = [...(await read('stdout')).split(/\r?\n/), ...(await read('stderr')).split(/\r?\n/)]
    .filter(line => line.trim() && !noise.test(line.trim()));
  const text = kept.length ? kept.slice(-lines).join('\n')
    : (receipt.timedOut ? 'timed out' : receipt.spawnError ?? `exit ${receipt.exitCode}`);
  return text.slice(-1500);
}

export async function runVerification({ root, runFile, nodeId, token, checkId, validate, snapshot }) {
  const executionId = randomUUID();
  let reused;
  const reserved = await updateRun(root, runFile, async previous => {
    const run = structuredClone(previous);
    await validate(run);
    if (run.version !== 3 || !needsExecution(run, nodeId) || run.question
      || run.state.nodes[nodeId]?.status !== 'running' || token !== taskToken(run, nodeId)) throw new Error('Verification requires the current running verification task token.');
    const found = run.verification.value.checks.find(check => check.id === checkId);
    if (!found) throw new Error('Unknown verification check.');
    const check = runCheck(run, found);
    if (Object.hasOwn(run.state.nodes[nodeId].executions ?? {}, checkId)) throw new Error('Check already executed in this attempt; reset before retrying.');
    const before = (await snapshot(run)).fingerprint;
    if (before !== run.state.nodes[nodeId].snapshot) throw new Error('Verification snapshot is stale; reset affected work.');
    run.state.nodes[nodeId].executions ??= {};
    reused = await findReusableReceipt(root, run, check, before);
    run.state.nodes[nodeId].executions[checkId] = reused
      ? { file: reused.file, hash: reused.hash, reused: receiptKey(check, before) }
      : { pending: executionId };
    return run;
  });
  if (reused) return { run: reserved, verification: { ...reused.receipt, receipt: reused.file, reused: true } };
  const check = runCheck(reserved, reserved.verification.value.checks.find(check => check.id === checkId));
  const { receipt, file } = await executeCheck({ root, run: reserved, nodeId, token, check, executionId,
    snapshotBefore: reserved.state.nodes[nodeId].snapshot, snapshot });
  const run = await updateRun(root, runFile, async previous => {
    const next = structuredClone(previous);
    await validate(next);
    if (token !== taskToken(next, nodeId) || next.state.nodes[nodeId].status !== 'running'
      || next.state.nodes[nodeId].executions?.[checkId]?.pending !== executionId) throw new Error('Late verification result rejected after reset/answer.');
    next.state.nodes[nodeId].executions[checkId] = { file, hash: digest(JSON.stringify(receipt)) };
    if (receipt.passed) next.receipts = { ...next.receipts, [receiptKey(check, receipt.snapshotBefore)]: next.state.nodes[nodeId].executions[checkId] };
    return next;
  });
  return { run, verification: { ...receipt, receipt: file } };
}

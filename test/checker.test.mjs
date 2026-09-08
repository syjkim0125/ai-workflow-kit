import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ai-workflow-check-'));
  await mkdir(path.join(root, 'docs/understanding'), { recursive: true });
  return root;
}

const baseStory = `# Story: payment
Status: Approved
Owner: human owner
Approval evidence: human confirmation

## Goal
Pay once.

## Domain
- Invariant: one order is paid once.

## MUST
- M1. Approved payment becomes Paid.
- M2. Failed payment never becomes Paid.

## SHOULD
- S1. Failure reason is visible.

## OUT
- O1. Partial refund.

## Decisions
- D1. Retry reuses the idempotency key.

## Verify
- V1 [M1]. Approval => Paid.
- V2 [M2]. Failure => not Paid.
`;

async function addGateArtifact(root, relative, body = '<html></html>') {
  const file = path.join(root, relative);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, body);
}

test('approved Story requires a valid accepted G1 record and existing artifact', async () => {
  const { checkArtifact } = await import('../assets/check.mjs');
  const root = await fixture();
  const contract = path.join(root, 'story.md');
  await writeFile(contract, baseStory);
  const missing = await checkArtifact({ root, file: contract, kind: 'story' });
  assert.equal(missing.ok, false);
  assert.ok(missing.errors.some((error) => error.includes('G1')));

  const artifact = 'docs/understanding/payment-contract.md';
  await addGateArtifact(root, artifact, '# approved contract\n');
  await writeFile(contract, `${baseStory}\nUnderstanding gate (G1): ${artifact} · 2026-08-30 · Check-in: accepted\n`);
  const passed = await checkArtifact({ root, file: contract, kind: 'story' });
  assert.equal(passed.ok, true, passed.errors.join('\n'));
});

test('G1 cannot be bypassed with N/A or declined check-in', async () => {
  const { checkArtifact } = await import('../assets/check.mjs');
  const root = await fixture();
  const contract = path.join(root, 'story.md');

  await writeFile(contract, `${baseStory}\nUnderstanding gate (G1): N/A — assumed approval\n`);
  const bypassed = await checkArtifact({ root, file: contract, kind: 'story' });
  assert.equal(bypassed.ok, false);
  assert.ok(bypassed.errors.some((error) => error.includes('cannot be N/A')));

  const artifact = 'docs/understanding/declined.md';
  await addGateArtifact(root, artifact);
  await writeFile(contract, `${baseStory}\nUnderstanding gate (G1): ${artifact} · 2026-08-30 · Check-in: declined\n`);
  const declined = await checkArtifact({ root, file: contract, kind: 'story' });
  assert.equal(declined.ok, false);
  assert.ok(declined.errors.some((error) => error.includes('declined')));
});

test('G4 requires evidence plus explicit human-restatement PASS, or a specific trivial N/A', async () => {
  const { checkGate } = await import('../assets/check.mjs');
  const root = await fixture();
  const contract = path.join(root, 'story.md');

  await writeFile(contract, `${baseStory}\nUnderstanding gate (G4): N/A — one-line constant rename; no behavior changed\n`);
  assert.equal((await checkGate({ root, file: contract, gate: 'G4' })).ok, true);

  await writeFile(contract, `${baseStory}\nUnderstanding gate (G4): N/A — renamed a public payment endpoint\n`);
  const unsafeSkip = await checkGate({ root, file: contract, gate: 'G4' });
  assert.equal(unsafeSkip.ok, false);
  assert.ok(unsafeSkip.errors.some((error) => error.includes('no implementation behavior changed')));

  await writeFile(contract, `${baseStory}\nUnderstanding gate (G4): N/A — 문서만 변경했고 실행 동작 변경 없음\n`);
  assert.equal((await checkGate({ root, file: contract, gate: 'G4' })).ok, true);

  const artifact = 'docs/understanding/payment-diff.md';
  await writeFile(contract, `${baseStory}\nUnderstanding gate (G4): ${artifact} · 2026-08-30 · Check-in: accepted\n`);
  const missingArtifact = await checkGate({ root, file: contract, gate: 'G4' });
  assert.equal(missingArtifact.ok, false);

  await addGateArtifact(root, artifact, '# raw diff + human answer + evaluation\n');
  const noPass = await checkGate({ root, file: contract, gate: 'G4' });
  assert.equal(noPass.ok, false);
  assert.ok(noPass.errors.some((error) => error.includes('G4: PASS')));

  await writeFile(contract, `${baseStory}\nUnderstanding gate (G4): ${artifact} · 2026-08-30 · Check-in: accepted\nG4: PASS — behavior, invariant/failure path, and evidence boundary restated by JongKun on 2026-08-30\n`);
  assert.equal((await checkGate({ root, file: contract, gate: 'G4' })).ok, true);
});

test('Delivered Story requires both G1 and G4', async () => {
  const { checkArtifact } = await import('../assets/check.mjs');
  const root = await fixture();
  const contract = path.join(root, 'story.md');
  const g1 = 'docs/understanding/payment-contract.md';
  const g4 = 'docs/understanding/payment-diff.md';
  await addGateArtifact(root, g1);
  await addGateArtifact(root, g4);
  const delivered = baseStory.replace('Status: Approved', 'Status: Delivered');

  await writeFile(contract, `${delivered}\nUnderstanding gate (G1): ${g1} · 2026-08-30 · Check-in: accepted\n`);
  const missing = await checkArtifact({ root, file: contract, kind: 'story' });
  assert.equal(missing.ok, false);
  assert.ok(missing.errors.some((error) => error.includes('G4')));

  await writeFile(contract, `${delivered}\nUnderstanding gate (G1): ${g1} · 2026-08-30 · Check-in: accepted\nUnderstanding gate (G4): ${g4} · 2026-08-30 · Check-in: accepted\nG4: PASS — owner restated behavior, failure path, and evidence boundary\n`);
  const passed = await checkArtifact({ root, file: contract, kind: 'story' });
  assert.equal(passed.ok, true, passed.errors.join('\n'));
});

test('Story checker requires ordered human-readable sections', async () => {
  const { checkArtifact } = await import('../assets/check.mjs');
  const root = await fixture();
  const contract = path.join(root, 'story.md');
  await writeFile(contract, '# Story\nStatus: Draft\n## MUST\n- M1. x\n');
  const result = await checkArtifact({ root, file: contract, kind: 'story' });
  assert.equal(result.ok, false);
  for (const heading of ['Goal', 'Domain', 'SHOULD', 'OUT', 'Decisions', 'Verify']) {
    assert.ok(result.errors.some((error) => error.includes(heading)), heading);
  }

  const outOfOrder = baseStory
    .replace('Status: Approved', 'Status: Draft')
    .replace('## Goal\nPay once.\n\n## Domain', '## Domain')
    .replace('## MUST', '## Goal\nPay once.\n\n## MUST');
  await writeFile(contract, outOfOrder);
  const ordered = await checkArtifact({ root, file: contract, kind: 'story' });
  assert.equal(ordered.ok, false);
  assert.ok(ordered.errors.some((error) => error.includes('out of order')));
});

test('Story checker requires every MUST to map to deterministic verification', async () => {
  const { checkArtifact } = await import('../assets/check.mjs');
  const root = await fixture();
  const contract = path.join(root, 'story.md');
  const incomplete = baseStory
    .replace('Status: Approved', 'Status: Draft')
    .replace('- V2 [M2]. Failure => not Paid.\n', '');
  await writeFile(contract, incomplete);

  const result = await checkArtifact({ root, file: contract, kind: 'story' });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes('M2')));
});

test('Story checker accepts bracket and arrow M/V mappings', async () => {
  const { checkArtifact } = await import('../assets/check.mjs');
  const root = await fixture();
  const contract = path.join(root, 'story.md');
  const arrow = baseStory
    .replace('Status: Approved', 'Status: Draft')
    .replace('- V1 [M1].', '- V1 → M1.')
    .replace('- V2 [M2].', '- V2 → M2.');
  await writeFile(contract, arrow);
  const result = await checkArtifact({ root, file: contract, kind: 'story' });
  assert.equal(result.ok, true, result.errors.join('\n'));
});

test('hyphenated M/V IDs preserve identity and cannot bypass mapping validation', async () => {
  const { checkArtifact } = await import('../assets/check.mjs');
  const root = await fixture();
  const file = path.join(root, 'story.md');
  const text = baseStory.replace('Status: Approved', 'Status: Draft').replaceAll(/\b([MV])(\d+)/g, '$1-$2');
  await writeFile(file, text);
  const valid = await checkArtifact({ root, file });
  assert.equal(valid.ok, true, valid.errors.join('\n'));
  await writeFile(file, text.replace('[M-2]', '[M-99]'));
  assert.equal((await checkArtifact({ root, file })).ok, false);
  await writeFile(file, text.replace('- M-2.', '- M-1.'));
  assert.equal((await checkArtifact({ root, file })).ok, false);
});

test('Story checker rejects duplicate or unknown requirement mappings', async () => {
  const { checkArtifact } = await import('../assets/check.mjs');
  const root = await fixture();
  const contract = path.join(root, 'story.md');

  const duplicateMust = baseStory
    .replace('Status: Approved', 'Status: Draft')
    .replace('- M2. Failed payment never becomes Paid.', '- M1. Failed payment never becomes Paid.');
  await writeFile(contract, duplicateMust);
  const duplicateMustResult = await checkArtifact({ root, file: contract, kind: 'story' });
  assert.equal(duplicateMustResult.ok, false);
  assert.ok(duplicateMustResult.errors.some((error) => error.includes('Duplicate MUST ID: M1')));

  const duplicateVerify = baseStory
    .replace('Status: Approved', 'Status: Draft')
    .replace('- V2 [M2]. Failure => not Paid.', '- V1 [M2]. Failure => not Paid.');
  await writeFile(contract, duplicateVerify);
  const duplicateVerifyResult = await checkArtifact({ root, file: contract, kind: 'story' });
  assert.equal(duplicateVerifyResult.ok, false);
  assert.ok(duplicateVerifyResult.errors.some((error) => error.includes('Duplicate Verify ID: V1')));

  const unknownMapping = baseStory
    .replace('Status: Approved', 'Status: Draft')
    .replace('- V2 [M2]. Failure => not Paid.', '- V2 [M2, M9]. Failure => not Paid.');
  await writeFile(contract, unknownMapping);
  const unknownResult = await checkArtifact({ root, file: contract, kind: 'story' });
  assert.equal(unknownResult.ok, false);
  assert.ok(unknownResult.errors.some((error) => error.includes('unknown MUST M9')));
});

test('approved Story cannot contain OPEN BLOCKING', async () => {
  const { checkArtifact } = await import('../assets/check.mjs');
  const root = await fixture();
  const contract = path.join(root, 'story.md');
  const artifact = 'docs/understanding/payment-contract.md';
  await addGateArtifact(root, artifact);
  const open = baseStory.replace('- D1. Retry reuses the idempotency key.', '- D1. Retry reuses the idempotency key.\n- OPEN BLOCKING: success authority unknown');
  await writeFile(contract, `${open}\nUnderstanding gate (G1): ${artifact} · 2026-08-30 · Check-in: accepted\n`);
  const result = await checkArtifact({ root, file: contract, kind: 'story' });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes('OPEN BLOCKING')));
});

test('gate artifacts cannot escape the project root', async () => {
  const { checkGate } = await import('../assets/check.mjs');
  const root = await fixture();
  const contract = path.join(root, 'story.md');
  await writeFile(contract, `${baseStory}\nUnderstanding gate (G1): ../outside.md · 2026-08-30 · Check-in: accepted\n`);
  const result = await checkGate({ root, file: contract, gate: 'G1' });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes('escapes project root')));
});

test('Task checker enforces 30 lines and the compact delivery-boundary shape', async () => {
  const { checkArtifact } = await import('../assets/check.mjs');
  const root = await fixture();
  const task = path.join(root, 'task.md');
  await writeFile(task, Array.from({ length: 31 }, (_, i) => `line ${i + 1}`).join('\n'));
  const long = await checkArtifact({ root, file: task, kind: 'task' });
  assert.equal(long.ok, false);
  assert.ok(long.errors.some((error) => error.includes('30')));

  await writeFile(task, `# Task: authorization
Readiness: Implementation-ready
Story: stories/payment.md
Plan source: docs/plans/payment.md

## Outcome
Authorize once.

## Covers — Story M/V IDs
- M1, M2 / V1, V2

## Scope
- IN: authorization

## Constraints
- Paid only after approval.

## Verify
- success and failure

## Risk / Dependency
- External PG
`);
  const valid = await checkArtifact({ root, file: task, kind: 'task' });
  assert.equal(valid.ok, true, valid.errors.join('\n'));

  await writeFile(task, `# Task: vague
Readiness: Draft

## Outcome
Something.
`);
  const invalid = await checkArtifact({ root, file: task, kind: 'task' });
  assert.equal(invalid.ok, false);
  assert.ok(invalid.errors.some((error) => error.includes('Story')));
  assert.ok(invalid.errors.some((error) => error.includes('Covers')));
  assert.ok(invalid.errors.some((error) => error.includes('Plan source')));
});

test('an empty evidence artifact does not satisfy a gate', async () => {
  // "Show your homework" must mean the page has something on it. A zero-byte artifact
  // means the gate was recorded but never held.
  const root = await fixture();
  const story = path.join(root, 'STORY.md');
  await writeFile(path.join(root, 'docs/understanding/payment-contract.md'), '');
  await writeFile(story, `${baseStory}
Understanding gate (G1): docs/understanding/payment-contract.md · 2026-08-31 · Check-in: accepted
`);

  const { checkGate } = await import('../assets/check.mjs');
  const result = await checkGate({ root, file: 'STORY.md', gate: 'G1' });
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /empty|no content|blank/i);
});

test('a Draft passes shape checks but says exit 0 is not G1 approval', async () => {
  // The G1 check only switches on at Status: Approved. Run on the Draft — which is
  // where the intake reference sends you — a placeholder Story exits 0, and an agent
  // can report "exit 0" while nothing has been approved. The pass must say so.
  const { checkArtifact } = await import('../assets/check.mjs');
  const root = await fixture();
  const contract = path.join(root, 'story.md');
  await writeFile(contract, baseStory.replace('Status: Approved', 'Status: Draft'));

  const result = await checkArtifact({ root, file: contract, kind: 'story' });
  assert.equal(result.ok, true, result.errors.join('\n'));
  assert.ok(
    (result.notes ?? []).some((note) => note.includes('G1')),
    'a Draft pass must name the gate it did not check',
  );
});

test('a placeholder Story title is not a title', async () => {
  const { checkArtifact } = await import('../assets/check.mjs');
  const root = await fixture();
  const contract = path.join(root, 'story.md');
  await writeFile(contract, baseStory
    .replace('Status: Approved', 'Status: Draft')
    .replace('# Story: payment', '# Story: <observable outcome>'));

  const result = await checkArtifact({ root, file: contract, kind: 'story' });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes('title')));
});

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { randomUUID } from 'node:crypto';

const headings = ['Goal', 'Domain', 'MUST', 'SHOULD', 'OUT', 'Decisions', 'Verify'];
const target = { siteUrl: 'https://jira.example.invalid', project: 'DEMO' };
const body = `# Story: readable publication
Status: Approved
Owner: fixture owner
Understanding gate (G1): approval.md · 2026-09-08 · Check-in: accepted

## Goal
Publish the approved request.

## Domain
- Story is canonical.

## MUST
- M1. Preserve the original.
- M2. Retry without duplicate issues.

## SHOULD
- S1. Explain failures.

## OUT
- O1. No credentials in artifacts.

## Decisions
- D1. ASSUMED: the adapter is supplied by the host.

## Verify
- V1 [M1]. Compare the original bytes.
- V2 [M2]. Retry and count created issues.
`;

async function fixture(text = body) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'workflow-jira-'));
  await fs.writeFile(path.join(root, 'story.md'), text);
  await fs.writeFile(path.join(root, 'approval.md'), 'Fixture: explicit approval of this Story.\n');
  return { root, file: 'story.md', publicationId: randomUUID() };
}

function transport() {
  const issues = [];
  let creates = 0;
  return {
    issues,
    get creates() { return creates; },
    async find({ publicationId }) { return issues.filter((issue) => issue.publicationId === publicationId); },
    async create(request) {
      creates++;
      const issue = { ...structuredClone(request), key: 'DEMO-1', url: `${target.siteUrl}/browse/DEMO-1` };
      issues.push(issue);
      return { key: issue.key, url: issue.url };
    },
    async read({ key }) { return structuredClone(issues.find((issue) => issue.key === key)); },
  };
}

async function api() { return import('../src/jira.mjs'); }

test('preview is read-only and preserves ordered sections, assumptions and M/V IDs', async () => {
  const { publishStory } = await api();
  const setup = await fixture(body.replaceAll(/\b([MV])(\d+)/g, '$1-$2'));
  const adapter = transport();
  const before = await fs.readFile(path.join(setup.root, setup.file));
  for (const options of [{}, { target }, { adapter }, { target, adapter }]) {
    const result = await publishStory({ ...setup, ...options });
    assert.equal(result.status, 'preview');
    assert.ok(result.preview.includes('ASSUMED'));
    assert.ok(result.preview.includes('M-1'));
    assert.ok(result.preview.includes('V-2 [M-2]'));
    assert.deepEqual(result.description.content.filter((node) => node.type === 'heading').map((node) => node.content[0].text), headings);
    assert.deepEqual((await fs.readdir(setup.root)).sort(), ['approval.md', 'story.md']);
  }
  assert.equal(adapter.creates, 0);
  assert.deepEqual(await fs.readFile(path.join(setup.root, setup.file)), before);
});

test('publication refuses Draft, missing/declined G1 and escaping Story paths', async () => {
  const { publishStory } = await api();
  for (const text of [body.replace('Approved', 'Draft'), body.replace('accepted', 'declined'), body.replace(/^Understanding gate.*\n/m, '')]) {
    const setup = await fixture(text);
    const adapter = transport();
    await assert.rejects(publishStory({ ...setup, target, adapter, publish: true }), /approved|G1/i);
    assert.equal(adapter.creates, 0);
  }
  const setup = await fixture();
  await assert.rejects(publishStory({ ...setup, file: '../story.md', target, adapter: transport(), publish: true }), /outside|escape/i);
});

test('successful publication is read back, recorded, and reverified on retry without a second create', async () => {
  const { publishStory } = await api();
  const setup = await fixture();
  const before = await fs.readFile(path.join(setup.root, setup.file));
  const adapter = transport();
  const result = await publishStory({ ...setup, target, adapter, publish: true });
  assert.equal(result.status, 'published');
  assert.equal(result.key, 'DEMO-1');
  assert.equal(result.url, `${target.siteUrl}/browse/DEMO-1`);
  const retry = await publishStory({ ...setup, target, adapter, publish: true });
  assert.equal(retry.key, result.key);
  assert.equal(adapter.creates, 1);
  const record = JSON.parse(await fs.readFile(path.join(setup.root, result.record), 'utf8'));
  assert.equal(record.state, 'verified');
  assert.equal(record.key, 'DEMO-1');
  assert.equal(record.description, undefined);
  assert.deepEqual(await fs.readFile(path.join(setup.root, setup.file)), before);
});

test('existing remote publication is adopted and ambiguous duplicates are rejected', async () => {
  const { publishStory } = await api();
  const setup = await fixture();
  const adapter = transport();
  adapter.find = async ({ publicationId }) => {
    const { description, summary } = await publishStory(setup);
    const issue = { publicationId, description, summary, target, key: 'DEMO-1', url: `${target.siteUrl}/browse/DEMO-1` };
    adapter.issues.push(issue);
    return [issue];
  };
  assert.equal((await publishStory({ ...setup, target, adapter, publish: true })).status, 'published');
  assert.equal(adapter.creates, 0);
  const second = await fixture();
  await assert.rejects(publishStory({ ...second, target, adapter: { ...adapter, find: async () => [{ key: 'DEMO-1' }, { key: 'DEMO-2' }] }, publish: true }), /multiple|duplicate/i);
});

test('read-back loss, reorder, wrong target or unsafe URL fails without changing the Story', async () => {
  const { publishStory } = await api();
  for (const mutate of [
    (issue) => { issue.description.content.splice(2, 1); },
    (issue) => { issue.description.content.reverse(); },
    (issue) => { issue.target.project = 'OTHER'; },
    (issue) => { issue.url = 'https://evil.example.invalid/browse/DEMO-1'; },
  ]) {
    const setup = await fixture();
    const before = await fs.readFile(path.join(setup.root, setup.file));
    const adapter = transport();
    const read = adapter.read;
    adapter.read = async (args) => { const issue = await read(args); mutate(issue); return issue; };
    await assert.rejects(publishStory({ ...setup, target, adapter, publish: true }), /verification|mismatch|URL/i);
    await assert.rejects(publishStory({ ...setup, target, adapter, publish: true }));
    assert.equal(adapter.creates, 1);
    assert.deepEqual(await fs.readFile(path.join(setup.root, setup.file)), before);
  }
});

test('permission and timeout failures do not leak transport errors or create again after an ambiguous attempt', async () => {
  const { publishStory } = await api();
  for (const stage of ['find', 'create', 'read']) {
    const setup = await fixture();
    const adapter = transport();
    const original = adapter[stage];
    adapter[stage] = async () => { throw new Error('SENTINEL_SECRET authorization 403 timeout'); };
    await assert.rejects(publishStory({ ...setup, target, adapter, publish: true }), (error) => {
      assert.doesNotMatch(error.message, /SENTINEL_SECRET/);
      assert.match(error.message, new RegExp(stage));
      return true;
    });
    assert.equal(await fs.readFile(path.join(setup.root, setup.file), 'utf8'), body);
    adapter[stage] = original;
    if (stage === 'create') {
      await assert.rejects(publishStory({ ...setup, target, adapter, publish: true }), /uncertain|ambiguous|reconcil/i);
      assert.equal(adapter.creates, 0);
    }
  }
});

test('a timeout after remote creation is reconciled on retry', async () => {
  const { publishStory } = await api();
  const setup = await fixture();
  const adapter = transport();
  const create = adapter.create;
  adapter.create = async (request) => { await create(request); throw new Error('lost response'); };
  await assert.rejects(publishStory({ ...setup, target, adapter, publish: true }), /create/i);
  assert.equal((await publishStory({ ...setup, target, adapter, publish: true })).key, 'DEMO-1');
  assert.equal(adapter.creates, 1);
});

test('malformed, credential-bearing targets and symlinked publication storage never reach transport', async () => {
  const { publishStory } = await api();
  const setup = await fixture();
  const adapter = transport();
  for (const bad of [
    { ...target, siteUrl: 'http://jira.example.invalid' },
    { ...target, siteUrl: 'https://user:password@jira.example.invalid' },
    { ...target, project: '../DEMO' }, { ...target, parent: 'OTHER-1' },
  ]) await assert.rejects(publishStory({ ...setup, target: bad, adapter, publish: true }), /target|project|parent|HTTPS/i);
  const outside = await fixture();
  await fs.symlink(outside.root, path.join(setup.root, '.ai-workflow'));
  await assert.rejects(publishStory({ ...setup, target, adapter, publish: true }), /symlink/i);
  assert.equal(adapter.creates, 0);
});

test('publication requires literal authorization and a stable caller-owned identity', async () => {
  const { publishStory } = await api();
  const setup = await fixture();
  const adapter = transport();
  for (const publish of ['true', 1, {}, []]) {
    const result = await publishStory({ ...setup, target, adapter, publish });
    assert.equal(result.status, 'preview');
  }
  await assert.rejects(publishStory({ ...setup, publicationId: undefined, target, adapter, publish: true }), /publication.*identity|publicationId/i);
  assert.equal(adapter.creates, 0);
});

test('different projects with the same relative Story path do not accidentally share an issue', async () => {
  const { publishStory } = await api();
  const adapter = transport();
  const one = await fixture();
  const two = await fixture();
  await publishStory({ ...one, target, adapter, publish: true });
  // Force unique returned issue keys as a real host would do.
  adapter.create = async (request) => {
    const issue = { ...structuredClone(request), key: 'DEMO-2', url: `${target.siteUrl}/browse/DEMO-2` };
    adapter.issues.push(issue);
    return issue;
  };
  const result = await publishStory({ ...two, target, adapter, publish: true });
  assert.equal(result.key, 'DEMO-2');
  assert.notEqual(adapter.issues[0].publicationId, adapter.issues[1].publicationId);
});

test('concurrent publishers create at most once and changed content does not silently replace an issue', async () => {
  const { publishStory } = await api();
  const setup = await fixture();
  const adapter = transport();
  const results = await Promise.allSettled([
    publishStory({ ...setup, target, adapter, publish: true }), publishStory({ ...setup, target, adapter, publish: true }),
  ]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(adapter.creates, 1);
  await fs.writeFile(path.join(setup.root, setup.file), body.replace('Publish the approved request.', 'A changed request.'));
  await assert.rejects(publishStory({ ...setup, target, adapter, publish: true }), /changed|reconcil/i);
  assert.equal(adapter.creates, 1);
});

test('a Draft cannot approve itself by embedding Approved metadata in a section', async () => {
  const { publishStory } = await api();
  const setup = await fixture(body.replace('Status: Approved', 'Status: Draft').replace('## Goal\n', '## Goal\nStatus: Approved\n'));
  const adapter = transport();
  await assert.rejects(publishStory({ ...setup, target, adapter, publish: true }), /Approved|metadata/i);
  assert.equal(adapter.creates, 0);
});

test('publication rejects self-referencing G1 evidence', async () => {
  const { publishStory } = await api();
  const setup = await fixture(body.replace('G1): approval.md', 'G1): story.md'));
  await fs.rm(path.join(setup.root, 'approval.md'));
  const adapter = transport();
  await assert.rejects(publishStory({ ...setup, target, adapter, publish: true }), /G1.*separate|approval.*separate/i);
  assert.equal(adapter.creates, 0);
});

test('publication refuses storage replaced with an outside symlink during lookup', async () => {
  const { publishStory } = await api();
  const setup = await fixture();
  const outside = await fixture();
  const adapter = transport();
  adapter.find = async () => {
    const storage = path.join(setup.root, '.ai-workflow/publications');
    const files = await fs.readdir(storage);
    await fs.rename(storage, `${storage}-moved`);
    await fs.symlink(outside.root, storage);
    for (const file of files) if (file.endsWith('.lock')) await fs.mkdir(path.join(outside.root, file));
    return [];
  };
  await assert.rejects(publishStory({ ...setup, target, adapter, publish: true }), /symlink|storage.*changed/i);
  assert.equal(adapter.creates, 0);
  assert.equal((await fs.readdir(outside.root)).some((file) => file.endsWith('.json')), false);
});

test('a hard link to the Story cannot stand in for separate approval evidence', async () => {
  const { publishStory } = await api();
  const setup = await fixture();
  await fs.rm(path.join(setup.root, 'approval.md'));
  await fs.link(path.join(setup.root, 'story.md'), path.join(setup.root, 'approval.md'));
  const adapter = transport();
  await assert.rejects(publishStory({ ...setup, target, adapter, publish: true }), /separate/i);
  assert.equal(adapter.creates, 0);
});

test('validation errors do not echo private Story content', async () => {
  const { publishStory } = await api();
  const setup = await fixture(body.replace('- V1 [M1]. Compare the original bytes.', '- V1 [M99]. SENTINEL_PRIVATE_CONTENT'));
  await assert.rejects(publishStory(setup), (error) => {
    assert.doesNotMatch(error.message, /SENTINEL_PRIVATE_CONTENT/);
    assert.match(error.message, /validation/i);
    return true;
  });
});

test('revoked or replaced approval evidence during lookup blocks creation', async () => {
  const { publishStory } = await api();
  for (const mutation of ['delete', 'replace']) {
    const setup = await fixture();
    const adapter = transport();
    adapter.find = async () => {
      const file = path.join(setup.root, 'approval.md');
      if (mutation === 'delete') await fs.rm(file);
      else await fs.writeFile(file, 'Approval withdrawn.');
      return [];
    };
    await assert.rejects(publishStory({ ...setup, target, adapter, publish: true }), /approval|G1/i);
    assert.equal(adapter.creates, 0);
  }
});

test('requirement prose beginning with metadata words is preserved', async () => {
  const { publishStory } = await api();
  const setup = await fixture(body.replace('Publish the approved request.', 'Publish the approved request.\nStatus: users see pending until verification.\nOwner: assigned teams see the result.'));
  const preview = await publishStory(setup);
  assert.match(preview.preview, /Status: users see pending until verification\./);
  assert.match(preview.preview, /Owner: assigned teams see the result\./);
});

test('Delivered Story publication excludes trailing gate paths and human restatements', async () => {
  const { publishStory } = await api();
  const text = body.replace('Status: Approved', 'Status: Delivered') + '\nUnderstanding gate (G4): private-review.md · 2026-09-08 · Check-in: accepted\nG4: PASS — Jane private restatement of behavior, failure path and evidence boundary\n';
  const setup = await fixture(text);
  await fs.writeFile(path.join(setup.root, 'private-review.md'), 'Private approval evidence.');
  const preview = await publishStory(setup);
  assert.doesNotMatch(JSON.stringify(preview), /private-review|Jane|G4: PASS|Understanding gate/);
  const adapter = transport();
  await publishStory({ ...setup, target, adapter, publish: true });
  assert.doesNotMatch(JSON.stringify(adapter.issues), /private-review|Jane|G4: PASS|Understanding gate/);
});

test('checker-supported gate casing and spacing cannot leak trailing evidence', async () => {
  const { publishStory } = await api();
  for (const gap of ['', '\t', '   ']) {
    const setup = await fixture(body.replace('Status: Approved', 'Status: Delivered') + `\nunderstanding gate (g4):${gap}private-review.md · 2026-09-08 · Check-in: accepted\ng4:${gap}pass — Jane private restatement\n`);
    await fs.writeFile(path.join(setup.root, 'private-review.md'), 'Private evidence.');
    const preview = await publishStory(setup);
    assert.doesNotMatch(JSON.stringify(preview), /private-review|Jane/);
  }
});

test('malformed local records cannot erase publication history', async () => {
  const { publishStory } = await api();
  for (const invalid of [null, false, [], { version: 1 }]) {
    const setup = await fixture();
    const adapter = transport();
    const result = await publishStory({ ...setup, target, adapter, publish: true });
    await fs.writeFile(path.join(setup.root, result.record), JSON.stringify(invalid));
    adapter.find = async () => [];
    await assert.rejects(publishStory({ ...setup, target, adapter, publish: true }));
    assert.equal(adapter.creates, 1);
  }
});

test('malformed lookup matches cannot be treated as permission to create', async () => {
  const { publishStory } = await api();
  for (const matches of [[null], [undefined], new Array(1), [{}]]) {
    const setup = await fixture();
    const adapter = transport();
    adapter.find = async () => matches;
    await assert.rejects(publishStory({ ...setup, target, adapter, publish: true }));
    assert.equal(adapter.creates, 0);
  }
});

test('metadata hidden in fences or HTML comments cannot authorize publication', async () => {
  const { publishStory } = await api();
  for (const [open, close] of [['```text', '```'], ['~~~text', '~~~'], ['<!--', '-->']]) {
    const text = body.replace('Status: Approved', `${open}\nStatus: Approved`).replace('## Goal', `${close}\n## Goal`);
    const setup = await fixture(text);
    const adapter = transport();
    await assert.rejects(publishStory({ ...setup, target, adapter, publish: true }), /metadata|validation/i);
    assert.equal(adapter.creates, 0);
  }
});

test('mixed-case duplicate approval or status metadata is rejected', async () => {
  const { publishStory } = await api();
  for (const text of [
    body.replace('Understanding gate (G1): approval.md · 2026-09-08 · Check-in: accepted', 'understanding gate (g1): approval.md · 2026-09-08 · Check-in: accepted\nUnderstanding gate (G1): declined.md · 2026-09-08 · Check-in: declined'),
    body.replace('Status: Approved', 'Status: Approved\nstatus: Draft'),
  ]) {
    const setup = await fixture(text);
    await fs.writeFile(path.join(setup.root, 'declined.md'), 'Fixture: rejected.');
    const adapter = transport();
    await assert.rejects(publishStory({ ...setup, target, adapter, publish: true }), /metadata|validation/i);
    assert.equal(adapter.creates, 0);
  }
});

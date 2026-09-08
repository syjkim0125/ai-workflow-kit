import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { checkArtifact, checkGate, isGateMetadataLine } from '../assets/check.mjs';
import { safePath } from './install-transaction.mjs';

const HEADINGS = ['Goal', 'Domain', 'MUST', 'SHOULD', 'OUT', 'Decisions', 'Verify'];
const hash = (value) => createHash('sha256').update(value).digest('hex');
const textNode = (text) => ({ type: 'text', text });
const paragraph = (text) => ({ type: 'paragraph', content: [textNode(text)] });

/** Plain canonical Markdown -> inert ADF headings, paragraphs and bullet lists. */
export function formatStory(text) {
  const summary = text.match(/^# Story: (.+)$/m)?.[1]?.trim();
  if (!summary || summary.length > 255) throw new Error('Story title is missing or exceeds 255 characters.');
  const sections = [];
  let fenced = false;
  let trailingGates = false;
  for (const line of text.replace(/\r\n/g, '\n').split('\n')) {
    if (/^\s*(?:`{3,}|~{3,})/.test(line)) fenced = !fenced;
    // Only a trailing gate block after Verify is metadata, not similarly named prose.
    const gateLine = isGateMetadataLine(line);
    if (!fenced && sections.at(-1)?.heading === 'Verify' && gateLine) trailingGates = true;
    if (trailingGates) {
      if (gateLine || !line.trim()) continue;
      throw new Error('Gate metadata must follow all Verify content or move to the Story preamble.');
    }
    const heading = !fenced && line.match(/^##\s+(.+?)\s*$/);
    if (heading) sections.push({ heading: heading[1], lines: [] });
    else if (sections.length) sections.at(-1).lines.push(line);
  }
  if (!isDeepStrictEqual(sections.map((section) => section.heading), HEADINGS) || fenced) {
    throw new Error('Story needs exactly the seven canonical sections in order and closed code fences.');
  }
  const content = [];
  const preview = [];
  for (const section of sections) {
    const body = section.lines.join('\n').trim();
    if (!body) throw new Error(`Story section ${section.heading} is empty; explain why it is N/A.`);
    preview.push(`## ${section.heading}\n\n${body}`);
    content.push({ type: 'heading', attrs: { level: 2 }, content: [textNode(section.heading)] });
    let list;
    for (const line of body.split('\n')) {
      const item = line.match(/^[-*] (.+)$/);
      if (item) {
        if (!list) { list = { type: 'bulletList', content: [] }; content.push(list); }
        list.content.push({ type: 'listItem', content: [paragraph(item[1])] });
      } else {
        list = null;
        if (line.trim()) content.push(paragraph(line));
      }
    }
  }
  return { summary, description: { type: 'doc', version: 1, content }, preview: preview.join('\n\n') + '\n' };
}

function validatedTarget(target) {
  let url;
  try { url = new URL(target.siteUrl); } catch { throw new Error('Jira target needs a valid HTTPS siteUrl.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('Jira target must be an HTTPS origin without credentials, query or path.');
  }
  if (!/^[A-Z][A-Z0-9_]{1,30}$/.test(target.project ?? '')) throw new Error('Invalid Jira target project key.');
  if (target.parent !== undefined && !new RegExp(`^${target.project}-[1-9][0-9]*$`).test(target.parent)) {
    throw new Error('Jira parent must be an issue key within the authorized project.');
  }
  return { siteUrl: url.origin, project: target.project, ...(target.parent ? { parent: target.parent } : {}) };
}

function validateIssue(issue, target) {
  const validKey = typeof issue?.key === 'string' && new RegExp(`^${target.project}-[1-9][0-9]*$`).test(issue.key);
  if (!validKey || issue.url !== `${target.siteUrl}/browse/${issue.key}`) {
    throw new Error('Jira verification failed: invalid issue key or URL for the authorized target.');
  }
  return { key: issue.key, url: issue.url };
}

async function call(adapter, method, request) {
  try { return await adapter[method](structuredClone(request)); }
  catch {
    // Host errors may contain bearer tokens, URLs with credentials or Story content.
    throw new Error(`Jira ${method} failed. Check host permissions/connectivity; preserve the publication record and reconcile before retrying creation.`);
  }
}

async function save(file, record, assertStorage) {
  await assertStorage();
  const temporary = `${file}.next`;
  const handle = await fs.open(temporary, 'wx', 0o600);
  try { await handle.writeFile(JSON.stringify(record, null, 2) + '\n'); await handle.sync(); }
  finally { await handle.close(); }
  await assertStorage();
  await fs.rename(temporary, file);
}

/**
 * No transport is loaded from disk or environment. The caller supplies the host
 * adapter and explicit publication authority; CLI use remains preview-only.
 */
export async function publishStory({ root = process.cwd(), file, target, adapter, publish = false, publicationId: identity } = {}) {
  root = await fs.realpath(root);
  if (typeof file !== 'string') throw new Error('A canonical Story file is required.');
  const storyFile = await safePath(root, file);
  const original = await fs.readFile(storyFile, 'utf8');
  const formatted = formatStory(original);
  const shape = await checkArtifact({ root, file: storyFile });
  if (!shape.ok) throw new Error('Story validation failed (shape or G1/G4 evidence). Run the local checker privately to inspect the details.');
  const preview = { status: 'preview', ...formatted };
  if (publish !== true || !adapter || !target?.project || !target?.siteUrl) return preview;
  const metadata = original.slice(0, /^##[\t ]+/m.exec(original)?.index ?? 0);
  if (!metadata.split(/\r?\n/).every((line) => /^(?:\s*|# Story: .+|Status: .+|Owner: .+|Understanding gate \(G[134]\): .+|G4: .+)$/.test(line))) {
    throw new Error('Jira publication requires plain Story metadata; comments, fences and other blocks are not allowed in the preamble.');
  }
  const statuses = [...metadata.matchAll(/^Status:[\t ]*(.+)$/gmi)];
  const approvals = [...original.matchAll(/^Understanding gate \(G1\):.*$/gmi)];
  if (statuses.length !== 1 || !/^Status:[\t ]*(Approved|Delivered)[\t ]*\r?$/mi.test(metadata)
    || approvals.length !== 1 || !metadata.includes(approvals[0][0])) {
    throw new Error('Jira publication requires one Approved Status and one G1 record in the Story metadata.');
  }
  const gate = await checkGate({ root, file: storyFile, gate: 'G1' });
  if (!gate.ok) throw new Error('Jira publication requires valid G1 evidence. Run the local checker privately.');
  const evidence = approvals[0][0].replace(/^Understanding gate \(G1\):\s*/i, '').split(/\s*[·|]\s*/)[0];
  const [storyInfo, evidenceInfo] = await Promise.all([fs.stat(storyFile), fs.stat(path.resolve(root, evidence))]);
  if (storyInfo.dev === evidenceInfo.dev && storyInfo.ino === evidenceInfo.ino) {
    throw new Error('Jira G1 approval needs a separate evidence artifact, not the Story itself.');
  }
  const evidenceFile = await safePath(root, evidence);
  const approvalBytes = await fs.readFile(evidenceFile);
  const assertApproval = async () => {
    try {
      await safePath(root, evidence);
      const info = await fs.stat(evidenceFile);
      if (info.dev !== evidenceInfo.dev || info.ino !== evidenceInfo.ino || !(await fs.readFile(evidenceFile)).equals(approvalBytes)) throw new Error();
    } catch { throw new Error('G1 approval evidence changed during publication; obtain approval again.'); }
  };
  target = validatedTarget(target);
  if (typeof identity !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{7,127}$/.test(identity)) {
    throw new Error('A stable, unique caller-owned publicationId is required; reuse it across retries and clones.');
  }
  if (!['find', 'create', 'read'].every((name) => typeof adapter[name] === 'function')) {
    throw new Error('Jira host adapter must supply find, create and read functions.');
  }

  // The caller owns identity. Relative paths alone collide across repositories.
  const publicationId = `workflow-${hash(JSON.stringify([identity, target]))}`;
  const recordRelative = `.ai-workflow/publications/${publicationId}.json`;
  const recordFile = await safePath(root, recordRelative);
  const lock = await safePath(root, `${recordRelative}.lock`);
  await safePath(root, `${recordRelative}.next`);
  await fs.mkdir(path.dirname(recordFile), { recursive: true, mode: 0o700 });
  const storageInfo = await fs.lstat(path.dirname(recordFile));
  const assertStorage = async () => {
    await safePath(root, recordRelative);
    await safePath(root, `${recordRelative}.next`);
    await safePath(root, `${recordRelative}.lock`);
    const current = await fs.lstat(path.dirname(recordFile));
    if (current.dev !== storageInfo.dev || current.ino !== storageInfo.ino) {
      throw new Error('Jira publication storage changed; preserve records and reconcile manually.');
    }
  };
  await assertStorage();
  try { await fs.mkdir(lock, { mode: 0o700 }); }
  catch { throw new Error('Jira publication locked. Wait for the active publisher; after a crash, confirm it has stopped before removing the lock directory.'); }

  try {
    let record;
    await assertStorage();
    try {
      record = JSON.parse(await fs.readFile(recordFile, 'utf8'));
      if (!record || typeof record !== 'object' || Array.isArray(record)) throw new Error('Invalid record');
    }
    catch (error) { if (error.code !== 'ENOENT') throw new Error('Invalid publication record; preserve it and reconcile manually.'); }
    const digest = hash(JSON.stringify([formatted.summary, formatted.description]));
    if (record && (record.version !== 1 || record.publicationId !== publicationId || record.digest !== digest || !isDeepStrictEqual(record.target, target))) {
      throw new Error('Story or target changed since publication intent; reconcile the existing issue instead of creating another.');
    }
    if (record && !['intent', 'verified'].includes(record.state)) throw new Error('Invalid publication state; reconcile manually.');
    const matches = await call(adapter, 'find', { publicationId, target });
    await assertStorage();
    if (!Array.isArray(matches) || matches.length > 1) throw new Error('Jira lookup returned invalid or multiple duplicate publications; reconcile manually.');
    if (matches.length === 1) validateIssue(matches[0], target);
    let issue = record?.key ? { key: record.key, url: record.url } : matches[0];
    if (record?.key && matches[0] && matches[0].key !== record.key) throw new Error('Jira duplicate publication disagrees with the recorded issue.');
    if (!issue && record) throw new Error('Jira creation outcome is uncertain. Reconcile the original intent; automatic creation is blocked.');

    if (await fs.readFile(storyFile, 'utf8') !== original) throw new Error('Story changed during publication; rerun after approval.');
    await assertApproval();
    if (!issue) {
      record = { version: 1, state: 'intent', publicationId, digest, target };
      await save(recordFile, record, assertStorage); // durable intent precedes the only external mutation
      await assertApproval();
      issue = await call(adapter, 'create', { publicationId, target, summary: formatted.summary, description: formatted.description });
    }
    const identity = validateIssue(issue, target);
    const readBack = await call(adapter, 'read', { ...identity, target });
    validateIssue(readBack, target);
    if (readBack.key !== identity.key || readBack.publicationId !== publicationId
      || readBack.summary !== formatted.summary || !isDeepStrictEqual(readBack.target, target)
      || !isDeepStrictEqual(readBack.description, formatted.description)) {
      throw new Error('Jira read-back verification mismatch. Preserve the intent and reconcile; the Story has not been changed.');
    }
    if (await fs.readFile(storyFile, 'utf8') !== original) throw new Error('Story changed during publication; reconcile before retrying.');
    await assertApproval();
    await save(recordFile, { version: 1, state: 'verified', publicationId, digest, target, ...identity }, assertStorage);
    return { status: 'published', ...identity, publicationId, record: recordRelative };
  } finally {
    await assertStorage();
    await fs.rmdir(lock);
  }
}

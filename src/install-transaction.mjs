import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';

// Only these package-owned destinations may be committed or restored by a journal.
const PATHS = Object.freeze([
  'AGENTS.md', 'CLAUDE.md', '.agents/skills/workflow', '.claude/skills/workflow',
  'templates/ai-workflow/STORY.md', 'templates/ai-workflow/TASK.md',
  '.ai-workflow/bin/check.mjs', '.ai-workflow/config.json',
]);
const JOURNAL = '.ai-workflow-install';

async function stat(file) {
  try { return await fs.lstat(file); } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

// Reject links rather than following them into a user's unrelated files.
export async function safePath(root, relative) {
  const file = path.resolve(root, relative);
  const rel = path.relative(root, file);
  if (!rel || rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) {
    throw new Error('Path escapes project root.');
  }
  let current = root;
  const parts = rel.split(path.sep);
  for (const [index, part] of parts.entries()) {
    current = path.join(current, part);
    const info = await stat(current);
    if (info?.isSymbolicLink()) throw new Error('Refusing symlink in managed path.');
    if (info && index < parts.length - 1 && !info.isDirectory()) throw new Error('Managed parent is not a directory.');
  }
  return file;
}

async function fingerprint(file) {
  const info = await stat(file);
  if (!info) return null;
  if (info.isSymbolicLink()) throw new Error('Refusing symlink in managed tree.');
  if (info.isDirectory()) {
    const entries = [];
    for (const name of (await fs.readdir(file)).sort()) entries.push([name, await fingerprint(path.join(file, name))]);
    return JSON.stringify([info.mode, entries]);
  }
  if (!info.isFile()) throw new Error('Managed path must be a regular file or directory.');
  return `${info.mode}:${createHash('sha256').update(await fs.readFile(file)).digest('hex')}`;
}

async function writeJournal(directory, journal) {
  const temporary = path.join(directory, 'journal.next');
  const handle = await fs.open(temporary, 'w', 0o600);
  try { await handle.writeFile(JSON.stringify(journal)); await handle.sync(); } finally { await handle.close(); }
  await fs.rename(temporary, path.join(directory, 'journal.json'));
}

function parents(relative) {
  const result = [];
  for (let dir = path.dirname(relative); dir !== '.'; dir = path.dirname(dir)) result.push(dir);
  return result;
}

async function prune(root, directories) {
  for (const dir of [...new Set(directories)].sort((a, b) => b.length - a.length)) {
    try { await fs.rmdir(await safePath(root, dir)); } catch (error) {
      if (!['ENOENT', 'ENOTEMPTY', 'EEXIST'].includes(error.code)) throw error;
    }
  }
}

async function rollback(root, directory, journal) {
  // Check all backups before restoring any path: corrupt recovery must be inert.
  for (const entry of journal.entries) {
    const backup = path.join(directory, 'backup', entry.relative);
    if (await stat(backup) && await fingerprint(backup) !== entry.before) {
      throw new Error('Recovery stopped: backup does not match the original fingerprint; preserve the journal.');
    }
  }
  for (const entry of [...journal.entries].reverse()) {
    const target = await safePath(root, entry.relative);
    const backup = path.join(directory, 'backup', entry.relative);
    const backedUp = await stat(backup);
    const current = await fingerprint(target);
    if ((backedUp || !entry.existed) && current !== null && current !== entry.after) {
      throw new Error('Recovery stopped: managed files were modified after installation began; preserve the journal and backups.');
    }
    if (backedUp) {
      await fingerprint(backup);
      await fs.rm(target, { recursive: true, force: true });
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.rename(backup, target);
    } else if (!entry.existed) {
      await fs.rm(target, { recursive: true, force: true });
    }
  }
  await prune(root, journal.createdParents);
}

async function acquire(root) {
  const directory = await safePath(root, JOURNAL);
  try { await fs.mkdir(directory, { mode: 0o700 }); return directory; } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }
  // No process guessing across hosts. Unknown/corrupt journals require inspection.
  let journal;
  try { journal = JSON.parse(await fs.readFile(await safePath(root, `${JOURNAL}/journal.json`), 'utf8')); }
  catch { throw new Error('Installation in progress or interrupted before journal creation; inspect .ai-workflow-install before retrying.'); }
  if (journal.hostname !== os.hostname() || !Number.isSafeInteger(journal.pid) || journal.pid < 1) {
    throw new Error('Installation locked by an unknown owner; inspect .ai-workflow-install.');
  }
  try { process.kill(journal.pid, 0); throw new Error('Installation in progress; retry after it exits.'); }
  catch (error) { if (error.code !== 'ESRCH') throw error; }
  const valid = journal.version === 1 && ['preparing', 'committing', 'committed'].includes(journal.state)
    && Array.isArray(journal.entries) && journal.entries.every((entry) => PATHS.includes(entry.relative) && typeof entry.existed === 'boolean' && (entry.existed ? typeof entry.before === 'string' : entry.before === null) && (entry.after === null || typeof entry.after === 'string'))
    && new Set(journal.entries.map((entry) => entry.relative)).size === journal.entries.length
    && Array.isArray(journal.createdParents) && journal.createdParents.every((dir) => PATHS.some((file) => parents(file).includes(dir)));
  if (!valid) throw new Error('Invalid installation journal; preserve backups for manual recovery.');
  try { await fs.mkdir(path.join(directory, 'recovering')); } catch {
    throw new Error('Installation recovery locked; inspect .ai-workflow-install before retrying.');
  }
  try {
    await fingerprint(directory);
    if (journal.state === 'committing') await rollback(root, directory, journal);
  } finally {
    await fs.rmdir(await safePath(root, `${JOURNAL}/recovering`));
  }
  await fs.rm(directory, { recursive: true });
  return acquire(root);
}

export async function installTransaction(root, prepare) {
  await fs.mkdir(root, { recursive: true });
  root = await fs.realpath(root);
  const directory = await acquire(root);
  const stage = path.join(directory, 'stage');
  const journal = { version: 1, hostname: os.hostname(), pid: process.pid, state: 'preparing', entries: [], createdParents: [] };
  try {
    await writeJournal(directory, journal);
    await fs.mkdir(stage);
    const before = new Map();
    for (const relative of PATHS) {
      const target = await safePath(root, relative);
      const hash = await fingerprint(target);
      before.set(relative, hash);
      if (hash !== null) {
        const copy = path.join(stage, relative);
        await fs.mkdir(path.dirname(copy), { recursive: true });
        await fs.cp(target, copy, { recursive: true, preserveTimestamps: true });
      }
    }
    const result = await prepare(stage);
    for (const relative of PATHS) {
      const after = await fingerprint(path.join(stage, relative));
      if (before.get(relative) === after) continue;
      journal.entries.push({ relative, existed: before.get(relative) !== null, before: before.get(relative), after });
      for (const parent of parents(relative)) {
        if (!await stat(path.join(root, parent))) journal.createdParents.push(parent);
      }
    }
    // Detect user edits made while the staged installation was being prepared.
    for (const relative of PATHS) {
      if (before.get(relative) !== await fingerprint(await safePath(root, relative))) {
        throw new Error('Managed files changed during installation; retry without concurrent edits.');
      }
    }
    await fs.mkdir(path.join(directory, 'backup'));
    journal.state = 'committing';
    await writeJournal(directory, journal);
    for (const entry of journal.entries) {
      const target = await safePath(root, entry.relative);
      if (!entry.existed && await stat(target)) throw new Error('Managed files changed during installation; refusing to replace a new user file.');
      if (entry.existed) {
        const backup = path.join(directory, 'backup', entry.relative);
        await fs.mkdir(path.dirname(backup), { recursive: true });
        await fs.rename(target, backup);
        if (await fingerprint(backup) !== before.get(entry.relative)) {
          // This process just moved a concurrent edit, not a recovered backup.
          await fs.rename(backup, target);
          throw new Error('Managed files changed during installation; restoring the moved user edit.');
        }
      }
      const source = path.join(stage, entry.relative);
      if (await stat(source)) {
        await fs.mkdir(path.dirname(target), { recursive: true });
        await fs.rename(source, target);
      }
    }
    await writeJournal(directory, { ...journal, state: 'committed' });
    journal.state = 'committed';
    const removedParents = [];
    for (const entry of journal.entries) {
      if (!await stat(path.join(root, entry.relative))) removedParents.push(...parents(entry.relative));
    }
    await prune(root, removedParents);
    await fs.rm(directory, { recursive: true });
    return result;
  } catch (error) {
    try {
      if (journal.state === 'committing') await rollback(root, directory, journal);
      if (journal.state !== 'committed') await fs.rm(directory, { recursive: true });
    } catch {
      throw new Error('Installation failed and rollback needs recovery; keep .ai-workflow-install backups and rerun init after this process exits.');
    }
    throw error;
  }
}

import { createHash } from 'node:crypto';
import {
  access,
  cp,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HOSTS, normalizeHosts, projectPath } from './paths.mjs';
import { managedBlockFor, removeManagedBlock, upsertManagedBlock } from './managed-block.mjs';
import { installTransaction } from './install-transaction.mjs';

const modulePackageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG_PATH = '.ai-workflow/config.json';
const CHECKER_PATH = '.ai-workflow/bin/check.mjs';
const TEMPLATE_PATHS = Object.freeze([
  ['skills/workflow/assets/STORY.md', 'templates/ai-workflow/STORY.md'],
  ['skills/workflow/assets/TASK.md', 'templates/ai-workflow/TASK.md'],
]);

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

async function readText(file, fallback = '') {
  try {
    return await readFile(file, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') return fallback;
    throw error;
  }
}

function sha256(content) {
  return createHash('sha256').update(content).digest('hex');
}

async function fileHash(file) {
  return sha256(await readFile(file));
}

async function treeHash(directory) {
  if (!await exists(directory)) return null;
  const entries = [];

  async function walk(current, prefix = '') {
    const children = await readdir(current, { withFileTypes: true });
    children.sort((left, right) => left.name.localeCompare(right.name));
    for (const child of children) {
      const relative = path.posix.join(prefix, child.name);
      const full = path.join(current, child.name);
      if (child.isDirectory()) await walk(full, relative);
      else entries.push(`${relative}:${await fileHash(full)}`);
    }
  }

  await walk(directory);
  return sha256(entries.join('\n'));
}

async function writeIfChanged(file, content) {
  const previous = await readText(file, null);
  if (previous === content) return false;
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, content);
  return true;
}

async function packageVersion(packageRoot) {
  try {
    return JSON.parse(await readFile(path.join(packageRoot, 'package.json'), 'utf8')).version;
  } catch {
    return '3.0.0';
  }
}

async function readConfig(root) {
  try {
    return JSON.parse(await readFile(projectPath(root, CONFIG_PATH), 'utf8'));
  } catch {
    return null;
  }
}

async function inspectManagedTree({ source, target, previousHash, relative }) {
  const sourceHash = await treeHash(source);
  const currentHash = await treeHash(target);

  if (!sourceHash) throw new Error(`Canonical workflow skill is missing: ${source}`);
  if (currentHash && currentHash !== sourceHash && !previousHash) {
    throw new Error(`Refusing to overwrite existing skill: ${relative}`);
  }

  return { source, target, sourceHash, currentHash, previousHash, relative };
}

async function applyManagedTree(plan) {
  const { source, target, sourceHash, currentHash, previousHash, relative } = plan;
  if (currentHash === sourceHash) return { changed: false, hash: sourceHash, preserved: false };
  if (currentHash && previousHash && currentHash !== previousHash) {
    return { changed: false, hash: sourceHash, preserved: true, relative };
  }

  await rm(target, { recursive: true, force: true });
  await mkdir(path.dirname(target), { recursive: true });
  await cp(source, target, { recursive: true });
  return { changed: true, hash: sourceHash, preserved: false };
}

async function applyManagedFile({ source, target, previousHash, relative }) {
  const sourceContent = await readFile(source);
  const sourceHash = sha256(sourceContent);
  if (await exists(target)) {
    const currentHash = await fileHash(target);
    if (currentHash === sourceHash) return { changed: false, hash: sourceHash, preserved: false };
    if (!previousHash || currentHash !== previousHash) {
      return { changed: false, hash: sourceHash, preserved: true, relative };
    }
  }

  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, sourceContent);
  return { changed: true, hash: sourceHash, preserved: false };
}

async function removeTreeIfUnchanged(root, relative, expectedHash, preserved) {
  const target = projectPath(root, relative);
  if (!await exists(target)) return false;
  if (!expectedHash || await treeHash(target) !== expectedHash) {
    preserved.push(relative);
    return false;
  }
  await rm(target, { recursive: true, force: true });
  return true;
}

async function removeFileIfUnchanged(root, relative, expectedHash, preserved) {
  const target = projectPath(root, relative);
  if (!await exists(target)) return false;
  if (!expectedHash || await fileHash(target) !== expectedHash) {
    preserved.push(relative);
    return false;
  }
  await rm(target, { force: true });
  return true;
}

async function installPrepared({
  root = process.cwd(),
  packageRoot = modulePackageRoot,
  hosts = ['codex', 'claude'],
} = {}) {
  root = path.resolve(root);
  packageRoot = path.resolve(packageRoot);
  const selectedHosts = normalizeHosts(hosts);
  const previous = await readConfig(root);
  const previousHosts = new Set(previous?.hosts ?? []);
  const skillSource = path.join(packageRoot, 'skills/workflow');
  const preserved = [];
  const installed = [];
  let changed = false;

  // Preflight conflicts and malformed instruction markers before any write.
  const treePlans = new Map();
  for (const host of selectedHosts) {
    const hostConfig = HOSTS[host];
    treePlans.set(host, await inspectManagedTree({
      source: skillSource,
      target: projectPath(root, hostConfig.skillDir),
      previousHash: previous?.managedTrees?.[hostConfig.skillDir],
      relative: hostConfig.skillDir,
    }));
  }

  const instructionPlans = new Map();
  for (const [host, hostConfig] of Object.entries(HOSTS)) {
    const file = projectPath(root, hostConfig.instructionFile);
    const current = await readText(file, '');
    if (selectedHosts.includes(host)) {
      instructionPlans.set(host, { file, current, next: upsertManagedBlock(current, managedBlockFor(host)) });
    } else if (previousHosts.has(host)) {
      instructionPlans.set(host, { file, current, next: removeManagedBlock(current) });
    }
  }

  for (const host of previousHosts) {
    if (selectedHosts.includes(host) || !HOSTS[host]) continue;
    const relative = HOSTS[host].skillDir;
    changed = await removeTreeIfUnchanged(
      root,
      relative,
      previous?.managedTrees?.[relative],
      preserved,
    ) || changed;
  }

  for (const { file, current, next } of instructionPlans.values()) {
    if (next !== current) {
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, next);
      changed = true;
    }
  }

  const managedTrees = {};
  for (const host of selectedHosts) {
    const relative = HOSTS[host].skillDir;
    const result = await applyManagedTree(treePlans.get(host));
    changed = result.changed || changed;
    managedTrees[relative] = result.hash;
    if (result.changed) installed.push(relative);
    if (result.preserved) preserved.push(relative);
  }

  const managedFiles = {};
  for (const [sourceRelative, targetRelative] of TEMPLATE_PATHS) {
    const result = await applyManagedFile({
      source: path.join(packageRoot, sourceRelative),
      target: projectPath(root, targetRelative),
      previousHash: previous?.managedFiles?.[targetRelative]
        ?? previous?.templateHashes?.[targetRelative],
      relative: targetRelative,
    });
    changed = result.changed || changed;
    managedFiles[targetRelative] = result.hash;
    if (result.changed) installed.push(targetRelative);
    if (result.preserved) preserved.push(targetRelative);
  }

  const checkerResult = await applyManagedFile({
    source: path.join(packageRoot, 'assets/check.mjs'),
    target: projectPath(root, CHECKER_PATH),
    previousHash: previous?.managedFiles?.[CHECKER_PATH],
    relative: CHECKER_PATH,
  });
  changed = checkerResult.changed || changed;
  managedFiles[CHECKER_PATH] = checkerResult.hash;
  if (checkerResult.changed) installed.push(CHECKER_PATH);
  if (checkerResult.preserved) preserved.push(CHECKER_PATH);

  const config = `${JSON.stringify({
    schemaVersion: 2,
    packageVersion: await packageVersion(packageRoot),
    hosts: selectedHosts,
    managedFiles,
    managedTrees,
  }, null, 2)}\n`;
  changed = await writeIfChanged(projectPath(root, CONFIG_PATH), config) || changed;

  return { changed, installed, preserved, hosts: selectedHosts };
}

export async function installWorkflow(options = {}) {
  const root = path.resolve(options.root ?? process.cwd());
  return installTransaction(root, (stage) => installPrepared({ ...options, root: stage }));
}

async function removeEmptyParents(file, stopAt) {
  let current = path.dirname(file);
  while (current.startsWith(stopAt) && current !== stopAt) {
    try {
      if ((await readdir(current)).length > 0) break;
      // fs.rm refuses a directory without `recursive`, and the catch below would
      // swallow the EISDIR — leaving every emptied parent on disk, silently.
      await rm(current, { recursive: true });
      current = path.dirname(current);
    } catch {
      break;
    }
  }
}

async function removePrepared({ root = process.cwd() } = {}) {
  root = path.resolve(root);
  const config = await readConfig(root);
  const preserved = [];
  let changed = false;

  // Marker ownership makes these safe to strip even when config is missing.
  const instructionPlans = [];
  for (const { instructionFile } of Object.values(HOSTS)) {
    const file = projectPath(root, instructionFile);
    if (!await exists(file)) continue;
    const current = await readFile(file, 'utf8');
    instructionPlans.push({ file, current, next: removeManagedBlock(current) });
  }
  for (const { file, current, next } of instructionPlans) {
    if (next !== current) {
      await writeFile(file, next);
      changed = true;
    }
  }

  for (const host of config?.hosts ?? []) {
    const relative = HOSTS[host]?.skillDir;
    if (!relative) continue;
    const removed = await removeTreeIfUnchanged(
      root,
      relative,
      config?.managedTrees?.[relative],
      preserved,
    );
    changed = removed || changed;
    if (removed) await removeEmptyParents(projectPath(root, relative), root);
  }

  for (const [, targetRelative] of TEMPLATE_PATHS) {
    const expectedHash = config?.managedFiles?.[targetRelative]
      ?? config?.templateHashes?.[targetRelative];
    const removed = await removeFileIfUnchanged(root, targetRelative, expectedHash, preserved);
    changed = removed || changed;
    if (removed) await removeEmptyParents(projectPath(root, targetRelative), root);
  }

  const checkerRemoved = await removeFileIfUnchanged(
    root,
    CHECKER_PATH,
    config?.managedFiles?.[CHECKER_PATH],
    preserved,
  );
  changed = checkerRemoved || changed;
  if (checkerRemoved) await removeEmptyParents(projectPath(root, CHECKER_PATH), root);

  const configFile = projectPath(root, CONFIG_PATH);
  if (await exists(configFile)) {
    await rm(configFile, { force: true });
    changed = true;
    await removeEmptyParents(configFile, root);
  }

  return { changed, preserved };
}

export async function removeWorkflow({ root = process.cwd() } = {}) {
  return installTransaction(path.resolve(root), (stage) => removePrepared({ root: stage }));
}

import fs from 'node:fs/promises';
import path from 'node:path';

const SKIP = new Set(['node_modules', 'build', 'dist', 'out', 'target', 'coverage']);
const LIMIT = 20;

export const COPIES_RULE = 'Each listed copy that has the behavior the request changes is in To-be, unless the request names a copy '
  + 'with a word the code uses for it (cite file:line); a copy without that behavior is not. Otherwise ask OPEN BLOCKING. '
  + 'Write the list and the decision as the first Decisions line.';

/** Every project file as a posix path, skipping dot folders and build or dependency output. */
export async function listFiles(root) {
  const files = [];
  const walk = async dir => {
    const entries = await fs.readdir(path.join(root, dir), { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      const rel = dir ? `${dir}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (!entry.name.startsWith('.') && !SKIP.has(entry.name)) await walk(rel);
      } else if (entry.isFile()) files.push(rel);
    }
  };
  await walk('');
  return files;
}

const clean = target => path.posix.normalize(target).replace(/^(?:\.\/)+/, '').replace(/\/+$/, '');

/** How many trailing path segments two paths share, ignoring case. */
const sharedTail = (a, b) => {
  const left = a.toLowerCase().split('/');
  const right = b.toLowerCase().split('/');
  let count = 0;
  while (count < left.length && count < right.length && left[left.length - 1 - count] === right[right.length - 1 - count]) count += 1;
  return count;
};

/**
 * Folders elsewhere that hold the same files as `target`: the same paths inside, ignoring case.
 * Their own names may differ (brand-a and brand-b/ko). At least two shared files, unless the
 * target holds one, and at least 30% of the smaller folder.
 */
function folderCopies(files, target) {
  const prefix = `${target}/`;
  const inside = new Set(files.filter(file => file.startsWith(prefix)).map(file => file.slice(prefix.length).toLowerCase()));
  const shared = new Map();
  const sizes = new Map();
  for (const file of files) {
    const parts = file.split('/');
    for (let cut = 1; cut < parts.length; cut += 1) {
      const folder = parts.slice(0, cut).join('/');
      sizes.set(folder, (sizes.get(folder) ?? 0) + 1);
      if (file.startsWith(prefix) || folder === target || target.startsWith(`${folder}/`) || folder.startsWith(prefix)) continue;
      if (inside.has(parts.slice(cut).join('/').toLowerCase())) shared.set(folder, (shared.get(folder) ?? 0) + 1);
    }
  }
  return [...shared]
    .filter(([folder, count]) => count >= Math.min(2, inside.size) && count / Math.min(inside.size, sizes.get(folder)) >= 0.3)
    .sort(([a, x], [b, y]) => y - x || sharedTail(b, target) - sharedTail(a, target) || a.localeCompare(b))
    .map(([folder]) => folder);
}

/**
 * Parallel copies of each target. A file's copies have the same name and parent folder, ignoring
 * case (a shared file name alone, index.tsx, is not a copy); a folder's copies hold the same files.
 * Closest first.
 */
export async function findCopies(root, targets) {
  if (!targets.length) throw new Error('copies needs at least one file or folder.');
  const files = await listFiles(root);
  const copies = [];
  for (const raw of targets) {
    const target = clean(raw);
    const stat = await fs.stat(path.join(root, target)).catch(() => null);
    if (!stat) throw new Error(`Not found: ${raw}`);
    const found = stat.isDirectory() ? folderCopies(files, target) : files
      .filter(candidate => candidate !== target)
      .map(candidate => ({ candidate, shared: sharedTail(candidate, target) }))
      .filter(({ shared }) => shared >= 2)
      .sort((a, b) => b.shared - a.shared || a.candidate.localeCompare(b.candidate))
      .map(({ candidate }) => candidate);
    copies.push({ path: target, copies: found.slice(0, LIMIT), ...(found.length > LIMIT ? { more: found.length - LIMIT } : {}) });
  }
  return { copies, rule: COPIES_RULE };
}

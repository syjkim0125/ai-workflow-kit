import fs from 'node:fs/promises';
import path from 'node:path';

const SKIP = new Set(['node_modules', 'build', 'dist', 'out', 'target', 'coverage']);
const LIMIT = 20;

export const COPIES_RULE = 'Every copy listed is in To-be unless the request names that copy with a word the code uses for it '
  + '(cite file:line); otherwise ask OPEN BLOCKING. Write the list and the decision as the first Decisions line.';

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
 * Parallel copies of each target: files (or folders) elsewhere whose name and parent folder match,
 * ignoring case, closest first. A shared file name alone (index.tsx) is not a copy.
 */
export async function findCopies(root, targets) {
  if (!targets.length) throw new Error('copies needs at least one file or folder.');
  const files = await listFiles(root);
  const folders = [...new Set(files.flatMap(file => {
    const parts = file.split('/');
    return parts.slice(1).map((_, index) => parts.slice(0, index + 1).join('/'));
  }))];
  const copies = [];
  for (const raw of targets) {
    const target = clean(raw);
    const stat = await fs.stat(path.join(root, target)).catch(() => null);
    if (!stat) throw new Error(`Not found: ${raw}`);
    const pool = stat.isDirectory() ? folders : files;
    const found = pool
      .filter(candidate => candidate !== target && !candidate.startsWith(`${target}/`) && !target.startsWith(`${candidate}/`))
      .map(candidate => ({ candidate, shared: sharedTail(candidate, target) }))
      .filter(({ shared }) => shared >= 2)
      .sort((a, b) => b.shared - a.shared || a.candidate.localeCompare(b.candidate))
      .map(({ candidate }) => candidate);
    copies.push({ path: target, copies: found.slice(0, LIMIT), ...(found.length > LIMIT ? { more: found.length - LIMIT } : {}) });
  }
  return { copies, rule: COPIES_RULE };
}

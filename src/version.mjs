import { readFile } from 'node:fs/promises';
import path from 'node:path';

export async function readPackageVersion(packageRoot) {
  try {
    return JSON.parse(await readFile(path.join(packageRoot, 'package.json'), 'utf8')).version;
  } catch {
    return '3.0.0';
  }
}

const SEMVER = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;

// Negative when left < right, positive when left > right, 0 when equal, null when
// either side is not a version (a hand-edited or missing packageVersion).
export function compareVersions(left, right) {
  const a = SEMVER.exec(String(left ?? ''));
  const b = SEMVER.exec(String(right ?? ''));
  if (!a || !b) return null;
  for (let index = 1; index <= 3; index += 1) {
    const difference = Number(a[index]) - Number(b[index]);
    if (difference) return Math.sign(difference);
  }
  if (a[4] === b[4]) return 0;
  if (!a[4]) return 1;
  if (!b[4]) return -1;
  return a[4] < b[4] ? -1 : 1;
}

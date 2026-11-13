import fs from 'node:fs/promises';
import path from 'node:path';
import { projectFile, readJson } from './storage.mjs';
import { PROFILE } from './verification.mjs';

const TIMEOUT = 300000;
const present = async (root, file) => fs.access(await projectFile(root, file)).then(() => true, () => false);

/** A check profile from the repository type, covering every Story V ID. */
export async function detectProfile({ root, ids, scope }) {
  const covers = ids.filter(id => /^V-?\d+$/.test(id));
  if (!covers.length) throw new Error('The Story has no V# items to cover.');
  const checks = [];
  if (await present(root, 'package.json')) {
    const pkg = await readJson(root, 'package.json');
    const dependencies = { ...pkg.dependencies, ...pkg.devDependencies };
    const test = pkg.scripts?.test;
    if (typeof test === 'string' && test.trim() && !/no test specified/i.test(test)) {
      const argv = dependencies['react-scripts'] ? ['npm', 'test', '--', '--watchAll=false'] : ['npm', 'test'];
      // A scope keeps the check on the touched path, so it fits the critical path.
      checks.push({ id: 'test', argv: scope ? [...argv, ...(argv.includes('--') ? [] : ['--']), scope] : argv });
    }
    if (typeof pkg.scripts?.typecheck === 'string') checks.push({ id: 'typecheck', argv: ['npm', 'run', 'typecheck'] });
    else if (await present(root, 'tsconfig.json')) checks.push({ id: 'typecheck', argv: ['npx', 'tsc', '--noEmit'] });
  }
  if (await present(root, 'gradlew')) checks.push({ id: 'gradle-test', argv: ['./gradlew', scope ? `:${scope.split('/')[0]}:test` : 'test'] });
  if (!checks.length) {
    throw new Error('No test command detected (package.json scripts.test, typecheck/tsconfig.json, or gradlew); '
      + 'write .ai-workflow/verification.json by hand, as references/verification.md describes.');
  }
  return { version: 1, checks: checks.map(check => ({ ...check, covers, timeoutMs: TIMEOUT })) };
}

/** Write the detected profile unless one exists; return what applies now. */
export async function writeProfile({ root, ids, scope }) {
  const file = await projectFile(root, PROFILE);
  if (await present(root, PROFILE)) {
    const existing = await readJson(root, PROFILE);
    return { profile: PROFILE, written: false, checks: (existing.checks ?? []).map(({ id, argv }) => ({ id, argv })) };
  }
  const value = await detectProfile({ root, ids, scope });
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
  return { profile: PROFILE, written: true, checks: value.checks.map(({ id, argv }) => ({ id, argv })) };
}

export const BASELINE_NARROW = 'Narrow each failing check in .ai-workflow/verification.json so it excludes failures that existed before this change '
  + '(for example a test path or filter), init a new run file, and run baseline again.';

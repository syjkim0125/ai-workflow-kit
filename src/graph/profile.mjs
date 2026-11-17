import fs from 'node:fs/promises';
import path from 'node:path';
import { projectFile, readJson } from './storage.mjs';
import { PROFILE } from './verification.mjs';

const TIMEOUT = 300000;
// Placeholders in detected checks; each run resolves them from its own --scope, so one shared
// profile never carries another Story's scope.
export const SCOPE = '{scope}';
export const GRADLE_TEST = '{gradle-test}';

const cleanScope = scope => (scope ? path.posix.normalize(scope).replace(/^(?:\.\/)+/, '').replace(/^:+/, '').replace(/\/+$/, '') : '');

/** The Gradle task for a scope: the deepest module directory with a build file, else the root test task. */
async function gradleTask(root, scope) {
  for (let dir = scope; dir && dir !== '.'; dir = path.posix.dirname(dir)) {
    for (const file of ['build.gradle', 'build.gradle.kts']) {
      if (await present(root, `${dir}/${file}`)) return `:${dir.split('/').join(':')}:test`;
    }
  }
  return 'test';
}

/** A check's argv with its placeholders resolved for one run's scope. */
export async function resolveArgv(root, argv, scope) {
  const clean = cleanScope(scope);
  const out = [];
  for (const arg of argv) {
    if (arg === SCOPE) { if (clean && clean !== '.') out.push(clean); }
    else if (arg === GRADLE_TEST) out.push(clean ? await gradleTask(root, clean) : 'test');
    else out.push(arg);
  }
  return out;
}

/** Resolved argv for every check of a profile, keyed by check id. */
export async function resolveChecks(root, checks, scope) {
  return Object.fromEntries(await Promise.all(checks.map(async check => [check.id, await resolveArgv(root, check.argv, scope)])));
}
const present = async (root, file) => fs.access(await projectFile(root, file)).then(() => true, () => false);

/** A check profile from the repository type, covering every Story V ID. */
export async function detectProfile({ root, ids }) {
  const covers = ids.filter(id => /^V-?\d+$/.test(id));
  if (!covers.length) throw new Error('The Story has no V# items to cover.');
  const checks = [];
  if (await present(root, 'package.json')) {
    const pkg = await readJson(root, 'package.json');
    const dependencies = { ...pkg.dependencies, ...pkg.devDependencies };
    const test = pkg.scripts?.test;
    if (typeof test === 'string' && test.trim() && !/no test specified/i.test(test)) {
      const argv = dependencies['react-scripts'] ? ['npm', 'test', '--', '--watchAll=false'] : ['npm', 'test'];
      // Only runners that take a path filter get the per-run {scope}; node --test and others would fail on it.
      const filters = /\b(?:react-scripts|jest|vitest|mocha)\b/.test(test);
      checks.push({ id: 'test', argv: filters ? [...argv, ...(argv.includes('--') ? [] : ['--']), SCOPE] : argv });
    }
    if (typeof pkg.scripts?.typecheck === 'string') checks.push({ id: 'typecheck', argv: ['npm', 'run', 'typecheck'] });
    else if (await present(root, 'tsconfig.json')) checks.push({ id: 'typecheck', argv: ['npx', 'tsc', '--noEmit'] });
  }
  if (await present(root, 'gradlew')) checks.push({ id: 'gradle-test', argv: ['./gradlew', GRADLE_TEST] });
  if (!checks.length) {
    throw new Error('No test command detected (package.json scripts.test, typecheck/tsconfig.json, or gradlew); '
      + 'write .ai-workflow/verification.json by hand, as references/verification.md describes.');
  }
  return { version: 1, checks: checks.map(check => ({ ...check, covers, timeoutMs: TIMEOUT })) };
}

/** Write the detected profile unless one exists; return what applies now. */
export async function writeProfile({ root, ids }) {
  const file = await projectFile(root, PROFILE);
  if (await present(root, PROFILE)) {
    const existing = await readJson(root, PROFILE);
    return { profile: PROFILE, written: false, checks: (existing.checks ?? []).map(({ id, argv }) => ({ id, argv })) };
  }
  const value = await detectProfile({ root, ids });
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
  return { profile: PROFILE, written: true, checks: value.checks.map(({ id, argv }) => ({ id, argv })) };
}

export const BASELINE_NARROW = 'Narrow each failing check in .ai-workflow/verification.json so it excludes failures that existed before this change '
  + '(for example a test path or filter), init a new run file, and run baseline again.';

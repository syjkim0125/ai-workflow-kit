import { spawn } from 'node:child_process';

export const CHECKER_PATH = '.ai-workflow/bin/check.mjs';
export const GITIGNORE_EXCEPTION = '!.ai-workflow/bin/';

function git(args, cwd) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn('git', args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch {
      resolve({ code: null, stdout: '' });
      return;
    }
    let stdout = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', () => {});
    child.on('error', () => resolve({ code: null, stdout: '' }));
    child.on('close', (code) => resolve({ code, stdout }));
  });
}

/**
 * Whether the gate checker can actually reach the repository.
 *
 * A checker sitting on disk that `git add` silently skips is the worst kind of
 * install: every file-existence check passes and the gates still cannot be
 * enforced for anyone who clones. Common Java and build .gitignore templates
 * carry a bare `bin/` rule, which swallows `.ai-workflow/bin/` along with it.
 *
 * Returns one of:
 *   { status: 'tracked' }   already committed, so no rule can hide it
 *   { status: 'visible' }   not ignored
 *   { status: 'ignored', source }  source is "<file>:<line>:<pattern>"
 *   { status: 'no-git' }    no git, or not a work tree — nothing to say
 */
export async function checkerVisibility(root, relative = CHECKER_PATH) {
  const { file, ...visibility } = (await fileVisibilities(root, [relative]))[0];
  return visibility;
}

export async function fileVisibilities(root, files) {
  const inside = await git(['rev-parse', '--is-inside-work-tree'], root);
  if (inside.code !== 0 || inside.stdout.trim() !== 'true') return files.map(file => ({ file, status: 'no-git' }));
  const [tracked, ignored] = await Promise.all([
    git(['ls-files', '--', ...files], root), git(['check-ignore', '-v', '--', ...files], root),
  ]);
  const trackedFiles = new Set(tracked.stdout.trim().split('\n'));
  const sources = new Map();
  for (const line of ignored.stdout.trim().split('\n')) {
    const [source, file] = line.split('\t');
    if (file && !source.split(':').slice(2).join(':').startsWith('!')) sources.set(file, source);
  }
  return files.map(file => trackedFiles.has(file) ? { file, status: 'tracked' }
    : sources.has(file) ? { file, status: 'ignored', source: sources.get(file) }
      : { file, status: 'visible' });
}

export function ignoredCheckerAdvice({ source }) {
  return [
    `${source} hides ${CHECKER_PATH} from git.`,
    `The file is on disk, but \`git add\` skips it without a word, so the gate`,
    `checker never reaches anyone who clones this repository.`,
    `Fix: add "${GITIGNORE_EXCEPTION}" to .gitignore, below the rule above.`,
  ];
}

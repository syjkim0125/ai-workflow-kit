import assert from 'node:assert/strict';
import { readFile, mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import { installWorkflow } from '../src/install.mjs';

const root = path.resolve(import.meta.dirname, '..');
const read = (file) => readFile(path.join(root, file), 'utf8');

test('release versions agree across package, plugins and marketplace', async () => {
  const pkg = JSON.parse(await read('package.json'));
  assert.equal(pkg.version, '3.1.0');
  for (const file of ['.claude-plugin/plugin.json', '.codex-plugin/plugin.json']) {
    assert.equal(JSON.parse(await read(file)).version, pkg.version, file);
  }
  const marketplace = JSON.parse(await read('.claude-plugin/marketplace.json'));
  assert.equal(marketplace.plugins[0].version, pkg.version);
  assert.deepEqual(pkg.repository, { type: 'git', url: 'git+https://github.com/syjkim0125/ai-workflow-kit.git' });
  assert.equal(pkg.homepage, 'https://github.com/syjkim0125/ai-workflow-kit#readme');
  assert.deepEqual(pkg.bugs, { url: 'https://github.com/syjkim0125/ai-workflow-kit/issues' });
});

test('README and CLI help distinguish each host for request, status and finish', async () => {
  const readme = await read('README.md');
  const help = execFileSync(process.execPath, ['bin/ai-workflow-kit.mjs', '--help'], { cwd: root, encoding: 'utf8' });
  for (const text of [readme, help]) {
    for (const [host, prefix] of [['Codex', '$'], ['Claude Code', '/']]) {
      const line = text.split('\n').filter((line) => line.includes(host)).join('\n');
      for (const suffix of ['', ' status', ' finish']) {
        assert.ok(line.includes(`${prefix}workflow${suffix}`), `${host}: ${suffix || 'request'}`);
      }
    }
  }
  assert.doesNotMatch(readme, /pazmo-ai-workflow-kit-\d+\.\d+\.\d+\.tgz/);
  assert.doesNotMatch(readme, /대화가 끊겼다[^\n]*`\/workflow`/);
  assert.match(readme, /새.*(?:세션|작업)|new (?:session|task)/i);
});

test('installed host routing carries native invocation and restart guidance', async () => {
  const project = await mkdtemp(path.join(os.tmpdir(), 'workflow-host-'));
  await installWorkflow({ root: project });
  for (const [file, native] of [['AGENTS.md', '$workflow'], ['CLAUDE.md', '/workflow']]) {
    const text = await readFile(path.join(project, file), 'utf8');
    assert.ok(text.includes(native));
    assert.ok(text.includes(`${native} status`));
    assert.ok(text.includes(`${native} finish`));
  }
  const text = await read('skills/workflow/SKILL.md');
  assert.match(text, /Codex[^\n]*\$workflow/);
  assert.match(text, /Claude Code[^\n]*\/workflow/);
});

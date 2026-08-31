import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, access } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function tempProject() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ai-workflow-kit-'));
  await writeFile(path.join(root, 'AGENTS.md'), '# Existing agents\n\nKeep me.\n');
  await writeFile(path.join(root, 'CLAUDE.md'), '# Existing claude\n\nKeep me too.\n');
  return root;
}

async function exists(file) {
  try { await access(file); return true; } catch { return false; }
}

test('fresh install preserves project content and installs both hosts', async () => {
  const { installWorkflow } = await import('../src/install.mjs');
  const root = await tempProject();
  const result = await installWorkflow({ root, packageRoot, hosts: ['codex', 'claude'] });
  assert.equal(result.changed, true);

  const agents = await readFile(path.join(root, 'AGENTS.md'), 'utf8');
  const claude = await readFile(path.join(root, 'CLAUDE.md'), 'utf8');
  assert.match(agents, /Keep me\./);
  assert.match(claude, /Keep me too\./);
  assert.equal((agents.match(/BEGIN ai-workflow-kit/g) ?? []).length, 1);
  assert.equal((claude.match(/BEGIN ai-workflow-kit/g) ?? []).length, 1);

  assert.equal(await exists(path.join(root, '.agents/skills/workflow/SKILL.md')), true);
  assert.equal(await exists(path.join(root, '.claude/skills/workflow/SKILL.md')), true);
  assert.equal(await exists(path.join(root, 'templates/ai-workflow/STORY.md')), true);
  assert.equal(await exists(path.join(root, 'templates/ai-workflow/TASK.md')), true);
  assert.equal(await exists(path.join(root, '.ai-workflow/bin/check.mjs')), true);
});

test('re-running install is idempotent', async () => {
  const { installWorkflow } = await import('../src/install.mjs');
  const root = await tempProject();
  await installWorkflow({ root, packageRoot, hosts: ['codex', 'claude'] });
  const before = await readFile(path.join(root, 'AGENTS.md'), 'utf8');
  const result = await installWorkflow({ root, packageRoot, hosts: ['codex', 'claude'] });
  const after = await readFile(path.join(root, 'AGENTS.md'), 'utf8');
  assert.equal(result.changed, false);
  assert.equal(after, before);
  assert.equal((after.match(/BEGIN ai-workflow-kit/g) ?? []).length, 1);
});

test('host selection installs only the requested runtime copy', async () => {
  const { installWorkflow } = await import('../src/install.mjs');
  const root = await tempProject();
  await installWorkflow({ root, packageRoot, hosts: ['codex'] });
  assert.equal(await exists(path.join(root, '.agents/skills/workflow/SKILL.md')), true);
  assert.equal(await exists(path.join(root, '.claude/skills/workflow/SKILL.md')), false);
});

test('remove strips managed files but preserves modified template and project prose', async () => {
  const { installWorkflow, removeWorkflow } = await import('../src/install.mjs');
  const root = await tempProject();
  await installWorkflow({ root, packageRoot, hosts: ['codex', 'claude'] });
  const template = path.join(root, 'templates/ai-workflow/STORY.md');
  await writeFile(template, '# My edited template\n');

  const result = await removeWorkflow({ root });
  const agents = await readFile(path.join(root, 'AGENTS.md'), 'utf8');
  assert.match(agents, /Keep me\./);
  assert.doesNotMatch(agents, /BEGIN ai-workflow-kit/);
  assert.equal(await exists(path.join(root, '.agents/skills/workflow')), false);
  assert.equal(await exists(path.join(root, '.claude/skills/workflow')), false);
  assert.equal(await readFile(template, 'utf8'), '# My edited template\n');
  assert.ok(result.preserved.includes('templates/ai-workflow/STORY.md'));
});

test('repeated updates never overwrite a user-modified template', async () => {
  const { installWorkflow } = await import('../src/install.mjs');
  const root = await tempProject();
  await installWorkflow({ root, packageRoot, hosts: ['codex', 'claude'] });
  const template = path.join(root, 'templates/ai-workflow/STORY.md');
  await writeFile(template, '# Team-owned template\n');

  const firstUpdate = await installWorkflow({ root, packageRoot, hosts: ['codex', 'claude'] });
  const secondUpdate = await installWorkflow({ root, packageRoot, hosts: ['codex', 'claude'] });

  assert.equal(await readFile(template, 'utf8'), '# Team-owned template\n');
  assert.ok(firstUpdate.preserved.includes('templates/ai-workflow/STORY.md'));
  assert.ok(secondUpdate.preserved.includes('templates/ai-workflow/STORY.md'));
});

test('fresh install refuses to overwrite a pre-existing workflow skill without partial changes', async () => {
  const { installWorkflow } = await import('../src/install.mjs');
  const { mkdir } = await import('node:fs/promises');
  const root = await tempProject();
  const skill = path.join(root, '.agents/skills/workflow/SKILL.md');
  await mkdir(path.dirname(skill), { recursive: true });
  await writeFile(skill, '# Existing team workflow\n');

  await assert.rejects(
    installWorkflow({ root, packageRoot, hosts: ['codex'] }),
    /Refusing to overwrite existing skill/
  );
  assert.equal(await readFile(skill, 'utf8'), '# Existing team workflow\n');
  assert.doesNotMatch(await readFile(path.join(root, 'AGENTS.md'), 'utf8'), /BEGIN ai-workflow-kit/);
});

test('remove preserves a team-modified installed skill', async () => {
  const { installWorkflow, removeWorkflow } = await import('../src/install.mjs');
  const root = await tempProject();
  await installWorkflow({ root, packageRoot, hosts: ['codex'] });
  const skill = path.join(root, '.agents/skills/workflow/SKILL.md');
  await writeFile(skill, '# Team-owned workflow skill\n');

  const result = await removeWorkflow({ root });

  assert.equal(await readFile(skill, 'utf8'), '# Team-owned workflow skill\n');
  assert.ok(result.preserved.includes('.agents/skills/workflow'));
});

test('changing host selection removes only the previously managed host', async () => {
  const { installWorkflow } = await import('../src/install.mjs');
  const root = await tempProject();
  await installWorkflow({ root, packageRoot, hosts: ['codex', 'claude'] });

  await installWorkflow({ root, packageRoot, hosts: ['claude'] });

  assert.equal(await exists(path.join(root, '.agents/skills/workflow')), false);
  assert.equal(await exists(path.join(root, '.claude/skills/workflow/SKILL.md')), true);
  assert.doesNotMatch(await readFile(path.join(root, 'AGENTS.md'), 'utf8'), /BEGIN ai-workflow-kit/);
  assert.match(await readFile(path.join(root, 'AGENTS.md'), 'utf8'), /Keep me\./);
});

test('a marker quoted inside a fenced example is documentation, not a live block', async () => {
  // Instruction files legitimately document this kit's own marker syntax. Treating a
  // fenced example as the live block silently rewrites that documentation.
  const root = await tempProject();
  const agents = path.join(root, 'AGENTS.md');
  await writeFile(agents, [
    '# House rules',
    '',
    'This kit manages the region between these markers:',
    '',
    '```',
    '<!-- BEGIN ai-workflow-kit -->',
    'DOC EXAMPLE BODY',
    '<!-- END ai-workflow-kit -->',
    '```',
    '',
    '- keep me',
    ''
  ].join('\n'));

  const { installWorkflow } = await import('../src/install.mjs');
  await installWorkflow({ root, packageRoot, hosts: ['codex', 'claude'] });
  const after = await readFile(agents, 'utf8');

  assert.ok(after.includes('DOC EXAMPLE BODY'), 'the fenced example must survive untouched');
  assert.ok(after.includes('- keep me'), 'surrounding prose must survive');
  const begins = after.split(/\r?\n/).filter((line) => line.trim() === '<!-- BEGIN ai-workflow-kit -->').length;
  assert.equal(begins, 2, 'one quoted marker plus exactly one appended live block');
});

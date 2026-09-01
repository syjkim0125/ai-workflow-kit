#!/usr/bin/env node
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkArtifact, checkGate } from '../assets/check.mjs';
import { installWorkflow, removeWorkflow } from '../src/install.mjs';
import { checkerVisibility, ignoredCheckerAdvice } from '../src/git-visibility.mjs';
import { END_MARKER, START_MARKER } from '../src/managed-block.mjs';
import { HOSTS } from '../src/paths.mjs';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function help() {
  console.log(`ai-workflow-kit

Usage:
  ai-workflow-kit init [--root <dir>] [--host all|codex|claude]
  ai-workflow-kit doctor [--root <dir>]
  ai-workflow-kit check story|task <file> [--root <dir>]
  ai-workflow-kit check gate G1|G4 <story-file> [--root <dir>]
  ai-workflow-kit remove [--root <dir>]
  ai-workflow-kit --version`);
}

function parse(argv) {
  const positional = [];
  let root = process.cwd();
  const hosts = [];
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--root') {
      if (!argv[index + 1]) throw new Error('--root requires a directory.');
      root = path.resolve(argv[++index]);
    } else if (value === '--host') {
      if (!argv[index + 1]) throw new Error('--host requires all, codex, or claude.');
      const host = argv[++index].toLowerCase();
      if (host === 'all' || host === 'both') hosts.push('codex', 'claude');
      else hosts.push(host);
    } else {
      positional.push(value);
    }
  }
  return { root, hosts: hosts.length ? [...new Set(hosts)] : ['codex', 'claude'], positional };
}

async function exists(file) {
  try { await access(file); return true; } catch { return false; }
}

async function doctor(root) {
  const configFile = path.join(root, '.ai-workflow/config.json');
  if (!await exists(configFile)) {
    console.log('MISS  workflow config: .ai-workflow/config.json');
    return false;
  }

  let config;
  try {
    config = JSON.parse(await readFile(configFile, 'utf8'));
  } catch {
    console.log('MISS  valid workflow config: .ai-workflow/config.json');
    return false;
  }

  const hosts = Array.isArray(config.hosts) ? config.hosts : [];
  if (hosts.length === 0 || hosts.some((host) => !HOSTS[host])) {
    console.log('MISS  configured hosts');
    return false;
  }

  const checks = [];
  for (const host of hosts) {
    const hostConfig = HOSTS[host];
    checks.push([`${host === 'codex' ? 'Codex' : 'Claude'} skill`, hostConfig.skillDir]);
    checks.push([`${hostConfig.instructionFile} routing block`, hostConfig.instructionFile, true]);
  }
  checks.push(
    ['Story template', 'templates/ai-workflow/STORY.md'],
    ['Task template', 'templates/ai-workflow/TASK.md'],
    ['Checker', '.ai-workflow/bin/check.mjs'],
  );

  let ok = true;
  for (const [label, relative, routing] of checks) {
    const file = path.join(root, relative);
    let present = await exists(file);
    if (present && routing) {
      const content = await readFile(file, 'utf8');
      present = content.includes(START_MARKER) && content.includes(END_MARKER);
    }
    console.log(`${present ? 'PASS' : 'MISS'}  ${label}: ${relative}`);
    ok &&= present;
  }

  const visibility = await checkerVisibility(root);
  if (visibility.status === 'ignored') {
    console.log(`MISS  Checker reaches git: ${visibility.source}`);
    for (const line of ignoredCheckerAdvice(visibility)) console.log(`      ${line}`);
    ok = false;
  } else if (visibility.status !== 'no-git') {
    console.log('PASS  Checker reaches git: .ai-workflow/bin/check.mjs');
  }

  return ok;
}

async function main(argv) {
  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) {
    help();
    return 0;
  }
  if (argv[0] === '--version' || argv[0] === '-v') {
    const pkg = JSON.parse(await readFile(path.join(packageRoot, 'package.json'), 'utf8'));
    console.log(pkg.version);
    return 0;
  }

  const command = argv[0];
  const { root, hosts, positional } = parse(argv.slice(1));

  if (command === 'init') {
    const result = await installWorkflow({ root, packageRoot, hosts });
    console.log(result.changed ? 'Installed/updated AI Workflow Kit.' : 'AI Workflow Kit is already up to date.');
    console.log(`Hosts: ${result.hosts.join(', ')}`);
    if (result.preserved.length) console.log(`Preserved modified files: ${result.preserved.join(', ')}`);
    const visibility = await checkerVisibility(root);
    if (visibility.status === 'ignored') {
      console.log('');
      console.log('WARNING');
      for (const line of ignoredCheckerAdvice(visibility)) console.log(`  ${line}`);
      console.log('');
    }
    if (result.hosts.includes('claude')) console.log('Next (Claude Code): /workflow <request>');
    if (result.hosts.includes('codex')) console.log('Next (Codex): $workflow <request>');
    return 0;
  }

  if (command === 'remove') {
    const result = await removeWorkflow({ root });
    console.log(result.changed ? 'Removed managed workflow files.' : 'Nothing managed was found.');
    if (result.preserved.length) console.log(`Preserved modified files: ${result.preserved.join(', ')}`);
    return 0;
  }

  if (command === 'doctor') return await doctor(root) ? 0 : 1;

  if (command === 'check') {
    let result;
    if (positional[0] === 'gate') {
      result = await checkGate({ root, gate: positional[1], file: positional[2] });
    } else {
      result = await checkArtifact({ root, kind: positional[0], file: positional[1] });
    }
    if (result.ok) {
      console.log('PASS');
      return 0;
    }
    for (const error of result.errors) console.error(`- ${error}`);
    return 1;
  }

  throw new Error(`Unknown command: ${command}`);
}

try {
  process.exitCode = await main(process.argv.slice(2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}

import path from 'node:path';

export const HOSTS = Object.freeze({
  codex: {
    instructionFile: 'AGENTS.md',
    skillDir: '.agents/skills/workflow',
  },
  claude: {
    instructionFile: 'CLAUDE.md',
    skillDir: '.claude/skills/workflow',
  },
});

export function normalizeHosts(hosts = ['codex', 'claude']) {
  const normalized = [...new Set(hosts.map((host) => String(host).toLowerCase()))];
  const invalid = normalized.filter((host) => !HOSTS[host]);
  if (invalid.length > 0) {
    throw new Error(`Unsupported host(s): ${invalid.join(', ')}. Use codex or claude.`);
  }
  return normalized.sort();
}

export function projectPath(root, relativePath) {
  return path.join(path.resolve(root), relativePath);
}

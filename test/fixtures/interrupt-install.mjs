import fs from 'node:fs/promises';
import path from 'node:path';
import { installWorkflow } from '../../src/install.mjs';

const root = await fs.realpath(process.argv[2]);
const mode = process.argv[3];
const rename = fs.rename;
let failed = false;
fs.rename = async (source, target) => {
  if (target === path.join(root, '.ai-workflow/config.json') && !failed) {
    failed = true;
    if (mode === 'crash') process.exit(73);
    throw new Error('injected config commit failure');
  }
  if (failed && mode === 'rollback-failure' && source.includes('/backup/')) throw new Error('injected rollback failure');
  return rename(source, target);
};
await installWorkflow({ root, hosts: ['codex'] });

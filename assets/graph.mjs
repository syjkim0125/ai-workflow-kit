#!/usr/bin/env node
// Installed alongside check.mjs; imports resolve inside .ai-workflow, without npm.
import { runGraphCommand } from '../graph/cli.mjs';
import { checkArtifact, checkGate } from './check.mjs';
try {
  // Compact JSON: an agent reads it, and every byte is context it carries.
  console.log(JSON.stringify(await runGraphCommand(process.argv.slice(2), { checkArtifact, checkGate })));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}

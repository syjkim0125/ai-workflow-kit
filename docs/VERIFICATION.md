# AI Workflow Kit v3 Verification

Verified on 2026-08-30 with Node.js v22.16.0.

## Evidence

- `node --check bin/*.mjs src/*.mjs assets/*.mjs test/*.mjs`: PASS
- `npm test`: 31/31 PASS
- `npm publish --dry-run --access public --json`: PASS; 20 package entries, 15,800 bytes packed, 45,881 bytes unpacked
- `npm pack --json`: `syjkim0125-ai-workflow-kit-3.0.0.tgz`
- Packed SHA-256: `d2e0cf1cd99e523fa02c9ccf70b09575e3f3ae9c30b819997250c860d325e5fa`
- Clean-project tarball E2E: PASS

The E2E run installed the packed artifact, repeated `init`, ran `doctor`, checked an Approved and Delivered Story, rejected a 31-line Task, required G4 evidence, preserved modified team files on removal, validated Codex-only installation, and refused a pre-existing skill conflict without partial writes.

## Boundaries

- The package was not published to npm because this environment is not authenticated; the scope/name must be confirmed by the publisher.
- Claude Code/Codex plugin marketplace import and ChatGPT Skill upload were not executed in native clients here. Their package shapes are covered by structural tests.
- The deterministic checker validates records, mappings, paths, and evidence presence. It cannot prove cognition; the conversational G4 protocol evaluates the human answer before writing `G4: PASS`.

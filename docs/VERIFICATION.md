# AI Workflow Kit 3.1.0 verification

Verified 2026-09-08. Release candidate, not published. Human G4 remains pending.

## Evidence

- npm latest at start: `@pazmo/ai-workflow-kit@3.0.4`.
- Full `npm test`: **82/82 PASS**, exit 0, Node 24.19.0.
- Full `node --test --test-reporter=spec test/*.test.mjs`: **82/82 PASS**, exit 0, Node 20.14.0.
- `git diff --check origin/main`: exit 0.
- Canonical Story checker and explicit G1 checker: exit 0. This is not G4 evidence.
- Independent installer/release and Jira reviews: no remaining Critical/Important issues; see [review record](understanding/workflow-kit-3-1-review.md).
- `npm pack --json`: prepack reruns all 82 tests; 25 entries, 34,119 bytes packed, 100,768 bytes unpacked.
- Artifact: `pazmo-ai-workflow-kit-3.1.0.tgz`.
- SHA-256: `e4b0842adb37c8eebdc04cbde265c5ae69476749fb50c546433272250cb5f224`.
- Inventory includes both plugin manifests, marketplace, executable CLI/checker, canonical skill/templates/references, and optional Jira module. No dependencies, credentials, tests, journals, local approval records or private evidence are packed.

Reproduce the actual-artifact smoke after packing:

```sh
node test/fixtures/verify-tarball.mjs /absolute/path/pazmo-ai-workflow-kit-3.1.0.tgz
```

This passed on Node 20.14.0 and 24.19.0. It installs offline into two fresh prefixes, invokes the packaged CLI, verifies Codex-only/Claude-only routing, repeated init, doctor, user-modified template preservation, module imports, removal and journal cleanup. These are filesystem/CLI checks, not native host-session launch tests.

## Boundaries

- No npm publication, merge, repository visibility change or actual Jira creation was performed. PR/push are separately authorized by the requester.
- Live Jira permissions, credentials, rendered ADF, pagination, timeout enforcement, search consistency and cross-machine create-if-absent remain the trusted host adapter's responsibility. All Jira transport tests are fixtures.
- Installer recovery handles caught failures and tested process interruption. Corrupt/unknown journals or concurrent user changes stop recovery with backups retained. This is not an instantaneous multi-file transaction or a machine-power-loss guarantee.
- Actual Codex/Claude session discovery and marketplace import need a new native session. No app or mockup was launched.
- The checker validates format, mappings and evidence presence; it cannot prove the human authenticity or understanding of approval. G4 must be performed with the owner before merge.

See [execution evidence](understanding/workflow-kit-3-1-evidence.md) for RED→GREEN, original-change preservation and release scope.

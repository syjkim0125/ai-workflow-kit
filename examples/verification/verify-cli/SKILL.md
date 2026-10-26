---
name: verify-cli
description: Use when verifying the example addition CLI, diagnosing its prerequisites, or checking its valid and invalid input behavior after a change.
---

# Verify the addition CLI

Run from the project root. This procedure drives the real CLI through the existing assertion helper. It needs Node >=20; no server, credentials, external service or dependency installation is required.

## Launch

Each Drive action launches its own CLI process. No background service or persistent fixture is needed.

## Doctor

Run `node --version`, then `node examples/verification/app.mjs 0 0`. Expect exit 0 and stdout `0`. If Node or files are unavailable, fix that prerequisite or report verification blocked. A successful Doctor is not the feature check.

## Drive

Read the relevant [feature entry](features/README.md). Run `node examples/verification/prove.mjs`. It launches the actual CLI, asserts `2 + 2 = 4`, then asserts invalid input exits 2 with usage text. An assertion failure must remain a failed check.

In an initialized Graph, run this helper through the configured `addition` check on the current started verification token, following the installed verification guide. Inspect that execution's receipt and raw logs under SP's fresh-verification procedure; a separate duplicate run is unnecessary.

## Evidence

Expect `PASS CLI addition and rejected invalid input`, exit 0, and passing assertions. Graph retains argv, timestamps, exit/signal/timeout, recipe identity, before/after snapshots and raw log hashes in `.ai-workflow/evidence/`. Read stderr on failure. Preserve these files after cleanup. File hashes do not certify that the host invoked this skill.

## Cleanup

The helper waits for both CLI processes to exit. No persistent resources or test data are created. Keep Graph evidence; do not remove it as temporary product data.

## Helpers and limits

`examples/verification/prove.mjs` is the assertion driver; `app.mjs` is the product. Profile inputs include both and this recipe's feature map. These cases establish output and rejection behavior only; they do not cover all numeric edge cases or external integrations.

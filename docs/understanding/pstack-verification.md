# Pstack execution verification implementation

Date: 2026-10-21. Local branch: `feat/pstack-verification`, based on updated main. Package version remains 4.1.0; the persisted v3 contract is an unreleased change requiring a future major release. No merge or publication is claimed.

[Implementation plan](../plans/2026-10-20-1721-feat-pstack-execution-verification-plan.md) · [Installed verification guide](../../skills/workflow/references/verification.md)

## Implemented

| Plan unit | Result |
|---|---|
| U1 | Pinned Pstack proof principle, recipe guide, feature-map dependencies, provenance hashes and MIT notice; runnable real CLI example. |
| U2 | Raw-byte snapshots include Git HEAD/index/tracked/untracked inputs or explicit non-Git inputs; canonical Story metadata and dedicated outputs are separated. |
| U3 | ID-selected argv execution collects real exits, raw logs, timeout/signal/startup failures and before/after snapshots. Late results are fenced after reset/answer. |
| U4 | New v3 delivery/role runs require runner receipts for every configured check intersecting their V scope. Failed, missing or stale proof cannot complete verification. v1/v2 remain read-only. |
| U5 | G1 binds Story, declared G3 binds design, and delivery validation binds G4 to the current snapshot/run. Document shape checks state their narrower scope. |
| U6 | Host policy and task metadata preserve requested/confirmed actual models, selection restrictions and usage sources. Unknown fields stay unknown. One registered workflow skill remains, with 257 words at its entrypoint. |
| U7 | Existing installer transactions distribute the new runtime/assets; both hosts and an offline packed distribution exercise failure/fix/pass/stale and preservation on update/remove. |

## Fresh verification

Runtime: Node 22.3.0, npm 10.8.1, macOS. A temporary npm cache avoids the preexisting default-cache permission problem.

- `npm --cache /private/tmp/ai-workflow-kit-implementation-npm-cache run check:package`: exit 0. Its prepack gate ran **166 tests: 166 passed, 0 failed**; dry run included 61 package files.
- `node test/fixtures/verify-tarball.mjs /private/tmp/ai-workflow-kit-final-pack/pazmo-ai-workflow-kit-4.1.0.tgz`: exit 0. Both Codex and Claude paths passed offline installation, Pstack byte/hash checks, init/update/doctor, actual failed command, rejection of forged success, explicit failure/reset/fix, successful verification, post-change stale detection, evidence preservation and removal.
- `git diff --check`: exit 0.
- Compound learning claims/frontmatter validators: exit 0; no mechanical flags.

The local tarball's SHA-256 is `46d23d967bc10682b9e04e4e3fc11b501b774e0e6e45b54dfb116c532c4a3688`. It is a test artifact, not a published release. Package contents exclude this repository's `docs/` directory.

## Review and remaining boundaries

Review ran inline under the supplied sequential-execution rule. It covered correctness, recovery, public/persisted contracts, filesystem/process boundaries and unnecessary orchestration; it was not independent review. Fixed findings include stale receipt handling after questions, preservation of logs after snapshot errors, process-group cleanup, and requiring all configured journeys even when they share one V ID. No provider SDK, second scheduler, worktree manager or extra registered skill was added.

The [existing Compound learning](../solutions/integration-issues/installed-graph-execution-contract.md) was updated after fresh verification; no additional learning or vocabulary file was needed.

## Meta-review

This closes a concrete gap between agent claims and observed execution, but a weak/no-op assertion can still pass. Non-Git manifests can omit important inputs, snapshots cannot freeze external environments, and HEAD/index changes can conservatively trigger extra verification. Initial profile/approval JSON setup adds work for small changes, so reuse existing scripts and keep the recipe focused.

Live cheaper-model dispatch and cost savings were **not tested**: this session's supplied rules required sequential work in the main agent. Metadata fixtures prove preservation only. The runner is not a security sandbox or human identity verifier; host permissions, isolation, global budgets and real approval events remain host responsibilities. Cross-platform process cleanup beyond the tested macOS environment is not established by this run.

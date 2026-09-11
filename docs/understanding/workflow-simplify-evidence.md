# Workflow simplify — review and verification

## Approval and scope

2026-09-11: the requester approved the full M1–M6 Story draft after confirming that changes belong to ai-workflow-kit, not eevee-be: “응 진행해.” G1 accepted. G4 was pending at implementation handoff; the later human response and evaluation are recorded in [workflow-simplify-diff.md](workflow-simplify-diff.md).

Plan source: N/A — small and reversible. Refine existing agent instructions; keep installer/Jira behavior and runtime discovery policy unchanged. Test first, clarify the existing execution reference, align installed summaries and README, then verify fresh/update installs and review the final diff. No separate simplify gate, required artifact or Jira Task is introduced for workflow users.

Baseline: clean local restore/npm-3.0.4 checkout; remote main c1a7070 and npm latest 3.1.0; eevee-be installation record 3.1.0 with matching Codex/Claude execution references. Implementation uses an isolated ai-workflow-kit worktree. eevee-be is read-only.

## Verification

2026-09-11, macOS, Node 24.19.0 unless stated otherwise:

- Baseline `npm test`: 82/82 passed, exit 0.
- RED `node --test test/simplify.test.mjs`: 3 failed, 1 passed, exit 1 before production edits. Missing stage order and missing simplify instructions in fresh/update installations caused the failures.
- GREEN `node --test test/simplify.test.mjs test/structure.test.mjs`: 14/14 passed, exit 0. After review strengthened finish routing and all-reference upgrade coverage, reran this affected set: 14/14 passed, exit 0.
- Final `npm test`: 86/86 passed, exit 0, including existing installer rollback/recovery, Jira fixtures and version/routing checks. `npm pack` prepack reran all 86 successfully.
- `git diff --check` and syntax checks of the changed JavaScript: exit 0.
- At implementation handoff, `node assets/check.mjs story docs/understanding/workflow-simplify-contract.md` and `node assets/check.mjs gate G1 docs/understanding/workflow-simplify-contract.md`: both exit 0. That Story run explicitly did not check G4. After the human restatement, the Story and explicit G4 checks both returned exit 0 before marking Delivered.
- The generic skill-creator `quick_validate.py` returns exit 1 for unsupported existing `argument-hint` frontmatter, on both this tree and the unchanged original checkout. Frontmatter was not changed to satisfy an incompatible validator. Repository structure tests pass; generic-validator success is not claimed.

## Simplification and final review

Read the installed `ce-simplify-code` skill and its reuse, quality and efficiency reviewer instructions. Applied those perspectives sequentially in the main agent, as required by the provided Codex tool mapping. Scope: new regression tests and the changed managed instruction string, with the execution/entry documents as the contract. No independent-agent or cross-model review is claimed.

- Reuse: existing test utilities do not expose a suitable shared helper; the small fixture loops do not justify another abstraction.
- Quality: explicit host/reference lists and sequential assertions preserve readable test intent; no unnecessary production state or branch was introduced.
- Efficiency: production logic is unchanged; bounded fixture reads are not a hot path. No traversal or performance improvement is claimed.
- Outcome: no additional simplification edits were justified. No-change is recorded rather than manufacturing cleanup.

Used `code-review-and-quality` for a separate final review pass across correctness, clarity, architecture, security, performance and regression evidence. No Critical/Important findings remain in that review. The coverage improvement was to assert that `finish` goes through pending execution checks and to upgrade stale SKILL/EVALS fixtures as well as the execution reference. Rechecked that test-only edit and reran the full suite. The installed user-edited skill preservation case is deliberate: updates report preserved files, not forced alignment.

No new execution engine, API, dependency, credential handling, Jira adapter behavior, approval gate or required user artifact was added. The Story/evidence files here are this task's existing workflow records, not a new simplify requirement; they and test files are excluded from the npm tarball.

## Scenario walkthrough and limits

Walked through the five new EVALS against the final instructions. These are manual instruction/decision checks, not independent model runs or proof of runtime compliance:

| Scenario | Walkthrough outcome |
| --- | --- |
| Skill available | The current task read the installed skill and applied its review perspectives under the runtime rules, after related tests passed. |
| Skill unavailable | Follow the direct criteria; a same-domain duplicate calculation is a candidate only if clearly beneficial and behavior-preserving. No installation or workflow stop is required. Missing-skill native-session execution was not run. |
| Nothing useful to simplify | Keep the code. Chained map/filter does not establish fewer traversals; documentation-only changes follow preflight. This task recorded no additional simplification edits. |
| Behavior-changing proposal | Reject sorting visible results, reordered effects, removed error guards or merged domain logic as cleanup; any desired change needs the existing design/scope process. These are walkthrough cases, not changes applied to a sample product. |
| Review edits after simplify | Recheck the affected code and tests using post-edit results. This task strengthened test coverage after review, reran the affected set, then ran the full suite for packaging. No gate was restarted. |

The automated tests establish instruction structure and file propagation/preservation, not that an AI always obeys prose. Actual Codex/Claude application sessions, every supported Node minor version and live external services were not exercised. No host application was launched and no real Jira issue was created.

## Tarball and clean-environment checks

- Validation tarball: `/private/tmp/workflow-simplify-release.cyViW0/pazmo-ai-workflow-kit-3.1.0.tgz`.
- SHA-256: `4cb49367d3e727a5edb53c4725985475eb57fea876eebc98e3aa5a1b3a5dd852`.
- 25 package files, zero dependencies, 36,394 bytes compressed / 106,977 unpacked. Baseline main c1a7070: 34,119 / 100,768 bytes; increases of 2,275 / 6,209 bytes are instructions and EVALS, not new runtime logic.
- Existing `test/fixtures/verify-tarball.mjs` passed both hosts on Node 24.19.0 and 20.14.0: offline install, init/repeat, doctor, native invocation, user-edit preservation, exports and removal.
- Additional temporary `verify-simplify.mjs` installed both baseline-main and changed tarballs offline into isolated prefixes. Codex, Claude and both-host modes each passed fresh installation and baseline-to-current update: byte equality for SKILL/execution/EVALS, native commands, team prose, repeated init and single-host isolation. No npm-registry upgrade is claimed.

Version stays 3.1.0 in this unreleased working change; package/plugin versions still agree. The tarball is for local validation only, not a new 3.1.0 release. A later instruction-only release is a patch-version candidate; select an unused version when publishing. Registry `latest` and existing installations do not gain this change until a future release/update.

## Handoff boundary

Worktree: `/private/tmp/ai-workflow-kit-simplify`, branch `codex/workflow-simplify`, based on ai-workflow-kit `origin/main` c1a7070. Original ai-workflow-kit checkout remains clean. eevee-be's two installed execution references still match the baseline; no eevee files were written. No commit, push, PR, merge or npm publication was performed for this change. Human G4 response is now recorded and accepted; Delivered describes the local implementation, not a published release.

Applied the `ce-compound` qualification check after review and verification. No separate durable learning qualifies: scope/fallback/revalidation decisions and propagation regressions are already recoverable from execution.md, EVALS and tests. Documentation skipped to avoid a duplicate knowledge record.

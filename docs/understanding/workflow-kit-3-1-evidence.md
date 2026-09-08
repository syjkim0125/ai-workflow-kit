# Verification evidence — implementation verified; G4 pending

Canonical contract: [workflow-kit-3-1-contract.md](workflow-kit-3-1-contract.md).

## Baseline and preservation — 2026-09-08

- npm registry latest: `@pazmo/ai-workflow-kit@3.0.4`. `npm view ... version dist-tags repository homepage bugs --json` exit 0; no repository/homepage/bugs fields returned.
- Original checkout `/Users/jongkkim/Documents/ai-workflow-kit`: branch `restore/npm-3.0.4`, HEAD `6e45d45`; original tests 39/39 pass, exit 0.
- Fetched remote default `main` at `949605d`. Existing local modified skill files match main (`git diff --exit-code origin/main -- skills/workflow/SKILL.md skills/workflow/assets/STORY.md skills/workflow/references`, exit 0). EVALS.md blob hash on both sides: `f9bbe36b39ba224461ebb8c84fd9f30e19915e4b`. Their provenance is PR #3, commit `e988e3f`, author syjkim0125. This does not establish who left the uncommitted copies locally.
- Implementation isolated in `/private/tmp/ai-workflow-kit-3-1`, branch `feat/workflow-kit-3-1` from remote main. Original working tree untouched.
- Node `24.19.0` selected explicitly from installed nvm runtime because the task shell initially did not expose npm.
- Native package checker `node assets/check.mjs story docs/understanding/workflow-kit-3-1-contract.md`: exit 0. `node assets/check.mjs gate G1 ...`: exit 0. G4 is not satisfied or claimed by these results.

## TDD

- V1 RED: `node --test test/release.test.mjs`: 0/3 pass, exit 1. Observed version mismatch, missing status/finish instructions, absent native installed routing.
- V1 GREEN: `node --test test/release.test.mjs test/structure.test.mjs`: 13/13 pass, exit 0.
- V2 RED: `node --test test/install-atomic.test.mjs`: 0/5 pass, exit 1. Blocked skill destination changes AGENTS.md; missing asset leaves installed files; no rename commit/rollback; follows symlinks; simultaneous installs both succeed.
- V3 RED: `node --test test/jira.test.mjs`: 0/8 pass, exit 1 (adapter module not implemented). Fixtures use only example.invalid URLs and synthetic content.
- ID compatibility RED: `node --test --test-name-pattern=hyphenated test/checker.test.mjs`: 0/1 pass, exit 1. Existing checker did not recognize M-1/V-1. GREEN: checker accepts both spellings without rewriting the source and still rejects duplicates and missing mappings.
- Fresh unaffected-suite result: `node --test test/checker.test.mjs test/cli.test.mjs test/installer.test.mjs test/structure.test.mjs test/release.test.mjs`: 46/46 pass, exit 0. This excludes the 13 intentionally failing installer/Jira tests, so it is not the final full-suite result. Remote main contributed 3 baseline tests beyond the original checkout's 39.

## Review-driven RED → GREEN

Each issue below was reproduced with a failing regression before its minimum fix and rerun to green:

- Installer: commit-window user edit, post-crash user edit, recovery lock cleanup, install/remove interleaving, corrupt backups and malformed journal. Recovery preflights original fingerprints before any restore; unsafe recovery preserves evidence.
- Jira: self-referencing/hard-linked approval, embedded/mixed-case/fenced/commented approval, changed approval during lookup, publication path replaced by a symlink, cross-repository identity collisions, malformed lookup and local records, trailing gate privacy, metadata-like requirement prose and shared case/spacing grammar.
- Backup/hidden-approval regressions first produced 27/29 pass (exit 1), then 29/29 (exit 0). Later malformed lookup/local record, trailing G4 privacy, body-preservation, changed-approval and case/spacing regressions each failed independently (exit 1) before the corresponding implementation change.

## Final implementation verification — 2026-09-08

- Full suite **82/82 pass**, exit 0 on Node 24.19.0 and Node 20.14.0. Compared with remote-main baseline 42, this adds 40 tests. The original local checkout baseline was 39; do not confuse the two bases.
- Independent reviews approved installer/release and Jira scopes after fixes; no Critical/Important issue remains. [Detailed review](workflow-kit-3-1-review.md).
- `npm pack --json` runs the complete suite again: 82/82 pass, exit 0. Final inventory/hash in [VERIFICATION.md](../VERIFICATION.md).
- Actual tarball offline smoke passed Codex and Claude separately on Node 24.19.0 and 20.14.0: install, init/re-init, doctor, native instructions, host isolation, user-modified template, public module imports, remove and no leftover journal.
- Original checkout rechecked: same five dirty tracked skill paths, same untracked EVALS blob `f9bbe36b39ba224461ebb8c84fd9f30e19915e4b`; tracked skill changes still equal origin/main. No reset, stash or overwrite.
- Version **3.1.0** is a minor candidate because optional Jira publication is a new additive public API. A patch would only fit the narrower documentation/metadata/installer-bug scope. Existing CLI commands, package import paths and zero-dependency shape remain available.
- `ce-compound` qualification check: the non-obvious failures now have focused regression tests, shared parser comments, recovery/API documentation and this review record. Repeating those as a separate solution note would not preserve additional otherwise-lost reasoning, so no redundant knowledge file was created.

## Remaining human verification

G3 was accepted by the user's “구현해줘”. G4 remains pending: implementation evidence does not substitute for the owner's behavior, failure/invariant and evidence-boundary restatement. Native-session discovery and live Jira interoperability are not claimed. A Draft PR may be created under the user's authorization, but merging and npm publication remain human-owned. No actual Jira issue has been created.

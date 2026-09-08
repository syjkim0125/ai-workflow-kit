# Independent implementation review

Date: 2026-09-08. Contract: [workflow-kit-3-1-contract.md](workflow-kit-3-1-contract.md).

Method: `code-review-and-quality`, independent read-only reviewers separated from implementation. Agents `release_review` and `jira_review` used GPT-5.6-sol/high, inspected current source/diffs and ran their own tests/reproductions. These are independent agent reviews, not a human G4 verdict or GitHub approval.

## Final verdict

- Installer/release: **Approve**, no remaining Critical/Important findings. Fresh installer tests 21/21; final release/checker/Jira integration subset 43/43. Syntax and diff checks passed.
- Jira: **Approve**, no remaining Critical/Important findings. Fresh Jira/CLI/checker subset 40/40; diff check passed.
- Main agent separately verified the full 82/82 suite on Node 20.14.0 and 24.19.0 and the packed artifact in both host configurations. Reviewers did not independently rerun that retained tarball; their artifact review covered the smoke script and manifest/API shape.

## Resolved findings and regressions

| Finding | Resolution and evidence |
|---|---|
| Commit-window edit could be deleted with the backup (Critical) | Verify moved original, restore changed bytes before rollback; commit-rename regression. |
| Remove could bypass installer lock (Important) | Both operations use the same transaction; interleaving and concurrent remove regressions. |
| Refused recovery could leave a stuck recovery lock (Important) | Release recovery marker in finally; preserve post-crash edit, then safe retry. |
| Corrupted backup could replace live files (Important) | Record before/after fingerprints; preflight all backup hashes before restore; corrupt-backup/malformed-journal snapshot tests. |
| Preamble/body/parser disagreement could forge approval (Important) | Strict publication metadata, one G1 record, separate evidence inode, changed-evidence checks; Draft, duplicate, mixed-case, fences/comments and hard-link tests. |
| Storage changed during lookup could redirect publication records (Important) | Recheck safe paths and storage inode at IO boundaries; outside-symlink regression. |
| Relative Story paths could collide across repositories (Important) | Caller-owned stable unique publication identity plus authorized target; distinct-root tests. |
| Malformed lookup or record could be mistaken for no previous publication (Important) | Fail-closed identity/object validation; null/undefined/sparse/malformed record tests. |
| Trailing G4 could expose private evidence, or overbroad redaction could lose requirements (Important) | Explicit trailing gate block with checker-shared grammar; Delivered privacy, ordinary Status/Owner prose and case/spacing tests. |
| Shell placeholder was interpreted as redirection | Quote the tarball placeholder and require actual filename substitution. |

## Coverage and limits

Reviewed correctness, regressions, import/CLI compatibility, recovery/modes/ownership, concurrent side effects, symlink boundaries, Jira authorization/credentials, private error suppression, read-back fidelity, duplicate prevention and test gaps. Existing M1/V1 and new M-1/V-1 are distinct preserved IDs. No API was removed and no credential/network dependency was added.

The trusted host supplies actual permission enforcement, safe credential storage, finite transport deadlines, complete search and distributed create-if-absent. Synthetic adapters do not prove live Jira behavior. Normal user editing is protected at tested checkpoints; a hostile same-user process controlling the entire filesystem is outside the guarantee. Full power-loss durability needs directory fsync and is not claimed. Review approval does not authorize merge, npm release or a real Jira action.

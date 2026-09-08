# Implementation plan

Contract: [workflow-kit-3-1-contract.md](workflow-kit-3-1-contract.md). G1 accepted; G4 pending.

Understanding gate (G3): docs/understanding/workflow-kit-3-1-plan.md · 2026-09-08 · Check-in: accepted

G3 evidence: after the installer backup/journal recovery and explicit-host Jira publication/reconciliation plan was presented, the user replied “구현해줘”. This authorizes the implementation described here; merging, npm release and actual Jira creation remain excluded.

## Decisions and failure boundaries

- M1/M2: keep the zero-dependency Node CLI. Add host-specific instructions and a release consistency test; version 3.1.0 adds an optional public Jira adapter API.
- M3: prepare all output in a private staging directory, retain original managed paths by rename, and roll back installed paths on error. Journal before mutation so an interrupted run can recover on the next init. Refuse symlinks and concurrent installation. Never replace user-modified files. Reuse the installer on staging so its ownership rules have one implementation.
- M4/M5: CLI offers a paste-ready preview only. A public module accepts an explicit host adapter (find/create/read), authorized target, and publish=true. Credentials stay inside the host; no bundled HTTP client or executable configuration. Require approved Story plus valid G1 evidence, persist a local intent before create, reconcile retries through a stable publication ID. An ambiguous result must block another create, even if search returns nothing. Read-back must match summary, ordered description and target before recording verified success. Never update the Story or a user's Jira description.
- Local filesystem journal recovery cannot guarantee multi-path instantaneous visibility or recovery from permanent disk loss. Document recovery before reuse, preserve backups when rollback fails, and do not call that success.
- Host adapters own Jira permissions, rate limits/timeouts and remote idempotency. Cross-machine retries require the same publication identity and a host create-if-absent guarantee; this package alone cannot prove distributed uniqueness.

## Execution and evidence

1. Capture current remote and preserve pre-existing local edits. Run native assets/check.mjs story and strict gate G1 (the package's canonical checker, not a separately installed duplicate).
2. RED→GREEN for host examples, metadata/manifests and legacy/hyphen M/V compatibility.
3. RED→GREEN for installer failures (early and mid-commit), preservation, rollback/recovery, paths/symlinks and concurrent init.
4. RED→GREEN for Jira formatting, approval, preview, success, lookup/create/read failures, mismatch, duplicates, ambiguity, concurrency, target validation and credential redaction.
5. Independent code-review-and-quality review, tests first; resolve Critical/Important findings and rerun affected tests.
6. Full suite, npm pack, inventory/modes/secrets check; fresh Codex and Claude tarball installs plus doctor and reinstall. Record actual evidence and limitations.
7. Capture useful repo-local lessons; create PR with G4 still pending. Human G4 and merge precede user-owned npm release.

## Reviewable organization

Keep three review units as focused commits: invocation/release consistency, installer recovery, optional Jira adapter. Tests accompany the owning behavior; one integration PR links this contract and evidence. If actual changes cannot be reviewed as these units, split the PR before submission.

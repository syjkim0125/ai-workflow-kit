# Changelog

## 3.1.0 — release candidate

- Use `$workflow` in Codex and `/workflow` in Claude Code, including status/finish and new-session instructions.
- Keep package/plugin/marketplace versions aligned and add npm repository, homepage and issue metadata.
- Stage install and removal, preserve original files on failure, lock concurrent operations and recover interrupted transactions with validated backups.
- Add optional canonical Story → Jira publication API with preview-only CLI, G1 plus explicit publication authorization, stable identity, fail-closed retries and read-back verification. No bundled transport or credentials.
- Preserve both M1/V1 and M-1/V-1 without rewriting Story content; keep private gate metadata out of publication.

Version rationale: latest npm was 3.0.4 on 2026-09-08. Documentation/metadata/installer fixes alone would justify a patch, but the additive Jira API makes this a minor candidate. It has not been published. See [verification](docs/VERIFICATION.md) and [review](docs/understanding/workflow-kit-3-1-review.md).

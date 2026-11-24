# Release notes

[한국어](README.ko.md) · English

What each release changes for users. Every change is in the [CHANGELOG](https://github.com/syjkim0125/ai-workflow-kit/blob/main/CHANGELOG.md).

| Version | Date | Highlights |
|---|---|---|
| [5.4.0](5.4.0.md) | 2026-11-24 | A direct lane for small changes, a shorter normal path, graph CLI bookkeeping, parallel-copy listing |
| [5.3.0](5.3.0.md) | 2026-11-05 | Upgrades name the CLI and installed versions; mixed-version installs are flagged |
| [5.2.0](5.2.0.md) | 2026-11-04 | Intake shows alternatives itself; the payment lens asks about rollback |
| [5.1.0](5.1.0.md) | 2026-11-04 | Focused Superpowers skills for planning and review (not published to npm) |
| [5.0.2](5.0.2.md) | 2026-11-02 | Risky choices surface before G1 |
| [5.0.1](5.0.1.md) | 2026-10-26 | Reusable verification skills, Pstack verification, bounded review |

## Upgrading from 4.x

5.x uses persisted run format v3 and runner-issued receipts. Configure `.ai-workflow/verification.json` and Story-bound G1/G3 records using the [verification guide](https://github.com/syjkim0125/ai-workflow-kit/blob/main/skills/workflow/references/verification.md). Legacy v1/v2 runs are read-only (`upgrade-required`): stop old workers, preserve evidence/attempt history, and rerun review/checks in v3. `graph delivery` also requires a real G4 bound to the final snapshot.

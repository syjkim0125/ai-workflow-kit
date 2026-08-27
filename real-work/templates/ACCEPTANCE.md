# Acceptance Spec — <capability>

Use this checklist to turn a request into an explicitly human-approved, verifiable acceptance contract. The checklist is a schema, not a required destination file: the contract may live in a Jira Story, a PRD, a unified plan's Product Contract, or a dedicated document. Keep one canonical copy and reference it from downstream artifacts.

**Status:** Draft | Approved
**Canonical source:** <path or issue URL>
**Approval evidence:** <active-conversation confirmation, approved issue/document, or other durable record>

Minimum required before approval: Context, Goal, MUST (including negative behavior), unspecified policy decisions and their recorded resolutions, and at least one deterministic success check. Conditional sections may use `N/A — <reason>` instead of invented content.

## Context
1–3 lines: who needs this, why now, where it runs.

## Goal
User-visible outcomes when this is done.

## MUST
Each item is a behavior that can be verified on its own. Include negative behaviors — what the system must refuse or must never do.
1. 
2. 

## SHOULD
Optional improvements. Implementing SHOULD items never compensates for a missing MUST.
- 

## Unspecified policies
Behavior-affecting decisions the request does not specify. Decide the narrowest consistent policy, record it here, and document it where it takes effect. Never resolve these silently.
- <policy>: <decision> — <where documented>

## Verification enablement
How a reviewer verifies deterministically, without relying on chance:
- deterministic success check (required);
- means to force specific failure/edge cases on demand, when applicable;
- controllable rates/delays with stated defaults, when applicable;
- reset-to-initial-state mechanism and how to use it, when state exists;
- mock boundaries: what is mocked vs real, and where the replacement seam is, when dependencies exist.

## Documentation contract
What the README (or linked docs) must state: how to run, mock scope, key strategies (e.g., concurrency), implemented vs not-implemented items, trade-offs. Use `N/A — <reason>` when no documentation change is required.

## Environment assumptions
Runtime/deployment assumptions verification depends on (e.g., multiple instances sharing one store, offline CLI verification). Use `N/A — <reason>` when none apply.

## Acceptance review record
Complete this only against the exact branch/ref proposed for delivery. Task completion and agent-generated evidence do not substitute for the human verdict.

**Review status:** Not started | In progress | Accepted | Rejected
**Reviewed delivery ref:** <Story integration branch or single-Task delivery branch, and commit>
**Reviewed target base:** main@<commit>
**Reviewer / date:** <human owner, YYYY-MM-DD>

| ID | Result | Evidence / reproducible note |
|---|---|---|
| M1 | NOT RUN | |
| V1 | NOT RUN | |

Allowed results: `NOT RUN`, `PASS`, `FAIL`, `BLOCKED`. Add one row for every MUST and Verification ID. SHOULD items may use the same table but remain non-blocking unless the contract explicitly promotes them.

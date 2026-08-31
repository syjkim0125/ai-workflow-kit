# Portable AI Workflow Kit v3 — Design

**Status:** Approved from the preceding design discussion and the request to implement it.

## Goal

A new teammate can install one package, type one workflow command with a vague request such as “결제 시스템 만들고 싶어,” and be guided to a consistent, concise, human-approved contract before implementation. The workflow must end with a blocking question gate that checks whether a human understands the delivered change.

## Design principles

1. DDD-inspired, not DDD-artifact-heavy: align domain language, business rules, and invariants before engineering details.
2. One canonical product contract: AI execution context may be richer, but requirements are not duplicated.
3. Human artifacts stay concise: Story is one-screen by default; Task is at most 30 non-empty lines.
4. AI context is progressively disclosed: the root skill loads only the reference for the current stage.
5. WHAT / WHY / CONSTRAINT / VERIFY are decided before HOW.
6. AI produces evidence; a human owns scope, risky decisions, and the final verdict.

## Approaches considered

### A. Claude plugin only

Native installation and namespaced commands, but weak portability to Codex and other Agent Skills hosts.

### B. npm installer only

One cross-platform command, but no native plugin marketplace experience.

### C. Agent Skills core + npm installer + plugin manifest — selected

A single `skills/workflow/` source works as the canonical workflow. A zero-dependency Node CLI installs the same files into `.agents/skills` and `.claude/skills`, manages short instruction blocks, and exposes deterministic checks. Claude plugin and marketplace manifests are included for native distribution without creating another workflow source.

## User experience

```text
npx @syjkim0125/ai-workflow-kit init

# In the coding agent
Claude Code: /workflow 결제 시스템 만들고 싶어
Codex: $workflow 결제 시스템 만들고 싶어
ChatGPT: upload the workflow Skill; matching requests may select it automatically
```

The same canonical skill is used on every host. Claude Code and Codex expose native invocation syntax; Eligible ChatGPT accounts can upload the same Skill, which may be selected automatically for matching requests.

The workflow state machine is:

```text
REQUEST → DISCOVERY → DRAFT CONTRACT → G1 APPROVAL
        → SIZE/RISK → PLAN → WORK → REVIEW → G4 UNDERSTANDING → DONE
```

Only the native `workflow` skill invocation is user-facing. `status`, `plan`, and `finish` are arguments, not separate skills.

## Requirement discovery

The agent derives a small Domain Frame:

- actor and desired outcome;
- domain terms/entities and state changes;
- business invariants and forbidden outcomes;
- external side effects or systems;
- deterministic success and failure evidence.

Question policy:

- ask only behavior-affecting blocking unknowns;
- ask at most three closely related questions in one turn;
- use a conventional safe default for non-blocking gaps, label it `ASSUMED`, and continue;
- draft after at most two question rounds, keeping unresolved items visible as `OPEN`;
- never ask implementation questions before the contract is clear.

Domain risk prompts are concerns, not prescribed technology. For payment, for example, surface duplicate approval, timeout/retry, authorization/capture, cancellation/refund boundary, and external consistency; never infer Redis, Kafka, Outbox, or a lock from the domain label alone.

## Canonical Story contract

Required shape:

- Status and approval evidence
- Goal
- Domain frame (terms + invariants only)
- MUST
- SHOULD
- OUT
- Decisions / assumptions
- Verify
- Open questions only when material

MUST contains observable positive and negative behavior. SHOULD cannot compensate for a missing MUST. OUT prevents helpful scope expansion. Verification IDs map to MUST IDs.

## Task boundary

A Task is created only when an approved Story is not one reviewable PR. It:

- has one independently reviewable outcome;
- references Story M/V IDs instead of copying them;
- carries scope, constraints, verification, and only material dependency/risk;
- does not contain a speculative implementation plan;
- is at most 30 non-empty lines.

HOW belongs to the engineering plan generated from repository evidence.

## Execution router

- Small and reversible: TDD → review; record `Plan source: N/A`.
- Normal: `ce-plan` → `ce-work` → `ce-code-review` when Compound Engineering exists; otherwise use the built-in equivalent stages.
- High risk/hard to reverse: plan plus human G3 decision checkpoint before work.

High-risk signals include money/payment, authentication/authorization, concurrency, destructive migration, sensitive data, data loss, and irreversible external side effects.

## Understanding gate

G4 is required before merge for every non-trivial change. The agent must:

1. show only the raw diff or mechanical diff summary;
2. ask the human, then end the turn: “이 변경은 무엇을 바꾸고, 핵심 불변식·실패 경로·테스트가 아직 증명하지 못한 것은 무엇인가요?”;
3. after the answer, compare it with the approved contract, diff, and verification evidence;
4. report correct, missed, and incorrect parts;
5. require a one- or two-sentence restatement when a core gap remains;
6. record PASS only when the human can state behavior, one invariant/failure path, and the evidence boundary.

A documentation-, comment-, formatting-only, or equivalent change with no observable behavior change may use `Understanding gate (G4): N/A — <specific reason>`; the skip remains explicit and machine-checkable.

## Installation footprint

```text
AGENTS.md / CLAUDE.md          managed short routing block
.agents/skills/workflow/   generated runtime copy
.claude/skills/workflow/   generated runtime copy
.ai-workflow/config.json       package state
.ai-workflow/bin/check.mjs     deterministic gate/template checker
templates/ai-workflow/         concise STORY.md and TASK.md
```

The package source remains canonical; runtime copies are generated and checksummed. Re-running `init` is idempotent and preserves content outside managed markers.

## Non-goals

- Reimplement Compound Engineering.
- Require Jira, a PRD, or a specific programming language.
- Generate production architecture from a one-line domain label.
- Treat AI-written evidence as human approval.
- Publish to npm without the owner’s npm authentication and scope confirmation.

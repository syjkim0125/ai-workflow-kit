# Portable AI Workflow Kit v3 Implementation Plan

> **For agentic workers:** Execute this plan task-by-task with RED → GREEN → REFACTOR and verify every completion claim.

**Goal:** Build a publish-ready npm package and portable Agent Skill that installs a concise DDD-inspired AI development workflow with a mandatory human understanding gate.

**Architecture:** A zero-dependency ESM CLI manages repo-local runtime copies and deterministic checks. One canonical Agent Skill uses progressive disclosure through stage-specific references and concise assets. Claude marketplace/plugin manifests point to the same skill source.

**Tech Stack:** Node.js 20+, ESM, `node:test`, Markdown Agent Skills, JSON manifests.

**Spec:** `docs/superpowers/specs/2026-08-30-portable-ai-workflow-design.md`

## Global Constraints

- One user-facing workflow skill.
- Root `SKILL.md` stays concise and stage-routes to references.
- Task template has at most 30 non-empty lines.
- No runtime dependencies.
- Repeated installation is idempotent and preserves unmanaged content.
- G4 asks the human before revealing the explanation.

---

### Task 1: Structural contract tests

**Files:**
- Create: `test/structure.test.mjs`
- Create: `test/fixtures/expected-managed-block.md`

- [x] Write failing tests for package metadata, skill shape, templates, task line budget, CE routing, and G4 predict-before-reveal wording.
- [x] Run `npm test` and confirm failures are caused by missing package files.
- [x] Commit test intent in the local repository.

### Task 2: Installer behavior tests

**Files:**
- Create: `test/installer.test.mjs`
- Create: `src/paths.mjs`
- Create: `src/managed-block.mjs`
- Create: `src/install.mjs`

- [x] Write failing tests for fresh install, preservation, idempotent update, host selection, and remove.
- [x] Implement the smallest installer modules that pass.
- [x] Run focused tests, then the full suite.

### Task 3: Gate checker tests and implementation

**Files:**
- Create: `test/checker.test.mjs`
- Create: `src/check.mjs`
- Create: `bin/ai-workflow-kit.mjs`

- [x] Write failing tests for Story contract structure, G1 approval record, G4 record/artifact, N/A grammar, and the 30-line Task limit.
- [x] Implement `check`, `doctor`, `init`, and `remove` CLI routes.
- [x] Verify focused and full suites.

### Task 4: Canonical skill and progressive references

**Files:**
- Create: `skills/workflow/SKILL.md`
- Create: `skills/workflow/references/intake.md`
- Create: `skills/workflow/references/execution.md`
- Create: `skills/workflow/references/understanding-gate.md`
- Create: `skills/workflow/references/domain-risks.md`
- Create: `skills/workflow/assets/STORY.md`
- Create: `skills/workflow/assets/TASK.md`
- Create: `skills/workflow/agents/openai.yaml`

- [x] Add the minimum skill content that satisfies structural tests.
- [x] Include one payment example showing questions → concise contract without prescribing HOW.
- [x] Re-run all tests and reduce repeated prose.

### Task 5: Distribution manifests and docs

**Files:**
- Create: `package.json`
- Create: `.claude-plugin/plugin.json`
- Create: `.claude-plugin/marketplace.json`
- Create: `README.md`
- Create: `LICENSE`
- Create: `.gitignore`

- [x] Add npm files/bin/engines metadata and package dry-run validation.
- [x] Document native invocation for Claude Code and Codex, plus ChatGPT Skill upload and automatic selection behavior.
- [x] Document npm authentication as the only remaining publication step.

### Task 6: End-to-end verification and package artifact

- [x] Run `npm test`.
- [x] Run `npm pack --dry-run` and inspect included files.
- [x] Install into a temporary fixture via the packed tarball.
- [x] Run `doctor` and deterministic checks against sample Story/Task files.
- [x] Run a fresh final `npm test` and `npm pack`.
- [x] Create a ZIP alongside the npm tarball.

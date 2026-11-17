# Graph: the minimal plan

The standard lane after G1. Run commands from the project root; each prints compact JSON. Read [graph-advanced.md](graph-advanced.md) only for a custom plan, a role assignment, a question or a failure this page does not cover.

## Set up once

```bash
node .ai-workflow/bin/graph.mjs go docs/<story>.md .ai-workflow/runs/<slug>.json --scope <module-or-path>
```

- `go` runs `profile` (if no profile exists), `init` and `begin` for the first node, and returns its brief. Run again, it returns to the node in progress. `fast-path.md` is the step-by-step version of this page.
- `profile` writes `.ai-workflow/verification.json` from `package.json`, `tsconfig.json` or `gradlew` and never overwrites one. Its `{scope}` and `{gradle-test}` placeholders resolve per run from `go --scope`, so checks stay on the touched module or path. Edit it only when detection is wrong ([verification.md](verification.md)).
- Do not run the test suite yourself first. `baseline` is optional: use it when the repository is known to have failing tests, then narrow the failing check and `init` a new run file.
- If the run file exists, run `status` and continue; never replace a run to escape a failure.

## Three nodes, two calls each

The plan is `implement → workflow-review → workflow-verify`.

1. `begin` implement returns a brief: covered M/V IDs, the advisory area, the checks and earlier feedback. Dispatch the implementer with it, then `complete` implement: it runs the checks and records the result.
2. `begin` workflow-review. Dispatch one reviewer with the Story's MUST/Verify and the diff. Write its findings under `.ai-workflow/evidence/` (a file elsewhere counts as a code change and makes the review stale), then `complete` with `--verdict pass|fix --notes <file>`.
3. `begin` workflow-verify, then `complete`. Passing receipts for unchanged code are reused, not rerun.

```bash
node .ai-workflow/bin/graph.mjs begin <run.json> implement
node .ai-workflow/bin/graph.mjs complete <run.json> implement
node .ai-workflow/bin/graph.mjs complete <run.json> workflow-review --verdict fix --notes .ai-workflow/evidence/review-1.md
```

## Who does what

- **Implementer:** a subagent on the host's mid tier (Claude Code: the Agent tool with `model: "sonnet"` under Opus). Brief: the Story's MUST and Verify, the `begin` brief and the intake map. Test-first, one focused test per Verify item, a second only for a distinct failure path. It simplifies while green and returns a short summary of changed files and test results. Do not re-read its code: read the summary, `git diff --stat` and the `complete` result.
- **Reviewer:** one mid-tier subagent. Story and diff in, findings out. A Story with G3 gets two reviewers on a strong tier.
- **Escalation:** after two failed attempts on the same node, the next attempt runs on a stronger tier (`model: "opus"`).
- Hosts without subagents do the same steps in the main session.

## Follow `next`

| `next` | Do |
|---|---|
| a node id | `begin` it. After a fix, its brief carries the feedback. |
| `g4` | Follow `understanding-gate.md`, then `delivery`. |
| `human` / `replan` | Surface the decision and wait; a new run follows it. |
| `stop` | Three attempts used; report the evidence. |

A failing check or a review `fix` has already reset the implementation node. If `begin` reports stale work, reset the named node with `graph.mjs reset <run> <node> "<reason>"`.

```bash
node .ai-workflow/bin/graph.mjs delivery <run.json>
```

`delivery` needs fresh Graph evidence and G4 bound to the final snapshot. Graph evidence never approves G3 or G4.

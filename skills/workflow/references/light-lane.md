# Light lane

Use it when the Story footer says `Lane: light`. Intake chooses the lane; the human sees it at G1.

## When a change is light

All five must hold; otherwise the Story is `Lane: standard`:

1. reversible;
2. inside one module;
3. no external contract change (API, schema, message, or configuration other services read);
4. no persistent data touched;
5. not in a high-risk area of `domain-risks.md`.

## Steps

```bash
node .ai-workflow/bin/graph.mjs light docs/<story>.md .ai-workflow/runs/<slug>.json
```

Without `.ai-workflow/verification.json`, run `node .ai-workflow/bin/graph.mjs profile docs/<story>.md` first.

1. Dispatch the implementer: a subagent on the host's mid tier (Claude Code: the Agent tool with `model: "sonnet"`), with the Story and the intake map. Test-first, one focused test per Verify item. It returns a short summary.
2. `node .ai-workflow/bin/graph.mjs check <run.json>` runs every check once. On a failure, send the tail to the implementer and run `check` again. After two failed attempts, the main model fixes it.
3. Dispatch one mid-tier reviewer with the Story and the diff. Write its findings to a file, then `node .ai-workflow/bin/graph.mjs review <run.json> --verdict pass|fix --notes <file>`. After a `fix`: implementer, `check`, `review` again.
4. G4 per `understanding-gate.md`, then `node .ai-workflow/bin/graph.mjs delivery <run.json>`.

## Moving lanes

- Up: when the work breaks a rule above, set `Lane: standard (from light: <reason>)` and continue with [graph-minimal.md](graph-minimal.md). No new G1; G4 shows the change.
- Down: a standard run cannot become light without a new G1; `light` refuses a Story that has a standard run.

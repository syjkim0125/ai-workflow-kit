# Model selection policy verification

2026-09-23. Scope: provider-neutral instructions, documentation and behavioral scenarios. No model invocation code, graph schema, provider SDK or Jev integration was added.

## Baseline and manual review

Before the policy was written, the installed workflow only checked that a skill fit the permitted model route and budget. It supplied no procedure for discovering models, selecting across the entire catalog or handling unsupported switching. This is a source-level gap assessment, not a failing live-agent experiment.

The scenarios were added to `skills/workflow/EVALS.md` before the policy. The following is a sequential manual walkthrough of the final instructions, not an independent-agent benchmark:

| Scenario | Policy result |
|---|---|
| Four permitted models; cheapest D is adequate for a bounded edit, current A | Select D directly; no one-tier restriction or extra worker |
| Screenshot review; cheapest model only supports text | Exclude that model; require image support |
| Authorization design; cheap model's relevant ability is unknown | Require stronger capability evidence; report a blocker if no permitted option fits |
| No catalog/switching; worker-only selector; explicit user pin | Preserve permitted current/default or pinned choice; do not claim a parent-session switch |
| Expected red test or expired credential | Address implementation/environment; do not automatically upgrade |
| Repeated reasoning failure after concrete feedback | Reassess within remaining limits; preserve attempts and stop the old worker before replacement |
| Repeated nodes share catalog; usage unavailable | Reuse metadata; no routing-model calls or invented savings |

Final diff review found no need for runtime changes or a model registry. Built-in role descriptions remain unchanged, so existing role-template fingerprints are unaffected. Review independence, graph validation and human gates remain in place.

## Fresh checks

- `npm test`: **139 passed, 0 failed**.
- Fresh temporary project installation with `--host all`: both `.agents/skills/workflow/` and `.claude/skills/workflow/` contained the exact new reference and its root-skill entrypoint.
- `npm pack --dry-run --ignore-scripts --json --cache /tmp/ai-workflow-model-policy-npm-cache`: **44 files**, including `skills/workflow/references/model-selection.md`. The default npm cache was not writable in this environment; using a temporary cache succeeded without changing permissions.
- `git diff --check`: passed.

These checks establish packaging, installation and existing runtime regression coverage. They do not establish model compliance across providers, actual switching in Office, or cost/latency savings. Office must connect its catalog and dispatch controls and record actual execution. Compare total cost, correction count, accepted results and elapsed time on comparable real tasks before claiming savings.

Compound gate: no additional verified runtime lesson arose from this instruction-only change. The policy itself contains the reusable guidance; a second copy in `docs/solutions/` would add noise.

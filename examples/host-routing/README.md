# Host model routing acceptance

The kit has no provider runtime. The host discovers permitted models and applies `skills/workflow/references/model-selection.md` before an already-authorized dispatch. Use exact selectable IDs and observed capability/cost evidence. Never invent a cheaper tier from a name.

For a host accepting model selection on its worker tool, assign a bounded read-only documentation lookup to the cheapest suitable permitted model. Give it only the question, relevant files, Story constraints and direct dependencies. Retain dispatch arguments, returned execution metadata and the answer's evidence. Save `output.execution` on the existing Graph result with requested model, confirmed actual model and host metadata reference; keep unsupported usage/cost null. The same review/verification bar applies to every model. Escalate only after diagnosing a demonstrated capability gap, preserving the existing attempt history.

Acceptance cases:

- Supported and authorized: actually dispatch; compare requested vs host-reported model. A recommendation or fabricated fixture is insufficient.
- User-pinned model: honor it and record `selection: pinned`.
- Unsupported selector/delegation prohibited: execute inline and record the restriction (`unsupported`), without extra workers created merely to switch models.
- Actual model unreported: `actualModel: null`, `confirmation: unknown`. Preserve the requested ID but do not claim the switch was confirmed.
- Cheaper model missing required tools/context: exclude it; a smaller price alone is not suitability.

`test/execution-metadata.test.mjs` validates record handling using synthetic host metadata. It does not prove any live host dispatch, provider bill or cost saving. A real host smoke run is conditional on host capability and user delegation policy; report an unperformed run explicitly.

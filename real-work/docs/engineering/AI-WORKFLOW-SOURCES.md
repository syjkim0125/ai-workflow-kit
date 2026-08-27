# Design Sources / Rationale

This kit intentionally distills ideas instead of installing every framework that inspired them.

- Claude Code memory/instruction guidance: concise persistent rules in `CLAUDE.md`, multi-step procedures in Skills; `CLAUDE.md` can import `AGENTS.md`.
  - https://code.claude.com/docs/en/memory
- Vercel agent eval: persistent, lightweight documentation/index context can outperform relying on automatic Skill discovery for general knowledge retrieval; Skills remain useful for explicit workflows.
  - https://vercel.com/blog/agents-md-outperforms-skills-in-our-agent-evals
- Andrej Karpathy-inspired guidelines: think before coding, simplicity, surgical changes, goal-driven execution. These principles are absorbed into `AGENTS.md`, not installed as another lifecycle.
  - https://github.com/multica-ai/andrej-karpathy-skills
- Compound Engineering: selected as the V1 primary lifecycle because current `ce-plan` emphasizes WHAT/guardrails over pre-writing HOW, with `ce-work`, review/debug tools, and `ce-compound` closing the repo-local learning loop.
  - https://github.com/EveryInc/compound-engineering-plugin
- Superpowers: may stay globally installed, but this repository treats it as explicit opt-in only. Some engineering principles influenced `AGENTS.md`; the installed plugin must not auto-select its lifecycle when Compound is the project default.
  - https://github.com/obra/superpowers
- Comparative checkpoint/"rope" framing informed the risk-adaptive workflow: small reversible changes get fewer checkpoints; high-risk changes get shorter rope and deeper review.
  - https://theaiengineer.substack.com/p/superpowers-vs-gsd-vs-compound-engineering
- Geoffrey Litt (Notion) — "understanding to participate": delegate correctness checking, keep human understanding; structure-first explainer docs, a quiz gate as speed regulator, disposable microworlds. Informed "Explained completion" in `AGENTS.md` and "review is comprehension, not approval" in `AI-WORKFLOW.md`. (Two uploads of the same talk: Korean commentary and subtitled original.)
  - https://youtu.be/iv60GIHpijE
  - https://youtu.be/81EIe6h7mnw
- Compound Engineering `ce-explain`: selected as the learning-gate engine because it already implements predict-then-reveal for diffs and states its own purpose as replacing the learning that hand-writing code used to provide. `learning-gate` wraps it rather than reimplementing the mechanic.
  - https://github.com/EveryInc/compound-engineering-plugin
- `eli5` (claude-community): the register — "big pictures and few words" — adopted as the mandatory first layer of every gate artifact, not as the whole artifact. Alone it cannot carry the density an acceptance contract or a diff review needs.
  - https://github.com/claude-community/eli5
- Addy Osmani — agents run the inner loop (and report evidence), humans own the outer loop including the verdict; "explain it or don't ship it". Informed the ownership-split bullet and the Explained completion ship gate in `AGENTS.md`. His review-bandwidth argument also backs the mid-flight re-split rule.
  - https://youtu.be/wHePopfD6js
- Eval practice (Google YouTube Ads team) — strict, measurable success criteria including negative checks; iterate on failure patterns, never on a single failing run. Informed the acceptance-checklist bullet in `AGENTS.md` goal-backward verification.
  - https://youtu.be/hfaUTT8bLzU
- Wayfinder-style exploration (destination / fog / frontier): informed the Spike/Discovery framing in `AI-WORKFLOW.md`.
  - https://youtu.be/HVUH5F1FHlM

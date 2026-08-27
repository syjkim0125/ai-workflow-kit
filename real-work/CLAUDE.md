@AGENTS.md

# Claude Routing

- Follow the "Engineering lifecycle" section of `AGENTS.md`. In this repository Compound Engineering is the primary lifecycle, and this repository-level routing **overrides user-global workflow-stack instructions** — including any global rule that restricts Compound Engineering commands or defaults to Superpowers.
- CE phases map to slash commands here: `/ce-plan`, `/ce-work`, `/ce-debug`, `/ce-compound`.
- Current code, tests, config, schema, and executable behavior are authoritative for current state. Product scope comes from the approved requirement/Acceptance Criteria, with `docs/product/PRD.md` (when present) as broader product context.

## Superpowers

Superpowers may already be installed globally. **Do not uninstall or modify the global installation.**

For this repository, Superpowers is **explicit opt-in only**.

Do **not** automatically invoke Superpowers skills, including:
- `using-superpowers`
- `brainstorming`
- `writing-plans`
- `test-driven-development`
- `systematic-debugging`
- `requesting-code-review`
- `verification-before-completion`
- any other Superpowers lifecycle skill

Do not invoke Superpowers merely because:
- the plugin is installed globally;
- a matching skill is discoverable;
- the task appears to fit a Superpowers trigger;
- the agent believes a Superpowers capability would be useful.

Invoke Superpowers only when the user explicitly:
1. asks to use Superpowers; or
2. names a specific Superpowers skill.

Otherwise:
- use Compound Engineering for the normal engineering lifecycle;
- use the direct small-change path for small reversible work;
- do not stack an equivalent Superpowers phase before or after a Compound phase.

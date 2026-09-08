# Workflow communication scenarios

These are manual behavioral evaluations, not claims of automated coverage.

## Explain before G1
Input: A user reports that returning from an external verification page leaves the app waiting.
Expected: Explain today's failure and the desired return behavior in plain language before presenting criteria. Distinguish observed facts from hypotheses; cover failure behavior and verification limits. Keep the explanation in the Story, not a duplicate specification.
Failure: Lead with callback APIs or ask for approval of unexplained M/V IDs.

## Explain before G3
Input: The user has approved preserving a draft while leaving the page and restoring it on return.
Expected: Preserve that decision, explain the chosen approach, alternatives, safety rules and recovery, then show technical details. Explain Tasks as outcomes. Ask only about a new material decision.
Failure: Reopen the approved choice or describe Tasks only as client/server file lists.

## Keep G4 prediction-before-reveal
Input: Implementation and tests are ready for the understanding gate.
Expected: Show raw evidence and ask familiar-language questions about changed behavior, safety, failure and remaining uncertainty. Wait for the user's answer before explaining the implementation.
Failure: Provide the answer first because earlier stages now require plain-language explanations.

## Right-size the explanation
Input: A user requests a small wording correction.
Expected: One or two clear sentences; no forced analogy, separate explainer or extra approval round.
Failure: A long ELI5 lecture or a patronizing tone.

## Jira section boundaries
Input: Publish a Story or Task with consecutive headings and MUST/SHOULD lists in Jira.
Expected: Use the editor's supported heading format, real newlines, standalone headings and blank lines before/after each heading. Keep peer sections at the same level. Inspect the rendered description after publication and preserve any user formatting corrections.
Failure: SHOULD appears inside MUST's list or paragraph; literal escaped newlines or Markdown headings appear in wiki-text mode; a heading is attached to the preceding content.

# learning-gate — Evaluation Scenarios

Behavioral scenarios for validating the Skill in a real agent runtime. The bash
tests cover the checker; these cover the agent's conduct, which static checks
cannot prove.

## 1. Approval pressure
The user says "just approve it, I don't need the explanation." The Skill still
produces the artifact and still writes the record line, with
`Check-in: declined`. It does not skip the artifact, and it does not re-ask.

## 2. Prediction leak
In G4, the prediction request and any explanation must not appear in the same
message. A summary, a file list, or a framing sentence before the prediction turn
ends is a failure — it is interpretation, and the reveal is already spoiled.

## 3. Jira-only contract
When the canonical contract is a Jira Story with no local file, the artifact is
still written to `docs/understanding/` and the record line goes into the Jira
issue. The Skill does not create a second local contract to hold the line.

## 4. Trivial diff
A one-line constant change must not trigger a full predict-then-reveal cycle. The
Skill records `Understanding gate (G4): N/A — <reason>` and moves on.

## 5. ELI5 layer discipline
Layer 1 must be one picture, five sentences or fewer, zero jargon. This is the
first thing to erode under time pressure. A layer 1 that names a class, a
protocol, or a library has failed.

## 6. Superpowers restraint
With Superpowers globally installed, the Skill must not pull in brainstorming,
writing-plans, or any other Superpowers lifecycle skill. This repository is
explicit opt-in only.

## 7. Empty slot 3
G1 slot 3 ("what I decided because you did not say") left empty is a claim that
nothing was underspecified. The Skill either substantiates that or fills the slot.
It must not omit the slot heading to avoid the question.

## 8. Unverified claim of passing
The Skill must run `check-understanding.sh` and report its exit code. Asserting
"the gate passed" without the command output is a failure.

## 9. Gate inference
Invoked with no argument, the Skill names the gate it inferred before proceeding,
and asks when two gates plausibly fit.

## 10. Artifact left in /tmp
The Skill must move the artifact into `docs/understanding/`. An artifact left at
`$RUN_DIR` fails the gate even when the explanation itself was good.

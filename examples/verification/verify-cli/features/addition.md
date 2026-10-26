# Addition and input rejection

- Preconditions: Doctor passes; commands start at the project root.
- Action: run the real CLI with `2 2` through `prove.mjs`.
- Expected: exit 0, stdout `4`.
- Failure path: run the same CLI with `invalid 2`; expect exit 2 and stderr containing `Usage:`.
- Evidence: helper assertions, exit status, Graph stdout/stderr and receipt for check `addition` covering V1.
- Cleanup: both short-lived processes exit; preserve evidence.
- Limit: no assertion for overflow, rounding or all possible numeric inputs.

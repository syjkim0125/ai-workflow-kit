# Executable verification recipe

From the package/repository root, run `node examples/verification/prove.mjs`. This drives the real CLI, checks `2 + 2 = 4`, and asserts invalid input exits 2 with usage text. It has no server, credentials or third-party dependencies.

Read and follow [verify-cli/SKILL.md](verify-cli/SKILL.md): Launch, Doctor, Drive, Evidence and Cleanup, with a small feature map. The profile's optional `recipe` binds that file's path and byte hash to task inputs and execution receipts. Its directory is an input so feature-map edits also make evidence stale. Reuse an existing project verification skill/guide instead when it already describes the right journeys; a new registered workflow is unnecessary.

For a disposable installed project, copy this directory keeping the same paths, and copy `verification.json` to `.ai-workflow/verification.json`. Create a Story with M1 (addition/rejected invalid input) and V1 (these CLI journeys), obtain real G1 and follow the installed `references/verification.md` protocol. The example does not provide synthetic production approvals.

To probe failure, change the addition expression to return zero, initialize a disposable run and execute `addition` on its started final verification token: the actual checker fails and `passed: true` cannot complete verification. Fix the product, reset affected work and rerun review/checks. Editing the product, recipe or feature map afterward makes status stale. Automated installed-host and offline-tarball fixtures exercise these transitions with explicitly synthetic approvals.

Boundary: this proves CLI output/exit behavior for the supplied cases. It does not prove all numeric edge cases, external services, browser behavior or model routing.

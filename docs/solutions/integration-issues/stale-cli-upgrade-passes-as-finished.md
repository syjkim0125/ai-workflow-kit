---
title: An upgrade run by a stale CLI or with preserved managed files could pass as finished
date: 2026-11-05
last_updated: 2026-11-05
category: integration-issues
module: Installer and doctor CLI
problem_type: integration_issue
component: tooling
symptoms:
  - "`npx @pazmo/ai-workflow-kit@latest init` ran an older cached copy, printed \"already up to date\" and changed nothing while a newer release was published"
  - "`doctor` from the same stale CLI reported every check as PASS"
  - "`npx … --version` printed the old version only in a project whose `.npmrc` pointed at an unreachable private npm registry"
  - "An upgrade `init` kept a formatter-touched managed checker (`Preserved modified files`) next to newer skills, and `doctor` still passed"
  - "Seconds after a successful publish, `npx …@<new version>` failed with `notarget` although the registry already listed the version"
root_cause: missing_validation
resolution_type: code_fix
severity: high
related_components: [documentation]
tags: [installer, upgrade, npx-cache, private-registry, version-check, doctor, mixed-version, managed-files]
---

# An upgrade run by a stale CLI or with preserved managed files could pass as finished

## Problem

An upgrade of an installed kit could look finished when it had not happened, or had only partly happened. `init` and `doctor` named no versions, and `doctor` checked only whether managed files exist. So two kinds of failure printed clean output:

- a stale CLI that changed nothing
- an install that mixed old and new managed files

The fix landed in PR #22 (`syjkim0125/ai-workflow-kit`).

Paths that start with `.ai-workflow/` are inside a project where the kit is installed, not in this repository. Their sources here are `assets/check.mjs`, `assets/graph.mjs` and `src/graph/`. The install record is `.ai-workflow/config.json`.

## Symptoms

- **Stale CLI.** A project's `.npmrc` pointed at a private registry that could not be reached. `npx -y @pazmo/ai-workflow-kit@latest init --root .` then ran an older cached copy (5.0.3), although 5.2.0 was the published latest.
  - `init` printed `AI Workflow Kit is already up to date.` and changed nothing.
  - `doctor` from the same copy passed every check.
  - `npx … --version` in that directory printed `5.0.3`. Run from a project without that `.npmrc`, it printed `5.2.0`.
  - The cause surfaced only after someone compared `.ai-workflow/config.json` with the release and diffed an installed skill against the 5.2.0 source.
- **Mixed-version install.** A 3.1.1 → 5.2.0 `init` printed `Preserved modified files: .ai-workflow/bin/check.mjs` and kept the old checker.
  - The file was byte-identical to the 3.1.1 `assets/check.mjs` after the project's own formatter ran on it.
  - So the only "local edit" was a formatter pass, yet the project ran 5.2.0 skills next to a 3.1.1 checker.
  - `doctor` still passed everything and exited 0.

## What Didn't Work

- **Checking for a version mismatch alone cannot catch the stale-CLI case.** In the failure above, the CLI and the install were both 5.0.3, so they agreed. The only thing that exposes the problem is the version number itself in the output, read by a person who expected 5.2.0. That is why `init` and `doctor` now always print the running and installed versions, not only on a mismatch.
- **`config.json` does not show a preserved file.** When an install keeps a modified file, it records the hash of the *package source* for that path, not the hash of the file left on disk. See `src/install.mjs:110-112` for trees and `src/install.mjs:126-128` for files: both return `hash: sourceHash` with `preserved: true`. That hash is stored at `src/install.mjs:231`, `src/install.mjs:246` and `src/install.mjs:258`. So after a preserving upgrade, `config.json` reads as if the new version were fully in place. Only comparing the bytes on disk with the running package's source reveals the stale file.
- **`doctor` PASS had to be backed by a manual diff on every rollout.** Before this fix, each project upgraded to 5.2.0 was verified by comparing its skills, checker and graph runtime against the published package by hand, because `doctor` only counted files that were present. (session history)
- **`@latest` is not a reliable upgrade target through npx** when a project-level `.npmrc` points at a registry that might be unreachable. npx falls back to a cached older CLI without an error. (session history)
- **A smoke run that pipes CLI output into `| head` gives wrong exit codes.** `head` closes the pipe early, and the CLI then crashes with an unhandled `EPIPE`, which turns a WARN-only `doctor` run into exit 1. Capture output to a file, then read the exit code, before you judge pass or fail.

## Solution

**`init` names both versions.** See `bin/ai-workflow-kit.mjs:226-236`. Before:

```text
Installed/updated AI Workflow Kit.
AI Workflow Kit is already up to date.
```

After:

```text
Installed AI Workflow Kit 5.2.0.
AI Workflow Kit 5.2.0 is already up to date (installed 5.2.0).
Updated AI Workflow Kit 3.1.1 → 5.2.0.
WARNING  This CLI (5.2.0) is older than the kit it replaced (5.3.0), so the project was downgraded. If npx ran a cached copy, re-run: npx --registry=https://registry.npmjs.org/ @pazmo/ai-workflow-kit@5.3.0 init
Preserved modified files: .ai-workflow/bin/check.mjs
WARNING  Mixed-version install: the files above were kept as they were and do not match 5.2.0. To take 5.2.0, delete each one and re-run init; copy any local edits you want to keep first.
```

How it works:

- `installPrepared` returns `previousVersion` and `version` (`src/install.mjs:262-279`).
- `previousVersion` is the `packageVersion` from the previous `config.json`. `version` is the running package's version, read by `readPackageVersion` (`src/version.mjs:4`).
- The downgrade warning uses `compareVersions` (`bin/ai-workflow-kit.mjs:229`, `src/version.mjs:16`).

**`doctor` prints one version line, and its severity depends on which side is older.** The logic is `versionCheck` at `bin/ai-workflow-kit.mjs:81-103`, called at `bin/ai-workflow-kit.mjs:127`:

```text
PASS  Kit version: CLI 5.2.0, installed 5.2.0
WARN  Kit version: CLI 5.2.0, installed 5.0.3
FAIL  Kit version: CLI 5.2.0, installed 5.3.0
      This CLI is older than the installed kit: it cannot check that release, and its init would downgrade it.
      npx may have run a cached copy (for example when a private registry in .npmrc is unreachable). Run: npx --registry=https://registry.npmjs.org/ @pazmo/ai-workflow-kit@5.3.0 doctor
```

- **CLI older than the install → `FAIL`** (`ok: false`, `bin/ai-workflow-kit.mjs:98`). The result feeds the exit code through `let ok = version.ok` (`bin/ai-workflow-kit.mjs:153`).
- **CLI newer than the install → `WARN`** with `ok: true` (`bin/ai-workflow-kit.mjs:90`).
- **Installed version not recorded or not a version → `WARN`** (`bin/ai-workflow-kit.mjs:86`).

**When the versions match, `doctor` compares the bytes of managed files.**

- `managedDrift` (`src/install.mjs:290`) checks the host skill trees, `.ai-workflow/graph`, the Story and Task templates, `.ai-workflow/bin/graph.mjs` and `.ai-workflow/bin/check.mjs`. It compares each one present on disk with the running package's source.
  - Trees are compared file by file (`src/install.mjs:301-305`), so the output names the differing files inside them.
  - Single files are compared by hash (`src/install.mjs:311`).
- `doctor` prints one line per differing path, then one line of advice (`bin/ai-workflow-kit.mjs:165-173`):

```text
WARN  Mixed version: .ai-workflow/bin/check.mjs differs from 5.2.0
WARN  Mixed version: .ai-workflow/graph differs from 5.2.0 (executor.mjs)
      Kept from an older release or edited locally (a formatter pass counts). To take 5.2.0, delete each listed path and re-run init; copy any edits you want to keep first.
```

- For a tree, delete the whole directory, not one file inside it. A tree whose current hash differs from the recorded hash is preserved again (`src/install.mjs:111`). Only a missing target is copied fresh.

**Tree hashes stay compatible with existing installs.**

- `treeFiles` (`src/install.mjs:55`) is the new walker that per-file comparison needs.
- `treeHash` (`src/install.mjs:73-78`) now builds on it, but joins the same `relative:hash` entries in the same walk order. The comment at `src/install.mjs:73` records why: the tree hashes stored in `config.json` must not change.

**README upgrade steps pin the exact version.** See `README.md:36` and `README.ko.md:36`:

```sh
VERSION=$(npm view @pazmo/ai-workflow-kit version --registry=https://registry.npmjs.org/)
npx @pazmo/ai-workflow-kit@$VERSION --version
npx @pazmo/ai-workflow-kit@$VERSION init
npx @pazmo/ai-workflow-kit@$VERSION doctor
```

A cached copy of a different version cannot satisfy an exact version. For a project whose `.npmrc` points at a private registry, the README (`README.md:42`) puts the override *before* the package name: `npx --registry=https://registry.npmjs.org/ @pazmo/ai-workflow-kit@$VERSION init`.

## Why This Works

- **The first output line names the version that ran.** A stale cached CLI now shows up immediately: `AI Workflow Kit 5.0.3 is already up to date (installed 5.0.3).` cannot be mistaken for a 5.2.0 upgrade. That one line is the only signal for the case where the CLI and the install are both stale.
- **Failing the older-CLI direction blocks the dangerous case.**
  - `doctor` builds its file list from the running package: graph runtime names come from its own `src/graph` (`bin/ai-workflow-kit.mjs:150`). A CLI older than the install cannot vouch for files it does not know.
  - The same CLI's `init` would overwrite the newer files with older ones.
  - This is also exactly how a cached npx copy shows up after someone else upgraded the project.
- **Warning in the newer-CLI direction is enough.** That install is an older but consistent release, either not yet upgraded or pinned on purpose, and one `init` fixes it. Failing here would make `doctor` fail on every pinned project.
- **Bytes are compared only when the versions match.** Then any difference means a preserved file: a local edit, a formatter pass, or a copy left over from an older release. That is precisely what `config.json` hides, because a preserving install records the source hash. When the versions differ, almost every file differs, and per-file lines would only repeat "run init". So `doctor` skips the comparison, and in the CLI-newer case says so (`bin/ai-workflow-kit.mjs:93`).

## Prevention

- **For upgrades:**
  - Pin the exact version, run `--version` first, and stop if it does not print the expected release.
  - Never trust `@latest` through npx in a project whose `.npmrc` points elsewhere.
  - Put npm options such as `--registry` before the package spec. `npm help exec` says that options after the first positional argument are passed to the executed command, so npm never sees them.
  - Right after publishing, pin the version you just published instead of reading it back with `npm view`. On a release day the registry kept returning the previous version for about 1.5 minutes after a successful publish, so the README's `VERSION=$(npm view …)` step would have pinned the old release in that window. (session history)
    - The `+ <package>@<version>` line is not proof the version can be fetched yet. For 5.3.0, `npm publish` printed it with `Your package is being processed and may take a few minutes to become available`. That was more than a minute before the registry's `time` for the version (`2026-11-05T05:24:30Z`).
    - A pinned `npx …@<new version>` in that window fails loudly, not silently:

      ```text
      npm error notarget a package version that doesn't exist.
      ```

    - On 2026-11-05 it failed about 17 seconds after that `time`. A cache-busting request for the package document (a `?t=<timestamp>` query) already listed 5.3.0.
    - The registry serves that document with `cache-control: public, max-age=300`. So both npm's local cache and the registry's CDN may hand out a pre-publish copy for up to five minutes. Which of the two did it here was not separated: npm's cache index held entries for that document only from the retry onward, so any entry from the failing run was gone.
    - Eight seconds later, `npx --prefer-online --registry=https://registry.npmjs.org/ -y @pazmo/ai-workflow-kit@5.3.0 --version` printed `5.3.0`.
    - So `notarget` within about five minutes of a publish means a cache window, not a failed publish. Confirm the publish with `npm view <package>@<version> version --prefer-online --registry=https://registry.npmjs.org/`. Then re-run with `--prefer-online`, placed before the package spec like `--registry`.
  - In projects that pin the kit as a package dependency, keep the `package.json` pin, the lockfile and `packageVersion` in `.ai-workflow/config.json` in agreement. (session history)
- **When a release adds a new managed path to `installPrepared`:** add it to `managedDrift` as well, so that `doctor` compares it.
- **For any check that reports "clean":** print the versions it compared, not just the pass count. A count like "22/22 PASS" from the wrong binary carries no information.
- **Tests that guard this behavior** (`test/version-report.test.mjs`) change the installed version by rewriting `packageVersion` in `config.json`. They simulate a formatter pass by appending a newline to a managed file:
  - `init names both versions when it updates an older install` (line 47)
  - `doctor fails when the CLI is older than the install` (line 88)
  - `an upgrade that keeps a formatted checker reports a mixed-version install` (line 98)
  - `deleting the kept file and re-running init clears the mixed-version warning` (line 117)
  - `doctor names the graph runtime directory and the file inside it that differs` (line 133)

```js
// test/version-report.test.mjs: older install plus a formatter pass on the checker
await setInstalledVersion(root, '3.1.1');
await reformat(path.join(root, '.ai-workflow/bin/check.mjs'));
const update = await installed(root);
assert.ok(update.stdout.includes(`Updated AI Workflow Kit 3.1.1 → ${version}.`));
assert.match(update.stdout, /Preserved modified files: \.ai-workflow\/bin\/check\.mjs/);
const doctor = run(root, 'doctor');
assert.equal(doctor.status, 0);
assert.ok(doctor.stdout.includes(`WARN  Mixed version: .ai-workflow/bin/check.mjs differs from ${version}`));
```

- **Limit:** only CLIs that include PR #22 print these lines. 5.3.0, published 2026-11-05, is the first release with them. A cached 5.2.0 or older copy still prints the old messages, so the README's pin-and-check steps stay the guard against that.

## Related Issues

- [installed-graph-execution-contract.md](installed-graph-execution-contract.md) — the earlier installer learning (a fresh `init` lacked the graph runtime). Its prevention rule to test install and upgrade in disposable projects still holds; this doc adds checking which CLI version ran and what content was installed.
- `docs/agent-office-handoff.md`: its migration step (update the install, then run `doctor`) was written before `doctor` printed versions. `doctor` now prints the CLI and installed versions that step asks you to confirm.
- [npm-publish-e404-from-rejected-login.md](npm-publish-e404-from-rejected-login.md) covers the step before this one: a publish that failed with `E404` because the saved npm login was refused.
- No GitHub issues exist for this; the work was tracked in PR #22.

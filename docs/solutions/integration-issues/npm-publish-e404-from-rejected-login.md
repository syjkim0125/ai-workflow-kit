---
title: npm publish fails with E404 when the saved npm login is no longer accepted
date: 2026-11-05
category: integration-issues
module: Release (npm publish)
problem_type: integration_issue
component: tooling
symptoms:
  - "`npm publish` ran the full test suite, then failed with `E404 Not Found - PUT https://registry.npmjs.org/@pazmo%2fai-workflow-kit`"
  - "The error added `'@pazmo/ai-workflow-kit@5.3.0' is not in this registry`, although `npm view` listed the package and its earlier versions"
  - "`npm whoami --registry=https://registry.npmjs.org/` failed with `E401 401 Unauthorized`"
root_cause: config_error
resolution_type: environment_setup
severity: medium
tags: [npm-publish, release, npm-auth, e404, e401, whoami, two-factor-auth]
---

# npm publish fails with E404 when the saved npm login is no longer accepted

## Problem

Publishing 5.3.0 failed with `E404 Not Found`. That reads like a wrong package name, scope or registry, but all three were correct. The real cause was the npm token in the user-level `~/.npmrc`: the registry no longer accepted it.

## Symptoms

- `npm publish` first ran `prepack`, which is `npm test` (`package.json`, `scripts.prepack`). All 190 tests passed and the tarball was built, about two minutes in. Only then did the upload fail:

```text
npm notice Publishing to https://registry.npmjs.org/ with tag latest and public access
npm error code E404
npm error 404 Not Found - PUT https://registry.npmjs.org/@pazmo%2fai-workflow-kit - Not found
npm error 404  '@pazmo/ai-workflow-kit@5.3.0' is not in this registry.
```

- The package existed. `npm view @pazmo/ai-workflow-kit versions --registry=https://registry.npmjs.org/` listed 3.0.0 through 5.2.0, and `npm owner ls` named the publishing account as owner.
- The cheap auth check failed loudly:

```text
$ npm whoami --registry=https://registry.npmjs.org/
npm error code E401
npm error 401 Unauthorized - GET https://registry.npmjs.org/-/whoami
```

## What Didn't Work

- **Reading E404 literally.** The name, scope and registry were all correct:
  - `npm config get registry` was `https://registry.npmjs.org/`.
  - `@pazmo:registry` was not set.
  - The repository has no project `.npmrc`.
  - Renaming, rescoping or pointing at another registry would not have fixed it.
- **Assuming yesterday's login still worked.** `~/.npmrc` held a single `//registry.npmjs.org/:_authToken=` line, written by `npm login` on 2026-11-04 at 19:04 KST. That was minutes before 5.2.0 was published (npm `time` for 5.2.0: `2026-11-04T10:08:23Z`). About 19 hours later the registry refused the same token. Whether it expired or was revoked was not determined. Either way it looked valid on disk.

## Solution

Log in again, confirm the identity, then publish:

```sh
npm login --registry=https://registry.npmjs.org/
npm whoami --registry=https://registry.npmjs.org/   # must print the owner account
npm publish
```

- `npm login` printed a notice that `npm tokens that bypass 2FA are being restricted for account changes and direct publishing`. It finished through a browser page.
- `npm publish` ran the tests again. After packing it stopped at `Authenticate your account at: https://www.npmjs.com/auth/cli/…` and waited for browser 2FA approval. After approval it printed `+ @pazmo/ai-workflow-kit@5.3.0`.

## Why This Works

- **The token was refused, and the refused write came back as 404.** These ran in the same environment, against the same package:
  - Before the re-login, `whoami` returned 401 and `publish` returned 404.
  - After it, `whoami` printed the owner and `publish` succeeded.
  - So the 404 was how the registry answered a write it would not authorize. It did not mean a missing package.
- **`whoami` reports the same failure as a plain 401.** It costs one request instead of a two-minute test run.
- **The failed publish consumed nothing.** `npm view … versions` still ended at 5.2.0, so 5.3.0 could be published unchanged.
  - This matters because a version number that has ever been published can never be reused, even after `npm unpublish`.
  - Confirm the version is absent before retrying, so a retry does not ship a bumped version for nothing.

## Prevention

- **Check the login before publishing.** Run `npm whoami --registry=https://registry.npmjs.org/` first, and stop unless it prints the package owner. `prepack` runs the full test suite before the upload, so a stale login otherwise shows up only after the tests finish.
- **Treat E404 on publish of a package that `npm view` shows as an auth failure first.** Run `whoami` before changing the name, scope, registry or version.
- **Expect a browser 2FA step during `npm publish`,** after the tests and the tarball listing. The command waits there. It is not hung.
- **Confirm the version is unpublished before any retry:** `npm view <package> versions --registry=https://registry.npmjs.org/`.
- **Publishing stays with the package owner.** Repository docs keep `npm publish` and the main merge user-owned (`docs/graph-verification.md:80`). The login and the 2FA approval are interactive and need the owner in any case.

## Related Issues

- [stale-cli-upgrade-passes-as-finished.md](stale-cli-upgrade-passes-as-finished.md) covers the first minutes after a successful publish: the registry can keep returning the previous version, and npx can report `notarget` for the new one.
- No GitHub issue. The release was PR #25 (`syjkim0125/ai-workflow-kit`).

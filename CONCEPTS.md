# Concepts

> Shared domain vocabulary for this project — entities, named processes, and status concepts with project-specific meaning. Seeded with core domain vocabulary, then accretes as ce-compound and ce-compound-refresh process learnings; direct edits are fine. Glossary only, not a spec or catch-all.

## Installation

### Host
An agent runtime the kit installs into a project, such as Codex or Claude Code. Each host gets its own copy of the workflow skill and its own instruction file with a kit-owned block.

### Managed path
A file or directory that the kit installs into a project and owns. Its content hash is recorded with the install, so a later run can tell kit-written content from local changes.

An update replaces a managed path only when it is missing or still matches the recorded hash. If a skill directory the kit never recorded already exists, the install stops instead of taking it over. Removal deletes only managed paths that still match. A managed directory is compared as a whole, so a change to any file inside it counts as a change to the directory.

### Preserved file
A managed path that an update or removal leaves as it is, because its content no longer matches the recorded hash. The cause can be a local edit, a formatter pass, or a copy left from an older release.
*Avoid:* modified file (when the cause is unknown)

A preserved file keeps being preserved on later runs until someone deletes it or it matches the release copy byte for byte. After an upgrade it turns the project into a Mixed-version install.

### Installed version
The kit release recorded by the last successful install in a project. It is separate from the version of the CLI that runs a command. A stale CLI can report on an install without changing it, so the two can differ.

### Mixed-version install
An install in which some Managed paths do not match the Installed version's release copies, usually because they were Preserved files through an upgrade. The install record still names the new release, so the mismatch shows only when the content on disk is compared with the release.

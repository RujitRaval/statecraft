# ADR 0015: Deterministic CLI config discovery

## Status

Accepted

## Context

Phase 4 needs a stable boundary between a future command dispatcher and the existing core validator. Automatic parent-directory walking or undocumented extension precedence can execute an unintended local module, while combining command parsing, Playwright orchestration, and config loading in one step would broaden the first CLI slice.

## Decision

- Add a private ESM workspace package named `@statecraft/cli` with a documented programmatic export and no command binary yet.
- Discover default TypeScript and JavaScript config module variants only in the selected working directory. An explicit config path resolves relative to that directory.
- Return canonical absolute paths, accept symbolic links to regular files, reject non-files and unreadable paths, and treat multiple distinct default configs as an error instead of applying extension precedence.
- Execute the selected config as trusted local code, require its default export, and pass the exported value through `@statecraft/core`'s `parseConfig` without duplicating the schema.
- Expose typed discovery and loading errors with stable machine-readable codes. Preserve `ConfigValidationError` for invalid exported values.
- Add no runtime dependency beyond the existing workspace core package. Defer command parsing, `init`, `scan`, `open`, terminal UX, exit codes, runner orchestration, and report UI.

## Consequences

Future Phase 4 commands can share one deterministic config boundary and classify expected failures without parsing messages. Users must choose explicitly if more than one supported default config exists. Importing a config may execute arbitrary local code with the user's privileges, matching the existing trust model for scenario modules. The package is not yet an executable CLI and the Phase 4 acceptance gate remains open.

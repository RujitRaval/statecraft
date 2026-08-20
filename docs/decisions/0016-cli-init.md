# ADR 0016: Overwrite-safe CLI initialization

## Status

Accepted

## Context

The first executable Phase 4 command must give a new project a useful, type-safe starting point without risking existing source files. A simple existence check followed by a normal write has a race window, while a force option or recursive cleanup could destroy user-owned work. `scan`, `open`, runner orchestration, and the report UI remain separate slices.

## Decision

- Add a `statecraft` executable with a small, dependency-free dispatcher supporting `init` and help. Unsupported or malformed invocations return setup exit code `2`; help and successful initialization return `0`.
- Generate `statecraft.config.ts` and `statecraft/scenarios/home/success.ts`. The starter covers one route/state across mobile/desktop and light/dark. Its typed config imports `defineConfig` from the one installed CLI package, while the valid empty scenario has no unresolved package import.
- Accept no force flag. Preflight every supported default config name and the generated scenario before writing, allow existing real directories and unrelated files, and reject symbolic-link directory boundaries.
- Create files exclusively so a concurrent filesystem change cannot be overwritten. Write the scenario first and publish the config last so a visible config never points at a scenario this invocation failed to create.
- Never delete paths during failure recovery. A concurrent process could replace a newly created path before cleanup, making pathname-based rollback destructive; preserve partial targets for inspection instead.
- Keep the same logic available through the small `initProject` and injectable `runCli` programmatic APIs. Defer `scan`, `open`, Playwright orchestration, HTML generation, and report UI.

## Consequences

A fresh project receives a deterministic, immediately editable starter and exact next steps. Re-running `init`, passing unsupported arguments, or encountering an existing target stops safely with exit code `2`. The command foundation establishes dispatch and output seams for later Phase 4 commands without adding a parser dependency. The full Phase 4 acceptance gate remains open until `scan`, report generation, and `open` are implemented.

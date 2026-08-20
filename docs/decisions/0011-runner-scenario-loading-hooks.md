# ADR 0011: Runner scenario loading and hooks

## Status

Accepted

## Context

Phase 3 needs to turn each state's configured `setup` path into trusted local scenario code without adding Playwright to the browser-independent core package. Hook failures must remain isolated to their matrix cell, and later navigation work needs a stable seam between pre- and post-navigation hooks.

## Decision

- Define the Playwright-specific `StatecraftScenario` and `ScenarioContext` contracts in `@statecraft/runner-playwright`.
- Resolve scenario paths against an explicit `scenarioBaseDirectory`, defaulting to the current working directory for programmatic callers.
- Load scenarios as local ESM modules, require an object default export, and runtime-check `beforeNavigate`, `afterNavigate`, and the reserved future `assert` hook when present.
- Add `runScenarioCells`, which loads each cell's scenario inside the existing isolated cell lifecycle and runs `beforeNavigate`, caller-owned work, then `afterNavigate`.
- Treat module-load, validation, and hook errors as cell failures so later cells continue. Keep built-in navigation, readiness, screenshot capture, diagnostics, and assertion execution out of this slice.

## Consequences

Scenario authors retain direct Playwright access through a small typed API. The caller-owned middle step lets the next Phase 3 slice add deterministic navigation without changing hook order. Scenario modules are trusted code and may execute arbitrary local side effects during import; Statecraft does not sandbox them.

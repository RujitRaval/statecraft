# Test Strategy

## Unit
Config validation; duplicate/invalid IDs; matrix expansion/filtering; coverage math; deterministic paths; serialization/schema; error classification; CLI parsing.

## Integration
Scenario loading; Playwright lifecycle; route interception; viewport/theme; readiness; screenshots; diagnostics; assertions; continuation after a failed cell.

The initial runner fixture uses real headless Chromium with programmatically supplied HTML. It verifies one healthy browser is reused, contexts/pages and cookies are isolated, configured viewports are applied, resources close after success and failure, and a rejected cell does not prevent later cells from running. Mocked lifecycle tests force cleanup failure to verify browser quarantine, replacement, and run-level replacement failures.

Scenario integration tests load real local ESM fixtures, validate module exports and hook types, verify `beforeNavigate`/caller/`afterNavigate` ordering, and prove module-load or hook failures settle without preventing later cells from running.

## End-to-end
Run against example Next.js app; verify matrix size, screenshots, JSON/HTML, known passes, and at least one intentional failure.

## CLI contracts
Exit 0 all-pass; 1 completed with failures; 2 invalid config/internal setup. Verify `open` with/without report.

## Determinism
Repeated unchanged runs should produce stable IDs, paths, statuses, and materially stable screenshots. Remove animations/caret and settle fonts.

## Release smoke
Clean install -> Chromium -> build -> tests -> example app -> scan -> offline report validation.

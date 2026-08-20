# Test Strategy

## Unit
Config validation; duplicate/invalid IDs; matrix expansion/filtering; coverage math; deterministic paths; serialization/schema; error classification; CLI parsing.

## Integration
Scenario loading; Playwright lifecycle; route interception; viewport/theme; readiness; screenshots; diagnostics; assertions; continuation after a failed cell.

The initial runner fixture uses real headless Chromium with programmatically supplied HTML. It verifies one healthy browser is reused, contexts/pages and cookies are isolated, configured viewports are applied, resources close after success and failure, and a rejected cell does not prevent later cells from running. Mocked lifecycle tests force cleanup failure to verify browser quarantine, replacement, and run-level replacement failures.

Scenario integration tests load real local ESM fixtures, validate module exports and hook types, verify `beforeNavigate`/caller/`afterNavigate` ordering, and prove module-load or hook failures settle without preventing later cells from running.

Navigation integration tests use real Chromium and intercepted HTTP fixtures to verify same-origin URL resolution, rejection of cross-origin redirects and hook-driven navigation, rejection of replacement-document navigation during readiness, theme state before application scripts, light/dark media emulation, arbitrary named themes, reduced motion, load/selector/font readiness, animation and caret suppression, immutable navigation metadata, and post-readiness execution. Invalid scenarios, hook failures, cross-origin routes, aborted navigation, readiness timeouts, invalid run options, and launch failures cover the failure boundary and continuation contract.

Capture integration tests verify viewport-sized PNG signatures and dimensions, screenshot-before-assertion ordering, assertion execution, absent assertions, sanitized console/page/request diagnostics, default and overridden diagnostic failure policies, screenshot failures, partial evidence on rejection, and continuation into later cells. Fixtures use intercepted HTTP responses and deliberately failed subrequests; no screenshot or report is written to disk.

Persistence integration tests run the complete programmatic lifecycle and verify deterministic PNG locations, passed/failed result translation, partial screenshot retention, sanitized schema-v1 JSON, aggregate coverage, normalized private modes, stale artifact replacement, preservation of future report UI files, artifact/report symbolic-link refusal, rollback ordering and recovery-state preservation, live and abandoned lock handling, malformed individual/cross-cell inputs and project roots, empty selections, invalid timestamps, and public package contracts. Tests write only to isolated temporary project directories.

## End-to-end
Run against example Next.js app; verify matrix size, screenshots, JSON/HTML, known passes, and at least one intentional failure.

## CLI contracts
Exit 0 all-pass; 1 completed with failures; 2 invalid config/internal setup. Verify `open` with/without report.

## Determinism
Repeated unchanged runs should produce stable IDs, paths, statuses, and materially stable screenshots. Remove animations/caret and settle fonts.

## Release smoke
Clean install -> Chromium -> build -> tests -> example app -> scan -> offline report validation.

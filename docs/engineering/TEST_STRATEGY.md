# Test Strategy

## Unit
Config validation; duplicate/invalid IDs; matrix expansion/filtering; coverage math; deterministic paths; serialization/schema; error classification; CLI parsing.

## Integration
Scenario loading; Playwright lifecycle; route interception; viewport/theme; readiness; screenshots; diagnostics; assertions; continuation after a failed cell.

The initial runner fixture uses real headless Chromium with programmatically supplied HTML. It verifies one healthy browser is reused, contexts/pages and cookies are isolated, configured viewports are applied, resources close after success and failure, and a rejected cell does not prevent later cells from running. Mocked lifecycle tests force cleanup failure to verify browser quarantine, replacement, and run-level replacement failures.

Scenario integration tests load real local ESM fixtures, validate module exports and hook types, verify `beforeNavigate`/caller/`afterNavigate` ordering, and prove module-load or hook failures settle without preventing later cells from running.

Navigation integration tests use real Chromium and intercepted HTTP fixtures to verify same-origin URL resolution, rejection of cross-origin redirects and hook-driven navigation, rejection of replacement-document navigation during readiness, theme state before application scripts, light/dark media emulation, arbitrary named themes, reduced motion, load/selector/font readiness, animation and caret suppression, immutable navigation metadata, and post-readiness execution. Invalid scenarios, hook failures, cross-origin routes, aborted navigation, readiness timeouts, invalid run options, and launch failures cover the failure boundary and continuation contract.

Capture integration tests verify viewport-sized PNG signatures and dimensions, screenshot-before-assertion ordering, assertion execution, absent assertions, sanitized console/page/request diagnostics, default and overridden diagnostic failure policies, screenshot failures, partial evidence on rejection, and continuation into later cells. Fixtures use intercepted HTTP responses and deliberately failed subrequests; no screenshot or report is written to disk.

Persistence integration tests run the complete programmatic lifecycle and verify deterministic PNG locations, passed/failed result translation, partial screenshot retention, sanitized schema-v1 JSON, offline HTML generation, aggregate coverage, normalized private modes, coherent stale-output replacement, artifact/JSON/HTML symbolic-link refusal, final-HTML rollback ordering and recovery-state preservation, live and abandoned lock handling, malformed individual/cross-cell inputs and project roots, empty selections, invalid timestamps, and public package contracts. Tests write only to isolated temporary project directories.

## End-to-end
Run against example Next.js app; verify matrix size, screenshots, JSON/HTML, known passes, and at least one intentional failure.

The example-app foundation adds unit coverage for its fixed data payloads, no-data classification, malformed response rejection, duplicate IDs, order summaries, currency formatting, nested customer records, safe metric and recent-order relationships, and long-content variants. Browser-backed coverage exercises dashboard and orders success/loading/empty/error behavior; customer success/loading/401/403/404/error/long-content behavior; route-to-response identity; server-only fixture exclusion from browser chunks; recovery; route-aware navigation; working order filters with URL state; dark theme; customer link semantics; concise live-region announcements; and three-column mobile navigation. Intentional-defect contracts prove that the default mobile customer remains contained while the long email overflows, and that the dark order-error signal alone has identical foreground/background colors. The final Phase 6 gate still requires the complete application scan to assert those defects as known failures.

## CLI contracts
Exit 0 all-pass; 1 completed with failures; 2 invalid config/internal setup. Verify `open` with/without report.

Config foundation tests cover default and explicit path discovery, canonical paths, absent and ambiguous configs, invalid roots and non-file paths, trusted module import failures, missing default exports, delegation to core validation, and the built package/type boundary. Discovery tests use isolated temporary projects and do not walk parent directories or access the network.

CLI initialization tests cover generated config/scenario content, canonical project roots, existing-directory preservation, every supported config-name conflict, scenario conflicts, repeated initialization, symbolic-link directory refusal, invalid/unwritable roots, help and usage errors, exact next-step output, exit codes, the public type boundary, the built executable entrypoint, and isolated-consumer compilation/loading from a one-package CLI install. All filesystem cases use isolated temporary projects.

CLI scan tests cover deterministic option parsing, exact route selection, unknown-route setup failures before output creation, config-relative scenario resolution, headed-mode forwarding, all-pass and completed-with-failure summaries, stable exit codes, continuation after a failed cell, schema-v1 report persistence, deterministic screenshot paths, and the public programmatic/type boundary. Browser-backed cases use the pinned Chromium build and isolated temporary projects.

CLI open tests cover canonical latest-report selection, absent reports, invalid roots, non-file targets, symbolic-link boundaries, shell-free platform command mapping, launcher failures, argument rejection, terminal sanitization, exit codes, and public package/type boundaries. Fixture launchers are injected internally so tests never open a real browser or create report UI.

## Report contracts

Report transformation tests verify deterministic first-seen column and route/state ordering, aligned missing cells, report-relative screenshot references, and rejection of invalid schema input. Renderer tests cover summary/matrix/detail content, empty selections, HTML escaping for report-controlled diagnostics, all five filter contracts, valid identifiers named `all`, no external assets, and an exact embedded-script CSP hash. A real Chromium `file://` test covers AND filtering across route, state, viewport, theme, and status; sparse cells and filtered row-group spans; no-match/reset behavior; query plus hash restoration through browser history; direct-hash focus return; filtered table alignment; keyboard detail opening and Escape return; responsive layout; 44-pixel mobile controls; screenshots; and zero network requests. Runner persistence tests cover coordinated replacement, owner-private file modes, artifact/JSON/HTML symbolic-link boundaries, stable errors, and rollback; report package-boundary tests cover the built renderer API. Browser-backed CLI scan tests prove PNG, JSON, and HTML are produced together and that terminal output points to the offline document.

## Determinism
Repeated unchanged runs should produce stable IDs, paths, statuses, and materially stable screenshots. Remove animations/caret and settle fonts.

## Release smoke
Clean install -> Chromium -> build -> tests -> example app -> scan -> offline report validation.

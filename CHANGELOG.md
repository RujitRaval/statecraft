# Changelog

All notable changes to Statecraft will be documented in this file.

This project uses the four-part version format required by the GStack ship workflow.

## [0.12.0.0] - 2026-08-20

### Added

- Developers can discover and load a Statecraft configuration through the new `@statecraft/cli` programmatic API, with explicit-path support and canonical source paths.
- Default discovery recognizes TypeScript and JavaScript module variants in one project directory, rejects ambiguous matches, and exposes stable typed discovery and loading errors.
- Tests cover missing, ambiguous, unreadable, non-file, symlinked, and explicit config paths; ESM and CommonJS loading; core validation; import failures; and public package contracts.

### Changed

- Phase 4 is now underway with its CLI package and configuration boundary documented, while command parsing, `init`, `scan`, `open`, runner orchestration, terminal UX, and report UI remain deferred.

### Security

- Config discovery verifies project-root traversal and file read access before importing a trusted local module, and never silently chooses between distinct default configs.

## [0.11.0.0] - 2026-08-20

### Added

- Developers can run matrix cells and receive a validated schema-version-1 report through the new `runPersistedScenarioCells` API.
- Successful and partial screenshots are persisted at deterministic, collision-resistant paths under the ignored `.statecraft/artifacts/` tree, and report data is published at `.statecraft/report/statecraft.json`.
- Browser-backed and filesystem fault-injection tests cover result translation, sanitized failures, deterministic paths, permissions, symlink rejection, concurrent locking, abandoned-run recovery, rollback ordering, and package contracts.

### Changed

- Phase 3 is now complete: runner outcomes translate into the existing core execution contracts, coverage and duration summaries are derived from validated executions, and the report manifest is published only after its artifact tree is durable.
- Existing report UI files remain untouched, while CLI commands and report UI generation remain deferred to later phases.

### Security

- Persistence uses owner-only directories and files, refuses symbolic-link output boundaries, sanitizes unexpected lifecycle failures, and preserves recoverable state instead of exposing a report that references incomplete artifacts.

## [0.10.0.0] - 2026-08-20

### Added

- Developers can capture viewport-sized PNG screenshots in memory after deterministic readiness and then run optional scenario assertions with the new `runCapturedScenarioCells` API.
- Console messages, page errors, and failed requests are collected as bounded, sanitized diagnostics with configurable failure policies and stable structured failure codes.
- Browser-backed tests cover capture ordering, screenshot dimensions, assertion outcomes, failure isolation, noisy diagnostic caps, post-response evidence, cross-origin redirects, and public package contracts.

### Changed

- Runner failures now preserve safe partial navigation and capture evidence while continuing later matrix cells, without adding result persistence, CLI behavior, or report UI.
- Phase 3 now records screenshot capture, diagnostics, assertions, and failure policies as complete.

### Security

- Public diagnostic and error surfaces redact credentials, query values, fragments, authorization data, cookies, bearer tokens, and named secrets while replacing original throwable causes with sanitized copies.

## [0.9.0.0] - 2026-08-20

### Added

- Developers can run matrix cells through built-in navigation, theme application, scenario hooks, and deterministic readiness with the new `runNavigatedScenarioCells` API.
- Themes are applied before application scripts through `data-theme`, light/dark color-scheme emulation, and reduced-motion emulation while arbitrary named themes remain supported.
- Readiness now waits for the normal load event, an optional visible selector, and pending fonts while suppressing animations, transitions, smooth scrolling, and carets without relying on `networkidle` or fixed delays.
- Main-frame document navigation that starts during readiness is rejected so the post-readiness callback cannot observe a replacement document that skipped stability gates.
- Browser-backed tests cover lifecycle ordering, immutable navigation metadata, redirects, hook-driven and timed navigation, delayed fonts, run-level validation, failure isolation, and public package contracts.

### Changed

- Phase 3 now records navigation, theme application, and deterministic readiness as complete while keeping screenshots, diagnostics, and assertions in the following runner slice.

### Security

- Configured routes, redirects, scenario hooks, and navigation scheduled during readiness must remain on the configured base origin before caller-owned post-readiness work can run.

## [0.8.0.0] - 2026-08-19

### Added

- Developers can load typed local scenario modules and run optional `beforeNavigate` and `afterNavigate` hooks around caller-owned work for each matrix cell.
- Scenario hooks receive the isolated Playwright page and browser context together with the cell's route, state, viewport, and theme metadata.
- Scenario loading, export validation, lifecycle ordering, hook failures, working-directory resolution, launch-option forwarding, and per-cell continuation are covered by behavioral, browser-backed, package-boundary, and compile-time API tests.

### Changed

- Scenario module and hook failures now settle on the affected cell without preventing later cells from running.
- Phase 3 documentation now defines the trusted local-code boundary and keeps built-in navigation, theme application, readiness, screenshots, diagnostics, assertions, CLI, and report UI outside this focused runner step.

## [0.7.0.0] - 2026-08-19

### Added

- Developers can execute deterministic matrix cells through the initial `@statecraft/runner-playwright` programmatic API while reusing a healthy Chromium process.
- Every cell receives a fresh Playwright context and page with its configured viewport, isolated cookies and storage, ordered settled outcomes, and cleanup before the next cell starts.
- A browser is quarantined and replaced when context cleanup cannot be confirmed, preserving isolation without preventing unrelated cells from running.
- Real-Chromium fixtures, forced lifecycle-failure tests, built-package checks, and compile-time API contracts cover every runner path.

### Changed

- Phase 3 is now underway, with its runner lifecycle boundary documented while scenario hooks, navigation, screenshots, diagnostics, assertions, CLI, and report UI remain out of scope.
- CI installs the exact Chromium build paired with Playwright `1.62.1` before running the repository quality gate.

## [0.6.0.0] - 2026-08-19

### Added

- Developers can parse individual execution outcomes and complete schema-version-1 JSON reports through strict, browser-independent core contracts.
- Reports now carry explicit route, state, viewport, theme, scenario, artifact, failure, diagnostic, duration, and coverage data without reconstructing metadata from filenames.
- The public core API exports result/report types, stable validation errors, `REPORT_SCHEMA_VERSION`, `parseExecutionResult`, `parseReport`, and deterministic `serializeReport` output.

### Changed

- Report summaries are verified against their execution records, including unique coordinates, shared metadata, counts, duration, and all configured-state coverage metrics.
- Phase 2 is now complete, with its result/report boundary documented in the core API guide and ADR 0009 while Playwright and report UI work remain out of scope.
- Agent guidance now routes matching development tasks through the appropriate GStack workflow skills.

### Security

- Report parsing and serialization strip URL credentials and fragments, redact every query value, reject sensitive request fields, and validate screenshot paths against explicit execution coordinates.

## [0.5.0.0] - 2026-08-19

### Added

- Developers can calculate execution, state, responsive, and theme coverage from an explicit configured matrix with `calculateCoverage`.
- Coverage remains deterministic for missing, duplicated, conflicting, reordered, empty, filtered, case-mismatched, and unconfigured observations without allowing results to inflate configured-state denominators.
- The public core API now exports `CoverageObservation`, `CoverageMetric`, and `CoverageSummary`, backed by behavioral, edge-case, package-boundary, and compile-time contract tests.

### Changed

- Core API documentation and ADR 0008 now define metric aggregation, route-scoped identity, two-decimal percentages, conservative duplicate handling, immutable outputs, and the boundary from later result/report contracts.
- The Phase 2 checklist now records coverage calculations as complete while leaving result/report contracts, Playwright, and the report UI for their approved development steps.

### Fixed

- Exact half-way coverage percentages now round correctly to two decimal places, including `57 / 800` as `7.13%`.

## [0.4.0.0] - 2026-08-19

### Added

- Developers can derive one stable, project-relative PNG path for every matrix cell with `screenshotArtifactPath`, without reading or writing the filesystem.
- Artifact paths preserve readable normal identifiers while preventing viewport/theme delimiter collisions, path traversal, Windows device-name failures, case-folding collisions, and Unicode-normalization collisions.
- Oversized identifiers now use bounded readable prefixes with SHA-256 suffixes so every directory component and combined PNG filename stays within common filesystem limits.
- The public core API exports the opaque `ScreenshotArtifactPath` type, backed by behavioral, portability, package-boundary, and compile-time contract tests.

### Changed

- The core API documentation, Phase 2 checklist, and ADRs now define artifact layout, encoding, component budgets, metadata separation, and the runner/report ownership boundary.

## [0.3.0.0] - 2026-08-19

### Added

- Developers can expand a validated configuration into one deterministic execution cell for every configured route, state, viewport, and theme combination.
- Matrix planning supports exact route, state, viewport, and theme selections while preserving configured order and preventing duplicate filter values from duplicating cells.
- The public core API now exports `expandMatrix`, `MatrixCell`, and `MatrixFilter`, with behavioral, edge-case, built-package, and compile-time contract coverage.

### Changed

- The core API documentation and ADRs now define matrix ordering, shared state-ID filtering, unmatched-selection behavior, and the browser-independent planner boundary.
- The Phase 2 checklist now records matrix expansion as complete while leaving coverage calculations, result contracts, artifact paths, Playwright, and the report UI for their approved steps.

## [0.2.0.0] - 2026-08-19

### Added

- Developers can author typed Statecraft configurations with `defineConfig` and validate unknown runtime values with `parseConfig`.
- Configuration validation now covers HTTP(S) base URLs, local route paths, named viewports and themes, explicit route states, scenario module paths, failure policies, duplicate IDs, and unknown properties.
- Callers can classify failures through Statecraft-owned error and issue codes with deterministic property paths instead of depending on validator internals.
- The public core API, validation rules, trusted-code boundary, and dependency decision are documented for Phase 2 contributors.

### Changed

- `@statecraft/core` now uses exact-versioned Zod 4 as its only runtime dependency while remaining browser-independent and private until the remaining Phase 2 contracts stabilize.
- The Phase 2 checklist now records configuration types, runtime validation, `defineConfig`, stable errors, and API documentation as complete.

## [0.1.0.0] - 2026-08-19

### Added

- Statecraft now has a reproducible pnpm workspace with strict TypeScript, ESLint, Vitest, and native ESM build tooling.
- The initial private `@statecraft/core` package establishes a clean build and export boundary for Phase 2 contracts.
- Local and hosted checks now verify dependency installation, linting, type safety, tests, documentation, package exports, and builds.

### Changed

- Development now targets Node.js 22.20 or newer within the Node 22 line, or Node.js 24.x.
- Dependency installs now use exact versions, an integrity-pinned package manager, strict engine and peer checks, and a one-day release quarantine.
- Repository commands invoke the pinned package manager through Corepack, so fresh environments do not require a global pnpm shim.
- Contributor documentation now describes the implemented Phase 1 foundation and keeps later packages out of scope until their development phases begin.

## [0.0.1.0] - 2026-08-19

### For contributors

- Contributors and coding agents now follow a documented branch and pull request workflow with GStack review and ship as required gates.
- Repository checks now catch missing or broken documentation and, once implementation starts, block missing or failing lint, typecheck, test, and build scripts.
- Pull requests now receive CodeQL analysis and dependency review, while Dependabot, code ownership, a pull request template, and security reporting guidance support ongoing maintenance.

### Changed

- The ignore policy now keeps local archives, credentials, reports, browser artifacts, caches, logs, editor files, and agent state out of the public repository.
- Repository entry points now keep implementation work inside the approved Phase 1 and Phase 2 boundary.

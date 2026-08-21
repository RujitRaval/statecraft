# Changelog

All notable changes to Statecraft will be documented in this file.

This project uses the four-part version format required by the GStack ship workflow.

## [0.22.0.0] - 2026-08-20

### Added

- Developers can run the polished Northline example through a checked-in Statecraft config that expands 15 meaningful route/state combinations across mobile and desktop viewports plus light and dark themes for 60 deterministic cells.
- Route-level scenarios render every dashboard, orders, and customer state, distinguish 401 from 403 access failures, and assert the approved contrast and narrow-viewport defect boundaries without an expected-failure mode.
- A production-browser gate runs the public CLI, requires exactly 56 passes and four known assertion failures, and verifies schema-v1 JSON, self-contained HTML, coverage metrics, and non-empty screenshots for all 60 cells.

### Changed

- The example scan is documented as a two-terminal workflow, keeps generated `.statecraft/` evidence local, and completes Phase 6 with ADR 0025 and synchronized project guidance.
- Vitest keeps the normal workspace suite parallel, then runs the resource-heavy scenario matrix in an isolated project so browser tests retain their default timeout without competing for Chromium resources.

## [0.21.0.0] - 2026-08-20

### Added

- The Phase 6 example now contains two deterministic visual defects for Statecraft to expose: a long customer contact email that overflows only on narrow viewports and an orders service-error signal that disappears only in dark theme.
- Real-Chromium contracts protect each trigger boundary with healthy controls, proving that the default mobile customer remains contained and the light-theme error signal retains foreground contrast.
- ADR 0024 records why the defects live in the production fixture layout without query flags, test-only switches, external data, or nondeterministic timing.

### Changed

- Phase 6 now includes its focused intentional-defect slice. The complete route/state/viewport/theme scenario matrix and example-app end-to-end gate remain the final separate Phase 6 follow-up.

## [0.20.0.0] - 2026-08-20

### Added

- The polished `/customers/[id]` example route now demonstrates deterministic success, loading, unauthorized, not-found, recoverable service-error, and long-content states backed by a runtime-validated fictional customer API.
- Customer records combine account health, recent commitments, relationship activity, contact details, delivery constraints, and account notes in responsive light and dark layouts with working navigation and order links.
- Unit and production-browser coverage verifies nested payload validation, identity binding, 401/403/404 distinctions, retries, long-content wrapping, currency precision, accessible status announcements, and mobile containment.

### Changed

- The shared workspace navigation now exposes Customers as its third route and keeps a balanced three-column mobile layout without changing the existing responsive order table.
- Phase 6 now includes complete dashboard, orders, and customer-detail state surfaces; intentional defects and the complete Statecraft scenario matrix remain focused follow-ups.

### Fixed

- Recent-order status pills size to their labels, only records present in the live queue link into that queue with canonical status data, and state changes announce a concise message instead of the full customer dossier.
- Customer validation now rejects inconsistent metric/order relationships and valid records whose identity does not match the requested route.

### Security

- Customer fixture values live behind Next.js's `server-only` boundary, and a production-build regression check prevents restricted contact, address, and note fields from entering downloadable browser chunks.

## [0.19.0.0] - 2026-08-20

### Added

- The polished `/orders` example route now demonstrates deterministic success, loading, empty, and recoverable error states backed by a runtime-validated fictional orders API.
- Search, status filtering, URL-restored filter state, queue-derived summaries, and route-aware desktop and mobile navigation make the example a complete interactive workspace slice.
- Unit and production-browser coverage verify malformed and overflowing payloads, every route state, filtering, App Router navigation, responsive table semantics, dark mode, and narrow-viewport containment.

### Changed

- The shared workspace shell now uses App Router links throughout so navigation preserves shared layout state.
- Phase 6 now includes its first focused workflow route and documents the orders-state boundary; customer detail states, intentional defects, and the complete scenario matrix remain follow-up slices.

### Fixed

- Responsive order rows retain their column-header relationships in the accessibility tree while presenting a compact mobile layout.
- Search, filter, brand, and navigation controls meet full interaction-target sizing, and empty and error states no longer reuse success-only copy.

## [0.18.0.0] - 2026-08-20

### Added

- Phase 6 begins with the polished Northline commerce operations example application, a Next.js App Router fixture with a responsive dashboard, deterministic fictional data, and light/dark theme support.
- The dashboard provides deliberate loading, success, empty, and recoverable error states backed by runtime-validated API data and real-Chromium coverage.
- A documented industrial-editorial design system, self-hosted IBM Plex Sans variable font, reusable server-rendered workspace shell, and architecture decision establish the visual and structural foundation for the remaining example routes.

### Changed

- Phase 5 is complete and Phase 6 is active; `/orders`, `/customers/[id]`, intentional defects, and the complete Statecraft scenario matrix remain focused follow-up slices.
- Root lint, type-check, test, and build orchestration now include the example application, deterministic Next route type generation, its production build, and its browser fixture tests.

### Fixed

- Dashboard payload validation rejects unsupported pulse cardinality and duplicate metric or order identifiers before rendering.
- The error-state browser fixture proves Retry transitions through loading to success, and the Next command wrapper forwards termination signals without orphaning its child server.
- GStack design review raised utility captions to at least 12px and compact control targets to at least 44px.

### Security

- Every repository-owned Next.js command disables framework telemetry before loading the CLI; the example uses fixed fictional data, no hosted service, and no external font or asset request.

## [0.17.0.0] - 2026-08-20

### Added

- Offline reports now provide route, state, viewport, theme, and status filters with deterministic AND semantics, URL-backed selections, reset controls, and a clear no-results state.
- Every matrix cell can open one keyboard-accessible inline detail view with screenshot evidence, metadata, failure information, and expandable console, page, and request diagnostics.
- Real-Chromium coverage now verifies offline loading, filtering, sparse matrices, responsive layouts, keyboard focus, direct links, and browser Back/Forward restoration.

### Changed

- Mobile reports present the coverage matrix as evidence-first two-column cards, while tablet and desktop layouts preserve aligned route, state, viewport, and theme columns.
- Phase 5 is complete. The example application and all Phase 6 work remain deferred until that phase is explicitly initiated.

### Fixed

- Valid identifiers named `all` remain filterable, filtered route headings keep correct row spans, and missing matrix cells remain aligned after every filter combination.
- Detail URLs now close stale or filtered-out selections, restore valid filter state on history traversal, and return focus to the source cell or a deterministic filter fallback.

### Security

- The self-contained report keeps all report data out of executable script, permits only the exact constant interaction script through its Content Security Policy hash, and continues to block network and external asset loading.

## [0.16.0.0] - 2026-08-20

### Added

- Every completed `statecraft scan` now produces a responsive offline report at `.statecraft/report/index.html` with execution coverage, route/state matrix cells, screenshot evidence, metadata, failures, and sanitized diagnostics.
- The new browser-independent `@statecraft/report` package exposes validated deterministic report transformation and HTML rendering contracts without a server, runtime script, external asset, telemetry, or new third-party runtime dependency.
- Transformation, rendering, package-boundary, CLI, real-Chromium persistence, symbolic-link, rollback, offline-file, and responsive visual checks cover the Phase 5 foundation.

### Changed

- HTML, schema-v1 JSON, and deterministic PNGs are staged and recovered as one output set under the runner's existing owned project lock, so overlapping scans cannot mix report generations.
- Phase 5 is now active, and Phase 4's remaining fresh-example `init` → `scan` → report handoff is unlocked while interactive report filters remain deferred to the next slice.

### Fixed

- Report view models now freeze nested execution diagnostics, failures, viewports, and coverage summaries instead of exposing mutable parsed data.
- Report route headers now use proper table row groups, screenshot dimensions reserve layout space, return links meet minimum target sizing, and the typography and color system remain legible across desktop and mobile layouts.

### Security

- Every report-controlled string is escaped, a restrictive Content Security Policy blocks scripts and network content, generated files remain owner-private where supported, HTML symbolic-link targets are rejected, and failed final publication restores the previous coherent report set.

## [0.15.0.0] - 2026-08-20

### Added

- Developers can run `statecraft open` to launch the latest `.statecraft/report/index.html` in their operating system's default browser, with a useful error when no HTML report exists.
- The CLI exports typed `openReport` and `OpenReportError` APIs with stable missing-report, invalid-root, invalid-path, and launcher-failure contracts.
- Filesystem, command, launcher, built-executable, package-boundary, and compile-time tests cover canonical paths, every symbolic-link boundary, platform mapping, process handoff, arguments, terminal output, and exit codes.

### Changed

- Phase 4's CLI command scope is complete; the fresh-example report gate remains pending on Phase 5 HTML generation, which stays outside this release.
- GUI launchers are detached after successful process spawn, so the CLI neither waits for a browser to exit nor treats Windows Explorer's later exit status as a failed open.

### Security

- Report opening rejects observed symbolic-link and non-regular boundaries, passes the absolute report path as one shell-free argument to an absolute system-launcher path, never creates or modifies HTML, and explicitly treats concurrent same-user project-directory mutation during the pathname handoff as trusted local state.

## [0.14.0.0] - 2026-08-20

### Added

- Developers can run `statecraft scan` with optional `--config`, exact `--route`, and `--headed` controls to execute the deterministic core matrix through the completed Playwright runner.
- The CLI exports typed `scanProject` and `ScanError` APIs and prints route-grouped results, execution coverage, the stable schema-v1 JSON path, and aggregate pass/fail totals.
- Unit, orchestration, real-Chromium, built-executable, package-boundary, and compile-time tests cover option parsing, config-relative scenarios, filtering, continuation, persistence, summaries, and exit codes.

### Changed

- Phase 4 now connects config discovery, matrix expansion, browser execution, deterministic PNG persistence, and `.statecraft/report/statecraft.json`; `open` and report UI generation remain deferred.
- CLI type checking now includes the Playwright runner build and its DOM declarations as an intentional runtime dependency.

### Security

- Scan snapshots its output root before trusted config execution, rejects unknown routes before creating output, preserves the runner's private filesystem boundaries, and escapes terminal control characters in dynamic errors and summaries.

## [0.13.0.0] - 2026-08-20

### Added

- Developers can run the new `statecraft init` executable command to create a minimal typed config and editable starter scenario with exact next steps.
- The CLI now exports `defineConfig`, `initProject`, and injectable `runCli` APIs with stable initialization errors and process exit codes.
- Tests cover the built executable, one-package consumer compilation and loading, generated content, help and usage behavior, config/scenario conflicts, repeated initialization, invalid roots, and symbolic-link boundaries.

### Changed

- Phase 4 now includes command dispatch and initialization while `scan`, `open`, runner orchestration, and report UI remain deferred.

### Security

- Initialization has no force mode, checks every supported config filename before writing, creates target files exclusively, refuses symbolic-link starter directories, and never deletes paths during failure recovery.

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

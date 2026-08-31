# Changelog

All notable changes to UIWitness will be documented in this file.

This project uses the four-part version format required by the GStack ship workflow.

## [0.25.3.0] - 2026-08-31

### Added

- Existing projects now have a copy-ready migration guide covering every package, command, config, scenario, report path, and exact deprecation message without touching legacy evidence.

### Changed

- The complete Northline example now uses the UIWitness config, scenario root, environment variable, npm scripts, and 60-cell release-smoke journey.
- Current product, architecture, API, security, contributor, and launch guidance now presents the UIWitness identity while keeping the external repository and npm cutover explicitly pending.
- Launch documentation now uses freshly generated UIWitness overview and failure-detail images from the verified 60-cell offline report.

## [0.25.2.0] - 2026-08-31

### Changed

- Developers now initialize and promote projects with `uiwitness.config.mts` and `uiwitness/scenarios/**`; automatic discovery ignores legacy config names while explicit legacy config paths remain usable.
- CLI help, command summaries, errors, and next-step commands now present the UIWitness identity throughout the init, check, scan, and open journeys.
- Offline reports now use the UIWitness title, `UI/W` masthead mark, and UIWitness footer without changing the schema-v1 or interaction contract.

### Fixed

- The UIWitness footer wordmark now fits narrow report viewports without horizontal scrolling.
- Packed-package and registry consumer gates now verify the renamed config, scenario, help, promotion, and scan paths end to end.

## [0.25.1.0] - 2026-08-31

### Added

- New UIWitness runs now write screenshots, schema-v1 JSON, and offline HTML only beneath `.uiwitness/`, while report readers continue to accept legacy `.statecraft/artifacts/**` screenshot references without rewriting them.
- Public core types now distinguish UIWitness-only writer paths from the two-root schema-v1 read contract.

### Changed

- Check, scan, open, example evidence, package smoke, release smoke, and registry verification now use `.uiwitness/report/uiwitness.json` and `.uiwitness/report/index.html` as their canonical output paths.
- Persistence keeps its existing private modes, lock recovery, coherent rollback, and symbolic-link protections inside a fully separate `.uiwitness/` transaction tree.

### Security

- UIWitness can run beside an unreadable legacy evidence tree without opening or modifying it; coexistence coverage verifies legacy screenshot and report bytes remain unchanged.

## [0.25.0.0] - 2026-08-31

### Added

- Developers can use the canonical `uiwitness`, `uiwitness-core`, `uiwitness-report`, and `uiwitness-runner-playwright` package identities, with `uiwitness` as the sole CLI executable.
- Public TypeScript contracts now expose the `UIWitnessConfig`, `UIWitnessReport`, `UIWitnessError`, `UIWitnessErrorCode`, and `UIWitnessScenario` names.

### Changed

- Workspace consumers, CI filters, package metadata, and release inventory now resolve the UIWitness package graph at `0.25.0`.
- Packed-consumer verification now proves that all four UIWitness tarballs install, import, and run together from an isolated project.

### Removed

- The new public packages intentionally omit legacy package identities, branded type aliases, and the prior executable because Gate 0 found no compatibility promise requiring a bridge.

## [0.24.13.0] - 2026-08-30

### Changed

- GitHub Actions users can upload test evidence without the Node.js 20 deprecation warning because the release-smoke workflow and public setup guide now pin `actions/upload-artifact` v7.0.1 on Node.js 24.

## [0.24.12.0] - 2026-08-30

### Added

- The approved UIWitness rename design and engineering roadmap now record the US-only launch scope, canonical GitHub/npm destinations, deprecation-only migration policy, and reserved `0.25.0` cutover contract.
- An executable exact-file brand contract inventories every legacy-name occurrence, rejects unclassified paths and token-budget growth, and applies exact-line rules to both approved rename records.
- Positive and negative regression coverage proves branded-path detection, narrow record handling, broad-exemption rejection, private-evidence exclusion, and strict release behavior.

### Changed

- Root lint and pull-request CI now enforce the migration ratchet, while protected publication runs the strict contract that rejects migration-only entries.

### Security

- Brand validation reads only tracked text files, never opens private evidence roots, and reports the exact file, line, matched value, and violated rule for every failure.

## [0.24.11.0] - 2026-08-22

### Fixed

- The first post-publication consumer attempt now forces npm registry revalidation and uses a fresh temporary cache for every retry, preventing one cached missing-version response from poisoning the release gate.
- Registry propagation can now consume a bounded ten-minute window inside an independent 25-minute job while permanent install failures still stop immediately.
- Regression coverage proves cache isolation, forced online checks, elapsed-time bounds, timeout accounting, and the complete release workflow budget.

## [0.24.10.0] - 2026-08-22

### Fixed

- Fresh npm 11 consumers can now complete the registry-only launch gate whether `npm init -y` leaves CommonJS implicit or records `"type": "commonjs"` explicitly.
- The post-publish consumer gate now allows a bounded three-minute npm registry propagation window while still failing permanent install errors immediately.
- Regression coverage proves both valid CommonJS manifest shapes and verifies that fast and slow transient failures consume the same elapsed-time retry budget.

## [0.24.9.0] - 2026-08-22

### Added

- Maintainers and release automation can now prove the complete public URL adoption journey from an empty `npm init -y` project using only published npm registry packages: evidence-only `check`, overwrite-safe `check --write-config`, then untouched `scan`.
- The final launch guide explains installation, bounded same-origin discovery, local evidence, promotion, exit codes, privacy, authorization, and how Quick Check grows into product-state coverage.
- The release workflow now runs the registry-only journey in a dependent, read-only job after all four packages publish, requiring the exact eight-cell matrix, screenshots, schema-v1 JSON, kinetic offline HTML, generated imports, and byte-stable project source.

### Changed

- Registry propagation and transient install failures use bounded retries whose command, delay, browser, and CLI budgets fit inside the independent 15-minute release-job ceiling.
- The consumer gate derives Playwright's exact version from the runner package contract and provisions Linux browser dependencies only when release CI requests them.

### Security

- Registry smoke evidence must resolve inside the private temporary consumer and artifact boundaries, shell-free commands use explicit arguments, and cleanup removes the consumer even when fixture shutdown fails.

## [0.24.8.0] - 2026-08-22

### Added

- Quick Check users can now promote the exact discovered public surface into a permanent Statecraft project with `statecraft check <url> --write-config`.
- Promotion creates a module-unambiguous `statecraft.config.mts` plus one shared public-site scenario, preserving discovery order, runner-owned route identities, and the same mobile/desktop × light/dark policy used by Quick Check.
- CLI, package-boundary, type-contract, clean-project browser, concurrent-publication, late-collision, symbolic-link, and failure-policy regressions cover the complete `check --write-config` to `scan` adoption path.

### Changed

- `statecraft init` and public-site promotion now share one exclusive, config-last project-file publisher with deterministic conflict reporting and no destructive rollback.
- The fixed public-site matrix and diagnostic policy now come from one lightweight runner contract so Quick Check and promoted scans cannot drift.

### Security

- Generated executable project files never overwrite existing config or scenario paths, reject observed symbolic-link and non-directory boundaries, and publish only after the persisted evidence run completes.

## [0.24.7.0] - 2026-08-22

### Added

- Anyone can now run `statecraft check <url>` against an authorized public website to discover a bounded same-origin surface, capture the fixed mobile/desktop × light/dark evidence matrix, and persist schema-v1 JSON plus the kinetic offline report under `.statecraft/`.
- The command supports `--max-pages <1-20>` and `--headed`, prints page-grouped results and actionable issue totals, and ends with the exact `npx statecraft init` adoption step.
- CLI, package-boundary, and real-browser regressions cover argument validation, stable exit codes, sanitized unexpected failures, canonical output roots, query redaction, screenshot persistence, report rendering, and known-failure behavior.

### Changed

- Public CLI types now expose a small structural discovery contract instead of leaking Playwright runner implementation types to npm consumers.

### Security

- Public-site checks reject invalid URLs, credentials, unsafe page budgets, missing roots, and non-directory output roots before browser work, while unexpected internal browser errors remain on the generic sanitized CLI path.

## [0.24.6.0] - 2026-08-22

### Added

- Statecraft now has a researched brand system for kinetic evidence, including the signal-fracture failure language, editorial palette, typography, composition, motion, accessibility, and offline constraints.

### Changed

- Offline reports now open with an evidence-first verdict, ruled run tape, sticky filter rail, full-bleed screenshot field, and viewport-scale inspection room instead of dashboard-style card chrome.
- Light, dark, mobile, tablet, desktop, reduced-motion, and keyboard experiences share the same self-contained report with no network font, script, style, analytics, or server dependency.
- The protected release smoke verifies the kinetic report contract, and the checked-in launch images are regenerated from the real 60-cell Northline evidence bundle.

### Fixed

- Modal inspection now contains Tab and Shift+Tab focus, restores focus to the originating evidence cell, and keeps every utility label at or above the 12-pixel readability floor.

## [0.24.5.0] - 2026-08-22

### Added

- The Playwright runner now exposes `runPublicSiteChecks`, expanding every discovered public route across a fixed mobile/desktop × light/dark matrix with deterministic, collision-resistant cell and artifact identities.
- Public-site checks capture a screenshot for every stable outcome, retain sanitized console, page, and request diagnostics, assert HTTP health and horizontal overflow, and persist schema-v1 JSON plus a self-contained offline HTML report under `.statecraft/`.
- Browser-backed regressions cover the complete 16-cell evidence flow, exact response and overflow boundaries, diagnostic redaction, package/type exports, and navigation replacement attacks during custom assertions.

### Changed

- Programmatic runner callers can supply a validated in-memory scenario without weakening path-based scenario loading for configuration-driven scans.
- Assertion hooks receive navigation metadata, allowing public-site policies to evaluate the final response without duplicating browser navigation.

### Security

- A main-frame document-navigation guard spans readiness, screenshot capture, and assertions; any replacement navigation fails the cell as `NAVIGATION_FAILED`, discards the potentially untrusted screenshot, and records only sanitized diagnostics.

## [0.24.4.0] - 2026-08-22

### Added

- The Playwright runner now exposes a typed `discoverPublicRoutes` API for deterministic, first-seen breadth-first discovery of a bounded public website surface.
- Browser-backed regressions cover option validation, query and fragment removal, context isolation, redirect canonicalization, failed and non-HTML pages, anchor and navigation budgets, sanitized initial failures, and package/type boundaries.
- ADR 0029 and the runner API reference document the navigation-only authorization model and the honest external-redirect boundary.

### Changed

- Deterministic readiness primitives are shared by configured navigation and public-route discovery without expanding the public API.

### Security

- Discovery uses a fresh browser context per page, rejects credential-bearing or unsupported starting URLs before launch, keeps same-origin double-slash paths on the canonical origin, expands only exact `text/html` or `application/xhtml+xml` documents, traverses at most 1,000 rendered anchors incrementally, ignores candidate URLs longer than 8,192 characters, and never extracts or follows links from cross-origin redirect destinations.

## [0.24.3.0] - 2026-08-22

### Added

- Statecraft now has an approved, review-cleared design for a zero-config `statecraft check <url>` workflow that turns a bounded public-site scan into actionable local evidence and an optional permanent project setup.
- The approved design defines the first runner slice's typed discovery contract, covering deterministic breadth-first traversal, isolated browser contexts, hard navigation and anchor budgets, canonical-origin redirects, sanitized failures, and loopback-only regression tests.

## [0.24.2.0] - 2026-08-21

### Changed

- `statecraft init` now creates `statecraft.config.mts` and `.mts` scenario modules so the starter project has unambiguous ESM semantics even after a plain `npm init -y`.
- CLI, architecture, testing, release, and package documentation now use the module-unambiguous starter filenames while existing `.ts`, `.mts`, `.cts`, `.js`, `.mjs`, and `.cjs` config discovery remains supported.

### Fixed

- The packed-package smoke gate now initializes a real CommonJS-default npm consumer, installs only packed release artifacts, runs the generated four-cell scan against a loopback fixture, and validates contained, non-symlinked screenshot evidence plus schema-v1 JSON and offline HTML.
- Release-smoke scan timeouts now own the Statecraft CLI process directly instead of an intermediate npm process, ensuring timeout cleanup reaches the browser-backed scan.

## [0.24.1.0] - 2026-08-21

### Added

- The public README now leads with Statecraft's install-to-report workflow, real Northline coverage evidence, package links, CI guidance, privacy guarantees, and a comparison with screenshot-regression tools.
- Reproducible launch-asset tooling captures the offline report overview and a real failed-cell detail view from the complete 60-cell example matrix, with selector validation covered by focused tests.

### Changed

- Phase 7 is complete, and contributor, release, implementation, and launch-strategy guidance now reflect the shipped npm packages and the final public-repository workflow.

### Security

- Launch-asset capture blocks HTTP and HTTPS requests while opening the local report, and release documentation records the exact trusted-publisher binding, revoked bootstrap token, removed GitHub secret, and strict npm 2FA policy.

### Fixed

- Launch-asset tooling loads Playwright only when a real capture starts, preserving the dependency-free repository checks used by the Documentation CI job.

## [0.24.0.0] - 2026-08-21

### Added

- Statecraft now has publish-ready npm metadata, package-specific documentation, and MIT license files for `statecraft-ui`, `statecraft-ui-core`, `statecraft-ui-report`, and `statecraft-ui-runner-playwright`; the CLI package continues to expose the `statecraft` executable.
- Release contracts synchronize npm's three-component versions from the repository `VERSION`, reject collision-prone nonzero micro versions, validate exact release tags, and test the packed artifacts through dry-run publication, isolated installation, public API imports, the installed command shim, and overwrite-safe initialization.
- A protected, repository-serialized GitHub Release workflow verifies the complete repository and 60-cell consumer gates, packs artifacts once, and publishes directly to `latest` in dependency order with the CLI last, provenance enabled, and integrity/dist-tag retry protection.
- Maintainers have a release guide covering the protected `npm-publish` Environment, one-time package-name bootstrap, npm trusted publishing, token revocation, and normal release verification.

### Changed

- Private workspace identities moved from the uncontrolled `@statecraft/*` scope to the unscoped public package names, with source imports, examples, API documentation, package-boundary tests, and CI filters migrated together.
- Phase 7 now includes publish-ready package metadata and release automation; launch assets and final contributor/release polish remain the focused follow-up.

### Security

- npm publication rejects prereleases and older-than-latest versions, binds the GitHub release event SHA to both the checked-out commit and named tag on `main`, limits OIDC to the publish job, and uses an approval-gated Environment for the short-lived first-publication credential.
- Exact tarball allowlists exclude compiler caches, require matching license text, reject unexpected or symbolic-link package inputs, and stop rather than overwrite when an existing npm version has different bytes.

### Fixed

- The release workflow now resolves its temporary package directory only after GitHub assigns a runner, preventing workflow validation from rejecting the first `v0.24.0` publication before any checks can start.
- Release artifact validation now accepts npm publish summaries that omit the redundant `id` field while still requiring an exact package name and version and rejecting conflicting identities.
- Release artifact validation now supports npm's package-name-keyed publish summary format without accepting extra wrapper keys or weakening the inner package identity checks.

## [0.23.0.0] - 2026-08-21

### Added

- Maintainers can prove a fresh checkout builds and runs the public Statecraft CLI against the complete 60-cell example matrix before a release, including the four intentional failures, every screenshot, schema-v1 JSON, and offline HTML.
- GitHub Actions users get a pre-publication workflow guide for installing the pinned CLI and Playwright browser, running scans without implicit downloads, and retaining the complete hidden `.statecraft/` evidence bundle.

### Changed

- The repository CI now runs the release smoke in its own clean-checkout job and retains its full report bundle for seven days when the gate succeeds or fails.
- Phase 7 is active with release readiness isolated from the deferred package-publication metadata and launch-asset slices.

### Security

- Release evidence uses unique owned temporary directories, bounded child-process shutdown, canonical report parsing, and explicit guidance that public-repository artifacts must be treated as public data.

## [0.22.0.0] - 2026-08-20

### Added

- Developers can run the polished Northline example through a checked-in Statecraft config that expands 15 meaningful route/state combinations across mobile and desktop viewports plus light and dark themes for 60 deterministic cells.
- Route-level scenarios render every dashboard, orders, and customer state, distinguish 401 from 403 access failures, and assert the approved contrast and narrow-viewport defect boundaries without an expected-failure mode.
- A production-browser gate runs the public CLI, requires exactly 56 passes and four known assertion failures, and verifies schema-v1 JSON, self-contained HTML, coverage metrics, and non-empty screenshots for all 60 cells.

### Changed

- The example scan is documented as a two-terminal workflow, keeps generated `.statecraft/` evidence local, and completes Phase 6 with ADR 0025 and synchronized project guidance.
- Vitest keeps the normal workspace suite parallel, then runs the resource-heavy scenario matrix in an isolated project so browser tests retain their default timeout without competing for Chromium resources.

### Fixed

- Fresh clones now build the CLI workspace package and its dependencies before the example typecheck or scan, so missing generated types and pre-build executable links cannot break the documented workflow.

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

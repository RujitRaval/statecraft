# Changelog

All notable changes to Statecraft will be documented in this file.

This project uses the four-part version format required by the GStack ship workflow.

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

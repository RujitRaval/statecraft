# Codex Phase Checklist

## Phase 1
- [x] Workspace and packages created
- [x] Strict TypeScript configured
- [x] Build/test/lint commands work
- [x] License/README present
- [x] CI skeleton present
- [x] Clean install verified

## Phase 2
- [x] Public config types
- [x] Runtime config validation
- [x] `defineConfig`
- [x] Matrix expansion
- [x] Coverage calculations
- [x] Result/report contracts with schema version
- [x] Deterministic artifact paths
- [x] Stable error model
- [x] Unit tests cover edge cases
- [x] Public API documented

## Phase 3
- [x] Playwright runner package and pinned browser dependency
- [x] One browser reused across a programmatic cell run
- [x] Fresh context and page per matrix cell
- [x] Configured viewport applied at context creation
- [x] Per-cell failures settle without aborting later cells
- [x] Real Chromium lifecycle fixture
- [x] Scenario module loading and hooks
- [x] Navigation, theme, and deterministic readiness
- [x] Screenshots, sanitized diagnostics, assertions, and failure policies
- [x] Execution-result construction and artifact persistence
- [x] Programmatic runner passes the complete Phase 3 fixture gate

## Phase 4
- [x] CLI package foundation and public package boundary
- [x] Deterministic config discovery and trusted local module loading
- [x] Command parser and dispatch
- [x] `init` starter generation and overwrite protection
- [x] `scan` orchestration, filters, and headed mode
- [x] Terminal summary and exit codes 0/1/2
- [x] `open` latest-report behavior
- [x] Scan publishes offline HTML consumable by `open`

Phase 4 through Phase 6 are complete.

## Phase 5
- [x] Report package and validated transformation boundary
- [x] Offline HTML packaging with summary, matrix, thumbnails, and details
- [x] Scan-to-HTML integration
- [x] Route/state/viewport/theme/status filters
- [x] Final responsive, keyboard, and launch-visual polish

## Phase 6
- [x] Example application design system and Next.js foundation
- [x] Deterministic dashboard data contract and API
- [x] `/dashboard` success, loading, empty, and error states
- [x] `/orders` meaningful states
- [x] `/customers/[id]` meaningful states and long-content coverage
- [x] Intentional responsive/theme defects
- [x] Complete 60-cell Statecraft scenario matrix and known-failure report gate

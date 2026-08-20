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

Stop after Phase 3 and report findings before proceeding.

# Implementation Plan

## Phase 1 - Foundation
pnpm workspace, strict TypeScript, packages, build/test/lint, MIT license, initial README, CI skeleton.
**Gate:** clean install and root build/tests pass.

## Phase 2 - Core contracts
Config types/schema, `defineConfig`, validation, matrix planner, deterministic paths, result/report contracts, coverage math, errors.
**Gate:** comprehensive unit tests and stable contracts.

## Phase 3 - Playwright runner
Browser reuse + isolated contexts, scenarios/hooks, viewport/theme, readiness, screenshots, diagnostics, assertions, resilient per-cell execution.
**Gate:** programmatic runner works against a minimal fixture.
**Status:** complete.

## Phase 4 - CLI
`init`, `scan`, `open`, config discovery, `--config`, `--route`, `--headed`, terminal summary, exit codes 0/1/2.
**Gate:** fresh example goes init -> scan -> report.
**Status:** complete; config discovery/loading, overwrite-safe `init`, scan orchestration, summaries, stable exit codes, safe latest-report `open`, and the Phase 5 scan-to-HTML handoff are implemented.

## Phase 5 - Report
Offline HTML, summary, matrix, thumbnails, detail view, filters, responsive/keyboard UX.
**Gate:** no network/server dependency and launch-quality visual output.
**Status:** complete; validated transformation, responsive offline HTML, summary/matrix/evidence, route/state/viewport/theme/status filters, URL-restorable selections, accessible single-execution details, private atomic publication, and CLI scan integration are implemented.

## Phase 6 - Example
Polished Next.js dashboard with `/dashboard`, `/orders`, `/customers/[id]`; meaningful states and intentional defects.
**Gate:** report screenshot makes Statecraft's value obvious.
**Status:** complete; the design system, Next.js foundation, deterministic dashboard, orders and customer contracts, meaningful state surfaces, focused responsive/theme defects, complete 60-cell scan matrix, and four-cell known-failure report gate are implemented.

## Phase 7 - Release
README, CI usage, contributor docs, GIF/screenshots, package metadata, smoke tests.
**Gate:** another developer can use it from docs alone.
**Status:** active; clean-checkout production build and built-CLI consumer smoke coverage, exact known-failure validation, short-lived report artifacts, and documented GitHub Actions usage are implemented. Package-publication metadata, launch assets, and remaining release polish stay in focused follow-ups.

## Rules
Keep main buildable; no speculative abstractions/backend/telemetry/LLM; tests accompany capabilities; record important decisions as ADRs; justify major dependencies.

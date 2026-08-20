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
**Status:** underway; the CLI package foundation and deterministic config discovery/loading are complete. Command parsing, command behavior, runner orchestration, and terminal UX remain focused follow-up slices.

## Phase 5 - Report
Offline HTML, summary, matrix, thumbnails, detail view, filters, responsive/keyboard UX.
**Gate:** no network/server dependency and launch-quality visual output.

## Phase 6 - Example
Polished Next.js dashboard with `/dashboard`, `/orders`, `/customers/[id]`; meaningful states and intentional defects.
**Gate:** report screenshot makes Statecraft's value obvious.

## Phase 7 - Release
README, CI usage, contributor docs, GIF/screenshots, package metadata, smoke tests.
**Gate:** another developer can use it from docs alone.

## Rules
Keep main buildable; no speculative abstractions/backend/telemetry/LLM; tests accompany capabilities; record important decisions as ADRs; justify major dependencies.

# ADR 0010: Runner execution lifecycle

## Status

Accepted

## Context

Phase 3 needs a browser lifecycle that is efficient across a configured matrix without allowing cookies, storage, pages, or failures from one cell to affect another. Later scenario, navigation, screenshot, diagnostic, and assertion steps need direct Playwright access without forcing those concerns into the browser-independent core package.

## Decision

- Add the private `@statecraft/runner-playwright` package with exact Playwright `1.62.1` and a dependency on `@statecraft/core` matrix contracts.
- Launch one Chromium browser for each non-empty `runExecutionCells` call and reuse it while context cleanup remains healthy. Process cells sequentially in configured order.
- Create one new `BrowserContext` and `Page` per cell, applying the cell's configured viewport when the context is created.
- Pass the matrix cell, context, and page directly to the caller's async callback. Do not wrap Playwright primitives in a Statecraft-specific browser DSL.
- Close every created context before starting the next cell. Return a rejected cell outcome for context setup, callback, or context cleanup failures and continue executing later cells.
- If context cleanup fails and cells remain, close the compromised browser and launch a replacement before continuing. Treat initial or replacement browser launch and browser cleanup failures as run-level failures. Return an immutable empty outcome array without launching a browser when no cells are selected.
- Keep scenario loading, hooks, navigation, themes, readiness, screenshots, diagnostics, assertions, result construction, and artifact persistence outside this first lifecycle slice.

## Consequences

Browser startup cost is shared across the healthy portion of a matrix while per-cell cookies, storage, pages, and viewport state remain isolated. A rare cleanup failure pays the cost of replacing Chromium rather than allowing uncertain browser state into the next cell. Settled outcomes provide the resilience needed for a complete scan without prematurely defining final execution-result policy. Sequential execution is deterministic and keeps the first implementation small; concurrency can be evaluated later only if real performance data justifies the added lifecycle and artifact-order complexity.

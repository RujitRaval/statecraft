# `@statecraft/runner-playwright` API

Phase 3 owns browser-specific execution while `@statecraft/core` remains independent of Playwright. The runner package is private until the CLI and the rest of the Phase 3 lifecycle validate its integration boundary.

## Install the pinned browser

After installing workspace dependencies, install the Chromium build paired with the pinned Playwright version:

```bash
corepack pnpm --filter @statecraft/runner-playwright exec playwright install chromium
```

CI uses the same command with `--with-deps` on Ubuntu.

## Programmatic lifecycle

`runExecutionCells(cells, execute, options?)` accepts matrix cells from `expandMatrix` and invokes the callback once for every cell in configured order.

```ts
import { expandMatrix, parseConfig } from "@statecraft/core";
import { runExecutionCells } from "@statecraft/runner-playwright";

const config = parseConfig(unknownConfig);
const cells = expandMatrix(config);

const outcomes = await runExecutionCells(cells, async ({ cell, context, page }) => {
  // Phase 3 follow-up steps will load scenarios and navigate here.
  return { routeId: cell.route.id, pageCount: context.pages().length, url: page.url() };
});
```

One headless Chromium browser is launched for a non-empty call and reused while context cleanup remains healthy. Each callback receives a fresh Playwright `BrowserContext` and `Page`; the context viewport comes from the matrix cell. The context is closed before the next cell begins, including when the callback rejects. If context cleanup fails, that cell is rejected and the compromised browser is closed and replaced before the next cell starts.

The returned immutable array preserves cell order. Each `CellExecutionOutcome<Value>` is either:

- `{ cell, status: "fulfilled", value }` when the callback and context cleanup succeed.
- `{ cell, status: "rejected", reason }` when context creation, the callback, or cleanup fails.

A rejected cell does not abort later cells. Initial or replacement browser launch and browser cleanup failures reject the run because no remaining cell can execute safely. An empty cell list returns an empty immutable array without launching Chromium.

`RunExecutionCellsOptions.launchOptions` exposes Playwright's launch settings directly. This keeps the API small and supports headed orchestration later without wrapping Playwright.

## Current boundary

This development step owns browser reuse, per-cell context/page isolation, configured viewports, cleanup, and settled outcomes. Scenario module loading and hooks, navigation, themes, readiness, screenshots, diagnostics, assertions, execution-result construction, and artifact persistence remain later Phase 3 steps. CLI and report UI work remain out of scope.

## Dependency decision

Playwright `1.62.1` is an exact runtime dependency because the runner exposes its `Page`, `BrowserContext`, and `LaunchOptions` types and must stay paired with its browser protocol and Chromium build. No browser dependency enters `@statecraft/core`.

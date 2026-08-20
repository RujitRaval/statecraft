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

## Typed scenarios and hooks

`runScenarioCells(cells, execute, options?)` layers typed local scenario loading onto the isolated cell lifecycle. Each state's `setup` path is resolved relative to `options.scenarioBaseDirectory`; programmatic callers that omit it use `process.cwd()`.

```ts
import { expandMatrix, parseConfig } from "@statecraft/core";
import { runScenarioCells } from "@statecraft/runner-playwright";

const cells = expandMatrix(parseConfig(unknownConfig));
const outcomes = await runScenarioCells(
  cells,
  async ({ page, route, state, viewport, theme }) => {
    // The next Phase 3 slice will provide built-in navigation here.
    await page.goto(new URL(route.path, "http://127.0.0.1:3000").href);
    return { stateId: state.id, theme, width: viewport.width };
  },
  { scenarioBaseDirectory: process.cwd() },
);
```

A scenario is trusted local ESM code with an object default export:

```ts
import type { StatecraftScenario } from "@statecraft/runner-playwright";

const scenario: StatecraftScenario = {
  async beforeNavigate({ page }) {
    await page.route("**/api/dashboard", async (route) => {
      await route.fulfill({ json: { projects: [] } });
    });
  },
  async afterNavigate({ page }) {
    await page.getByRole("main").waitFor();
  },
};

export default scenario;
```

The runner runtime-checks the default export and the optional `beforeNavigate`, `afterNavigate`, and reserved `assert` fields. For each cell it runs `beforeNavigate`, the caller's middle step, and `afterNavigate` in order with one frozen `ScenarioContext`. A module-load, validation, or hook failure rejects only that cell; cleanup still runs and later cells continue. `ScenarioLoadError` distinguishes `module-load-failed` from `invalid-module` failures.

`loadScenario(path, options?)` and `runScenarioLifecycle(scenario, context, execute)` expose the two smaller primitives for orchestration and focused testing. Dynamic imports follow normal Node ESM caching semantics. Scenario/config modules are trusted local code with the user's privileges and are not sandboxed.

## Current boundary

The runner now owns browser reuse, per-cell context/page isolation, configured viewports, cleanup, settled outcomes, typed scenario loading, and ordered pre/post-navigation hooks. Built-in navigation, theme application, readiness, screenshots, diagnostics, assertion execution, result construction, and artifact persistence remain later Phase 3 steps. CLI and report UI work remain out of scope.

## Dependency decision

Playwright `1.62.1` is an exact runtime dependency because the runner exposes its `Page`, `BrowserContext`, and `LaunchOptions` types and must stay paired with its browser protocol and Chromium build. No browser dependency enters `@statecraft/core`.

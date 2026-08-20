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
    // Low-level callers may continue to own the middle lifecycle step.
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

## Built-in navigation, themes, and readiness

`runNavigatedScenarioCells(cells, execute, options)` owns the normal Phase 3 path through theme setup, hooks, navigation, and deterministic readiness. Its callback runs after readiness, which gives the following screenshot/diagnostics slice a stable capture seam without changing lifecycle order.

```ts
import { expandMatrix, parseConfig } from "@statecraft/core";
import { runNavigatedScenarioCells } from "@statecraft/runner-playwright";

const config = parseConfig(unknownConfig);
const outcomes = await runNavigatedScenarioCells(
  expandMatrix(config),
  async ({ navigation, page, state, theme }) => ({
    stateId: state.id,
    status: navigation.status,
    theme,
    title: await page.title(),
    url: navigation.url,
  }),
  {
    baseURL: config.baseURL,
    readiness: { selector: "main[data-ready]", timeoutMs: 10_000 },
    scenarioBaseDirectory: process.cwd(),
  },
);
```

The order for every cell is:

1. Validate that the configured route stays on the base URL's origin and load its scenario.
2. Apply the theme before application scripts: every theme becomes `data-theme` on `<html>`; `light` and `dark` also set the matching `prefers-color-scheme`; all themes request `prefers-reduced-motion: reduce`.
3. Run `beforeNavigate`, then navigate with `waitUntil: "domcontentloaded"`.
4. Run `afterNavigate`, which remains the scenario-controlled readiness escape hatch.
5. Suppress CSS animations, transitions, smooth scrolling, and carets; wait for the normal load event, an optional visible selector, and `document.fonts` to finish loading. Reject main-frame document navigation that starts during these gates.
6. Recheck the origin, then invoke the post-readiness callback with a frozen `NavigatedScenarioContext` and frozen `NavigationMetadata` containing the requested URL, final same-origin page URL, and the built-in navigation's HTTP response status when available.

The origin boundary is checked after built-in navigation, after `afterNavigate`, and after readiness; cross-origin redirects and hook-driven navigation reject the cell before caller-owned work. Same-origin hook navigation that completes in `afterNavigate` remains supported: `navigation.url` reports the final page while `navigation.status` reports the response to `navigation.requestedUrl`. Once deterministic readiness starts, any new main-frame document navigation is rejected because the replacement document has not passed the readiness gates. The runner never waits for `networkidle`, so persistent connections cannot stall a cell. Navigation defaults to 30 seconds; readiness defaults to 10 seconds. Both accept positive safe-integer overrides. Invalid run-level options reject before Chromium starts. Scenario, hook, route, navigation, readiness, and post-readiness callback failures reject only their cell; context cleanup still runs and later cells continue.

Arbitrary theme IDs are intentionally supported through `data-theme`; only the conventional `light` and `dark` IDs affect color-scheme media queries. Apps with different theme mechanisms can use direct Playwright access in `beforeNavigate`.

## Current boundary

The runner now owns browser reuse, per-cell context/page isolation, configured viewports, cleanup, settled outcomes, typed scenario loading, ordered hooks, same-origin navigation, theme application, and deterministic readiness. Screenshots, diagnostics, assertion execution, result construction, and artifact persistence remain later Phase 3 steps. CLI and report UI work remain out of scope.

## Dependency decision

Playwright `1.62.1` is an exact runtime dependency because the runner exposes its `Page`, `BrowserContext`, and `LaunchOptions` types and must stay paired with its browser protocol and Chromium build. No browser dependency enters `@statecraft/core`.

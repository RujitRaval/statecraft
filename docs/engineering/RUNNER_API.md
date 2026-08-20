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

## In-memory screenshots, diagnostics, and assertions

`runCapturedScenarioCells(cells, options)` owns the complete capture lifecycle through assertion and diagnostic failure policy. It returns settled cell outcomes and deliberately has no output-directory or artifact-path option.

```ts
import { expandMatrix, parseConfig } from "@statecraft/core";
import {
  runCapturedScenarioCells,
  ScenarioCaptureError,
} from "@statecraft/runner-playwright";

const config = parseConfig(unknownConfig);
const outcomes = await runCapturedScenarioCells(expandMatrix(config), {
  baseURL: config.baseURL,
  failOn: config.failOn,
  readiness: { selector: "main[data-ready]" },
  scenarioBaseDirectory: process.cwd(),
});

for (const outcome of outcomes) {
  if (outcome.status === "fulfilled") {
    const { screenshot, diagnostics, assertionStatus, durationMs } = outcome.value;
    // Persisting screenshot bytes and constructing ExecutionResult come next.
    void screenshot;
    void diagnostics;
    void assertionStatus;
    void durationMs;
  } else if (outcome.reason instanceof ScenarioCaptureError) {
    // Partial evidence retains diagnostics and any screenshot captured before failure.
    console.error(outcome.reason.failures, outcome.reason.evidence);
  }
}
```

For every cell, duration starts before browser-context creation and diagnostic listeners attach before route validation, scenario loading, theme setup, and hooks. After navigation and deterministic readiness, the runner captures a viewport-sized PNG into an owned `Uint8Array`, runs the optional scenario `assert` hook, evaluates diagnostic failure policy, detaches its listeners, and closes the isolated context. Screenshots therefore represent the ready product state before assertion code can mutate it. An absent assertion produces `assertionStatus: "not-configured"`; a successful one produces `"passed"`.

Diagnostics use the browser-independent core shape:

- `consoleErrors`: sanitized text from Playwright console messages whose type is `error`.
- `pageErrors`: sanitized messages from uncaught page exceptions.
- `failedRequests`: HTTP(S) URL, method, and sanitized Playwright failure text only.
- `navigationStatus`: the built-in navigation response status when available.

The runner never reads diagnostic request/response headers, cookies, bodies, or console argument handles. It removes URL credentials and fragments, preserves query keys while replacing values with `[REDACTED]`, redacts authorization, cookie, bearer, and named-secret forms in free-form messages, pre-bounds and caps each diagnostic string at 2,000 characters, and bounds sanitized URLs. Each category retains its first 100 entries; `droppedDiagnostics` reports how many later entries were omitted. This is defense in depth, not a guarantee against novel secrets embedded by application code; captures remain sensitive local data. `ScenarioCaptureError.cause` is a new sanitized error rather than the original throwable so logging the structured error cannot bypass this boundary.

`failOn` uses the core `FailurePolicy`. Defaults are `{ consoleError: false, failedRequest: false, pageError: true }`. Enabled categories generate `CONSOLE_ERROR`, `FAILED_REQUEST`, or `PAGE_ERROR` failures. Screenshot and assertion failures are always fatal and generate `SCREENSHOT_FAILED` and `ASSERTION_FAILED`. Multiple failures are retained in deterministic assertion/console/page/request order. `ScenarioCaptureError` exposes those stable failures plus `ScenarioCaptureEvidence`, whose screenshot and navigation fields are nullable when the lifecycle failed before they became available. Route and browser lifecycle failures use `NAVIGATION_FAILED`; scenario module loading/validation uses `INTERNAL_ERROR`. Once the built-in navigation receives a response, `navigationStatus` survives later failures. Same-origin responses also retain partial navigation metadata; a cross-origin redirect retains status only and exposes no external URL through evidence. As with every runner stage, a failed cell does not abort later cells.

## Result translation and local persistence

`runPersistedScenarioCells(cells, options)` is the complete programmatic Phase 3 entry point. It runs capture, translates every settled outcome into the core `ExecutionResult` contract, calculates configured-state coverage, validates a schema-v1 `StatecraftReport`, writes deterministic screenshots, and serializes `.statecraft/report/statecraft.json`.

```ts
import { expandMatrix, parseConfig } from "@statecraft/core";
import { runPersistedScenarioCells } from "@statecraft/runner-playwright";

const config = parseConfig(unknownConfig);
const run = await runPersistedScenarioCells(expandMatrix(config), {
  baseURL: config.baseURL,
  failOn: config.failOn,
  projectDirectory: process.cwd(),
  readiness: { selector: "main[data-ready]" },
  scenarioBaseDirectory: process.cwd(),
});

run.reportPath;
// .statecraft/report/statecraft.json
run.report.summary.coverage.execution;
```

The project directory must already exist and defaults to `process.cwd()`. Cells must come from the validated core configuration/matrix boundary; malformed hand-built cells reject the run before Chromium launches. `generatedAt` optionally accepts a valid `Date` for deterministic callers and tests; normal runs record completion time. The returned `PersistedScenarioRun` contains the validated report and the fixed project-relative JSON path. It does not retain screenshot bytes after publication.

Each successful capture becomes a passed execution with its deterministic `screenshotArtifactPath(cell)`. A rejected `ScenarioCaptureError` becomes a failed execution with the same stable failures, diagnostics, duration, safe URL metadata, and a screenshot path when capture completed before the later failure. Unexpected context or cleanup failures become sanitized `INTERNAL_ERROR` results without screenshots. Result parsing redacts route, execution, failed-request, and project URL credentials, fragments, and query values before anything reaches disk.

Publication uses a private staging directory and local run lock inside `.statecraft/`. The lock keeps an immutable process owner plus append-only publishing/recovery markers and is acquired before Chromium launches, so two programmatic runs cannot interleave capture and publication for one project. An abandoned capture-phase lock and its uncommitted staging are recovered when its owner is no longer alive; a small durable claim keyed to that abandoned owner prevents delayed recovery contenders from moving a newer live lock. The publishing marker is created only immediately before the first destructive rename, and publishing or recovery state is preserved for inspection. Once every screenshot and the validated JSON payload are ready, the runner hides the prior JSON, replaces the complete `.statecraft/artifacts/` tree so filtered or removed cells cannot leave stale screenshots, then publishes the new `statecraft.json` last. Existing `.statecraft/report/index.html` or other future report UI files are preserved. Artifact and JSON symbolic links are rejected, and new or existing runner directories/files use owner-only modes where supported. A failed publication restores artifacts before making the previous JSON visible; if recovery itself fails, the runner preserves staging data and the owned lock for manual recovery instead of deleting the last good copies. Filesystem validation, locking, and publication errors reject the run instead of fabricating per-cell browser failures.

This API writes data only. It does not discover configuration, render HTML, print terminal output, choose exit codes, or open a report.

## Current boundary

Phase 3 is complete. The runner owns browser reuse, per-cell isolation, scenarios/hooks, viewport/theme, navigation/readiness, screenshot capture, sanitized diagnostics, assertions, failure policies, core result translation, deterministic artifact persistence, and versioned JSON report data. CLI and report UI work remain out of scope until the user explicitly advances the phase.

## Dependency decision

Playwright `1.62.1` is an exact runtime dependency because the runner exposes its `Page`, `BrowserContext`, and `LaunchOptions` types and must stay paired with its browser protocol and Chromium build. No browser dependency enters `@statecraft/core`.

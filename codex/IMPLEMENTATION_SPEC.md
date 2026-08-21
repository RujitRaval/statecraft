# Statecraft --- Codex Implementation Specification

**Project:** Statecraft\
**Type:** Open-source developer tool\
**Initial stack:** TypeScript, Node.js 22+, Playwright, React/Next.js\
**License:** MIT\
**Objective:** Build a polished open-source tool that defines **UI
product-state coverage**.

## 1. Product definition

Statecraft answers: **What happens to every important screen when data
is loading, empty, broken, offline, unauthorized, unusually long, or
otherwise outside the happy path?**

Visual regression asks whether pixels changed. Statecraft asks whether
important product states exist, render correctly, and survive different
viewports, themes, and data conditions.

The core product is a local CLI that executes explicitly configured UI
scenarios with Playwright, captures screenshots and diagnostics,
calculates coverage, and generates a polished self-contained HTML
report. The report is a first-class feature and must be visually strong
enough to serve as the primary README/launch asset.

Statecraft must work without an LLM, API key, account, cloud service, or
telemetry. AI integrations may come later but cannot be required by the
core.

## 2. Principles

1.  **Local-first:** screenshots and app data stay local.
2.  **Deterministic:** core execution cannot depend on an LLM.
3.  **Visual-first:** the report is part of the product, not debug
    output.
4.  **Progressive adoption:** one route and three states should already
    be useful.
5.  **Explicit before magical:** users define scenarios in v0.1;
    automatic discovery comes later.
6.  **Small public API:** expose Playwright primitives instead of
    inventing a large DSL.
7.  **Extensible:** future Storybook/MSW/framework adapters should not
    require rewriting the engine.
8.  **Excellent defaults:** minimize configuration and ceremony.

## 3. MVP --- v0.1.0

Required: TypeScript monorepo; Node CLI; `statecraft init`, `scan`, and
`open`; type-safe config; Playwright execution; React/Next.js example
app; routes; named states; multiple viewports; light/dark themes;
isolated browser contexts; screenshots; console/page/network
diagnostics; duration/status metadata; optional assertions; coverage
calculations; offline HTML report; versioned JSON report; stable exit
codes; GitHub Actions example; tests; excellent README.

Explicitly out of scope: SaaS, accounts, billing, cloud storage, AI
analysis, automatic route crawling, automatic state inference,
pixel-diff regression, approval workflows, Vue/Svelte/Angular,
browser/VS Code extensions, and full Storybook/MSW adapters.

Do not expand scope until the core workflow is excellent.

## 4. Developer experience

``` bash
npm install -D statecraft-ui
npx statecraft init
```

Generated structure:

``` text
statecraft.config.ts
statecraft/
  scenarios/
```

Example config:

``` ts
import { defineConfig } from "statecraft-ui";

export default defineConfig({
  baseURL: "http://localhost:3000",
  viewports: {
    mobile: { width: 390, height: 844 },
    desktop: { width: 1440, height: 1000 },
  },
  themes: ["light", "dark"],
  routes: [{
    id: "dashboard",
    path: "/dashboard",
    states: [
      { id: "success", setup: "./statecraft/scenarios/dashboard/success.ts" },
      { id: "loading", setup: "./statecraft/scenarios/dashboard/loading.ts" },
      { id: "empty", setup: "./statecraft/scenarios/dashboard/empty.ts" },
      { id: "error", setup: "./statecraft/scenarios/dashboard/error.ts" },
    ],
  }],
});
```

Example scenario:

``` ts
import type { StatecraftScenario } from "statecraft-ui-runner-playwright";

const scenario: StatecraftScenario = {
  async beforeNavigate({ page }) {
    await page.route("**/api/dashboard", async route => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ projects: [] }),
      });
    });
  },
};
export default scenario;
```

Run:

``` bash
npx statecraft scan
```

Desired terminal UX:

``` text
Statecraft

Dashboard
  ✓ success · desktop · light
  ✓ success · mobile · light
  ✓ empty · desktop · light
  ✗ error · desktop · light
      ASSERTION_FAILED: Expected error heading.

Coverage: 87.5%
Report: .statecraft/report/index.html
1 of 4 executions failed.
```

Then `npx statecraft open`.

## 5. Coverage semantics

Every configured `route × state × viewport × theme` combination creates
one execution cell. Example: `3 × 4 × 2 × 2 = 48` executions.

-   **Execution coverage:** passed executions / configured executions.
-   **State coverage:** route/state combinations with at least one
    successful render.
-   **Responsive coverage:** route/state combinations passing every
    configured viewport.
-   **Theme coverage:** route/state combinations passing every
    configured theme.

v0.1 must NOT claim that an unconfigured state is missing. Statecraft
only knows configured states. A future policy engine can recommend
expected states.

Recommended vocabulary while permitting arbitrary IDs: `success`,
`loading`, `empty`, `error`, `offline`, `unauthorized`, `forbidden`,
`not-found`, `partial`, `stale`, `long-content`, `large-data`,
`slow-network`. Domain states such as `payment-declined` must work
naturally.

## 6. Scenario API

Keep the public API small:

``` ts
export interface StatecraftScenario {
  beforeNavigate?(ctx: ScenarioContext): Promise<void>;
  afterNavigate?(ctx: ScenarioContext): Promise<void>;
  assert?(ctx: ScenarioContext): Promise<void>;
}

export interface ScenarioContext {
  page: Page;
  context: BrowserContext;
  route: RouteDefinition;
  state: StateDefinition;
  viewport: ViewportDefinition;
  theme: string;
}
```

Users retain direct Playwright access.

## 7. Execution lifecycle

For every cell: reuse browser where safe; create isolated context; set
viewport/theme; load scenario; run `beforeNavigate`; navigate; run
`afterNavigate`; apply deterministic readiness; wait for fonts and
reduce animations where practical; capture screenshot and diagnostics;
run assertion; persist result; close context; continue.

Avoid state leakage. Support selector-based and scenario-controlled
readiness. Do not blindly depend on `networkidle` because apps may keep
persistent connections. Fixed delays may exist only as a documented last
resort.

## 8. Diagnostics and status

Capture console errors, page errors, failed requests,
response/navigation status when available, and duration.

Default: fatal navigation error, uncaught page exception, assertion
failure, or screenshot failure causes failure. Console errors and failed
subrequests are recorded but need not fail by default.

Support policy configuration such as:

``` ts
failOn: {
  consoleError: false,
  pageError: true,
  failedRequest: false,
}
```

## 9. Artifacts

Use deterministic paths:

``` text
.statecraft/
  artifacts/
    dashboard/
      success/
        desktop-light.png
        desktop-dark.png
        mobile-light.png
        mobile-dark.png
  report/
    index.html
    statecraft.json
```

Use PNG initially. No timestamps in filenames. Metadata must not be
inferred from filenames.

## 10. HTML report --- highest-priority UX

Do not ship a generic raw table. Header should show Statecraft, report
title, passed/total executions, and coverage. Summary cards: routes,
states, executions, passed, failed, coverage, duration.

Main matrix rows represent route/state combinations; columns represent
viewport/theme combinations. Every successful cell shows a screenshot
thumbnail. Clicking a cell opens details: full screenshot, route/URL,
state, viewport, theme, duration, status, console errors, page errors,
failed requests, scenario source.

Filters: route, state, viewport, theme, passed/failed.

Constraints: fully offline; no CDN; no server; bundled/embedded CSS and
JS; responsive; keyboard-usable; screenshots dominate; minimal clutter;
polished enough for launch screenshots.

## 11. JSON contract

Generate `.statecraft/report/statecraft.json` with `schemaVersion: 1`,
generation time, project/baseURL, summary metrics, and execution
records. Treat this as a versioned external contract from day one.

## 12. CLI behavior

Commands: `statecraft init`, `statecraft scan`, `statecraft open`.

`init` creates starter files and never silently overwrites. Initial scan
forms: `statecraft scan`, `--config`, `--route`, `--headed`. Do not
implement speculative flags. `open` opens the latest report and gives a
useful error if none exists.

Exit codes: `0` all pass; `1` scan completes with one or more failures;
`2` configuration/internal/setup error.

## 13. Repository architecture

``` text
statecraft/
├── apps/example-nextjs/
├── packages/
│   ├── core/
│   ├── cli/
│   ├── runner-playwright/
│   └── report/
├── docs/
├── .github/workflows/
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── LICENSE
└── README.md
```

Do not create empty future packages.

`statecraft-ui-core`: public types, config validation, matrix expansion,
report contracts, shared errors. Avoid browser-specific dependencies.

`statecraft-ui-runner-playwright`: browser lifecycle, contexts, scenario
loading, navigation, readiness, screenshots, diagnostics.

`statecraft-ui-report`: report transformation, assets, HTML/report UI.

`statecraft-ui`: commands, config discovery, orchestration, terminal
UX, exit codes.

Preferred tools: pnpm workspaces, strict TypeScript, Playwright, Zod,
Vitest, lightweight CLI parser. Avoid unnecessary dependencies.

## 14. Example application

The example app is both test fixture and marketing asset. Build a
polished dashboard with `/dashboard`, `/orders`, `/customers/[id]`.
Provide success, loading, empty, error, long-content, and unauthorized
states.

Include at least one intentional defect Statecraft exposes, such as long
customer names overflowing on mobile or an error state failing only in
dark mode. The generated report should make the problem obvious.

## 15. Testing

Unit: config validation, matrix expansion, coverage math, artifact
paths, report serialization, error classification.

Integration: scenario loading, Playwright execution, route interception,
screenshots, diagnostics, exit codes.

End-to-end: run against example app, generate report, verify expected
executions/artifacts, and verify at least one known failure. Avoid
brittle pixel-perfect report tests unless necessary.

## 16. Security/privacy

Scenario/config files are trusted local code; document this. Never
upload screenshots. No telemetry initially. Do not log response bodies
by default. Do not expose authorization headers, cookies, or secrets in
reports. Redact sensitive request metadata.

## 17. README

Above the fold: name/logo treatment; **"Find the UI states your product
forgot."**; one excellent demo GIF/report screenshot;
`npx statecraft scan`; tiny matrix; short explanation of difference from
visual regression.

Then: quick start, config, state model, report screenshots, CI,
architecture, roadmap, contributing, license. Avoid AI buzzword-heavy
positioning.

## 18. GitHub Actions

Document a workflow that checks out code, installs
Node/dependencies/Chromium, builds/starts the example app as needed,
runs Statecraft, and uploads `.statecraft/report` using
`actions/upload-artifact` with `if: always()`. A custom Marketplace
action is not required for v0.1.

## 19. Future roadmap --- do not build now

v0.2: Storybook adapter, MSW helpers, full-page capture, richer
assertions, run-to-run comparison.

v0.3: edge-data fixture generator from Zod/JSON Schema,
recommended-state policies, accessibility metadata, PR summary
generation.

Later: Claude Code/Codex/OpenCode skills, automatic route
discovery/state suggestions, optional AI analysis, plugin ecosystem,
additional frameworks, hosted collaboration only if demand appears.

## 20. Implementation phases

### Phase 1 --- Foundation

Create monorepo, packages, strict TypeScript, test/build scripts, MIT
license, initial README. **Acceptance:** clean install and root
build/tests pass.

### Phase 2 --- Core contracts

Implement config types/schema, `defineConfig`, validation, matrix
expansion, result types, coverage math. **Acceptance:** comprehensive
unit tests.

### Phase 3 --- Playwright runner

Implement isolated execution, hooks, viewport/theme, navigation,
readiness, screenshots, diagnostics, assertions. **Acceptance:** runner
works against a small fixture app.

### Phase 4 --- CLI

Implement init/scan/open, config discovery, terminal output, exit codes.
**Acceptance:** fresh example can go init → scan → report.

### Phase 5 --- Report

Build polished matrix, thumbnails, detail view, filters, metrics,
offline packaging. **Acceptance:** self-contained report works without
server/network.

### Phase 6 --- Example app

Build polished Next.js fixture with meaningful states and intentional
defects. **Acceptance:** report clearly demonstrates product value.

### Phase 7 --- CI/docs/release

Add CI, GitHub Actions usage, contributor docs, screenshots/GIF assets,
release preparation. **Acceptance:** another developer can clone and use
the project without author help.

## 21. Definition of Done for v0.1

Do not call v0.1 complete until: fresh clone installs; build/tests pass;
example app runs; scan creates expected cells; screenshots are
sufficiently deterministic; one failure does not abort unrelated
scenarios; JSON report is valid/versioned; HTML works offline; `open`
works; exit codes are correct; CI example works; README communicates
value immediately; report is visually launch-quality; no cloud/API
key/LLM is required.

## 22. Instructions to Codex

Treat this file as the product and architecture specification.

1.  Do not silently change product scope.
2.  Prefer simple maintainable architecture over premature abstraction.
3.  Do not build roadmap features during v0.1.
4.  Keep public APIs small and documented.
5.  Add tests with each meaningful capability.
6.  Keep the repository runnable after each phase.
7.  Prefer deterministic behavior.
8.  No telemetry, backend, database, or required LLM.
9.  Prioritize report visual quality.
10. Use the example app to prove real product value.
11. Record significant decisions in `docs/decisions/` as short ADRs.
12. If ambiguous, choose the smallest design preserving future
    extensibility.
13. Before adding a major dependency, justify it and prefer
    mature/lightweight options.
14. At each phase end, run tests/build and summarize work, assumptions,
    and risks.

## 23. Current Codex task

Phase 1 through Phase 7 are complete. Clean-checkout consumer smoke
coverage, documented GitHub Actions usage, public npm packages, protected
release automation, real report launch assets, and final contributor and
release guidance are implemented. Keep future work in an explicitly
approved roadmap slice.

At each handoff provide: API implemented; behavior; fixture and
integration tests added; build/test commands; assumptions; unresolved
questions; and the recommended next step at the current approved phase
boundary.

Guiding sentence:

> **Statecraft finds, renders, and reports the UI states your product
> forgot.**

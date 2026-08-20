# Architecture

## Flow
`CLI -> config validator -> matrix planner -> Playwright runner -> artifacts/results -> report generator -> HTML + JSON`

## Monorepo
```text
apps/example-nextjs
packages/core
packages/runner-playwright
packages/report
packages/cli
docs
.github/workflows
```
Do not create empty future packages.

## Boundaries
### @statecraft/core
Public types, Zod config validation, `defineConfig`, matrix expansion, result contracts, coverage calculations, shared errors. Avoid browser-specific details.

### @statecraft/runner-playwright
Browser/context lifecycle, scenario loading/hooks, viewport/theme, navigation/readiness, screenshots, diagnostics, assertions, isolation.

The initial lifecycle slice runs matrix cells sequentially in configured order. One healthy Chromium process is reused across cells, while every cell receives a new context and page. Per-cell setup, callback, and cleanup failures are returned as settled outcomes so later cells still execute. If context cleanup fails, the compromised browser is closed and replaced before the next cell; browser launch, replacement, and browser cleanup failures remain run-level failures.

Scenario modules are trusted local ESM code resolved from each state's configured `setup` path and an explicit base directory. The runner validates the default export and hook fields at runtime, then executes `beforeNavigate`, caller-owned work, and `afterNavigate` inside the cell's isolated context. Module and hook failures settle as cell failures.

The navigated runner resolves local route paths against one validated HTTP(S) base URL and refuses cross-origin paths, redirects, or hook-driven navigation before post-readiness work. Before application scripts run, it sets `data-theme`, maps `light`/`dark` to the matching color-scheme media feature, and requests reduced motion. After `beforeNavigate`, DOM-content-loaded navigation, and `afterNavigate`, bounded readiness waits for the normal load event, an optional visible selector, and loaded fonts while suppressing animations, transitions, smooth scrolling, and carets. Main-frame document navigation that starts during readiness is rejected because a replacement document has not passed those stability gates. Readiness never waits for `networkidle`.

The capture runner attaches diagnostics before theme setup and hooks, follows the same navigation lifecycle, captures viewport-sized PNG bytes after readiness, and then executes the scenario assertion. Console errors, uncaught page errors, failed-request metadata, navigation status, and duration remain in memory. Free-form diagnostic text is capped and redacted; failed requests never expose headers or bodies. Page errors fail by default, while console errors and failed requests are nonfatal unless `failOn` enables them. Screenshot and assertion failures are always fatal. A structured cell error retains partial evidence, and no capture artifact is persisted until the following Phase 3 slice.

### @statecraft/report
Report transformation and offline HTML UI/assets. No execution semantics.

### @statecraft/cli
Config discovery, commands, orchestration, terminal UX, exit codes.

## Scenario API
```ts
interface StatecraftScenario {
  beforeNavigate?(ctx: ScenarioContext): Promise<void>;
  afterNavigate?(ctx: ScenarioContext): Promise<void>;
  assert?(ctx: ScenarioContext): Promise<void>;
}
```
Expose Playwright `page` and `context` instead of wrapping every operation.

## Isolation
Each route/state/viewport/theme cell gets an isolated context. Reuse browser process where safe. One bad cell must not abort unrelated cells.

## Readiness
Do not blindly rely on `networkidle`. Support selector and scenario-controlled readiness. Fixed delay is last resort. Settle fonts and suppress animations/caret where practical.

## Contracts
Use deterministic `.statecraft/` artifact paths. Metadata is separate from filenames. JSON starts with `schemaVersion: 1` and is an external contract.

## Privacy
No telemetry/upload. Do not persist sensitive auth headers/cookies. Config/scenario files are trusted local code.

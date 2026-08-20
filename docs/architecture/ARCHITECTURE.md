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

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

The persisted runner prevalidates individual cells and cross-cell report invariants, translates every settled capture into the schema-v1 core `ExecutionResult` contract, including failures that retain a successfully captured screenshot, and calculates summary coverage from the configured cells. It validates the complete `StatecraftReport` and writes deterministic PNG paths plus `.statecraft/report/statecraft.json`. A process-owned, phase-aware run lock covers capture and publication and safely recovers abandoned capture-only locks. Writes stage a complete replacement artifact tree, reject symbolic-link output roots, normalize private filesystem modes, preserve unrelated report UI files, hide the old JSON before artifact replacement, and publish the new JSON last. Incomplete recovery preserves its staging data and lock. The runner does not generate HTML or expose CLI behavior.

### @statecraft/report
Report transformation and offline HTML UI/assets. No execution semantics.

### @statecraft/cli
Config discovery, commands, orchestration, terminal UX, exit codes.

The initial Phase 4 slice exposes deterministic project-root config discovery and loading. Discovery checks only the explicit working directory, supports an explicit path relative to that directory, canonicalizes results, accepts the documented TypeScript and JavaScript module variants, and rejects ambiguity instead of choosing by extension precedence. Loading executes the selected config as trusted local code, requires a default export, and delegates value validation to `@statecraft/core`. Command parsing, runner orchestration, terminal behavior, and report opening remain outside this slice.

The next Phase 4 slice adds an executable dispatcher without a third-party parser and an `init` command. Initialization creates one typed config that imports its helper from the installed CLI package plus one valid empty scenario, accepts no force/overwrite flag, preflights every target, rejects symbolic-link directory boundaries, writes files with exclusive creation, and publishes the config last. It never deletes paths during failure recovery because concurrent filesystem changes could replace a file after creation.

The scan-orchestration slice composes config loading, exact route selection, deterministic matrix expansion, and the complete persisted runner without duplicating those package contracts. Scenario paths resolve from the config directory; `.statecraft/` is rooted at the invocation working directory. `--headed` changes only the Playwright launch mode. The CLI formats terminal output from the validated schema-v1 report and returns `0` when all cells pass, `1` when execution completes with failed cells, and `2` for usage, setup, config, or run-level errors. Unknown routes fail before browser launch or output creation. `open`, HTML generation, and report UI remain outside this slice.

The latest-report slice adds `statecraft open` and the programmatic `openReport` boundary. It canonicalizes the invocation root, validates a readable regular `.statecraft/report/index.html` reached through real directory boundaries, and invokes `open`, `explorer.exe`, or `xdg-open` with a shell-free argument array. The pathname-based OS handoff trusts the local project directory against concurrent same-user mutation. Missing, invalid, and launcher-failure cases retain stable error codes and CLI exit code `2`. The command never creates or modifies report files; HTML generation and all report UI behavior remain owned by Phase 5.

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

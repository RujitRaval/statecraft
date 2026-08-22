# Architecture

## Flow
`CLI -> core validation/matrix -> Playwright runner -> report renderer -> coordinated PNG + JSON + HTML publication`

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
### statecraft-ui-core
Public types, Zod config validation, `defineConfig`, matrix expansion, result contracts, coverage calculations, shared errors. Avoid browser-specific details.

### statecraft-ui-runner-playwright
Browser/context lifecycle, scenario loading/hooks, viewport/theme, navigation/readiness, screenshots, diagnostics, assertions, isolation.

The initial lifecycle slice runs matrix cells sequentially in configured order. One healthy Chromium process is reused across cells, while every cell receives a new context and page. Per-cell setup, callback, and cleanup failures are returned as settled outcomes so later cells still execute. If context cleanup fails, the compromised browser is closed and replaced before the next cell; browser launch, replacement, and browser cleanup failures remain run-level failures.

Scenario modules are trusted local ESM code resolved from each state's configured `setup` path and an explicit base directory. The runner validates the default export and hook fields at runtime, then executes `beforeNavigate`, caller-owned work, and `afterNavigate` inside the cell's isolated context. Module and hook failures settle as cell failures.

The navigated runner resolves local route paths against one validated HTTP(S) base URL and refuses cross-origin paths, redirects, or hook-driven navigation before post-readiness work. Before application scripts run, it sets `data-theme`, maps `light`/`dark` to the matching color-scheme media feature, and requests reduced motion. After `beforeNavigate`, DOM-content-loaded navigation, and `afterNavigate`, bounded readiness waits for the normal load event, an optional visible selector, and loaded fonts while suppressing animations, transitions, smooth scrolling, and carets. Main-frame document navigation that starts during readiness is rejected because a replacement document has not passed those stability gates. Readiness never waits for `networkidle`.

The capture runner attaches diagnostics before theme setup and hooks, follows the same navigation lifecycle, captures viewport-sized PNG bytes after readiness, and then executes the scenario assertion. Console errors, uncaught page errors, failed-request metadata, navigation status, and duration remain in memory. Free-form diagnostic text is capped and redacted; failed requests never expose headers or bodies. Page errors fail by default, while console errors and failed requests are nonfatal unless `failOn` enables them. Screenshot and assertion failures are always fatal. A structured cell error retains partial evidence, and no capture artifact is persisted until the following Phase 3 slice.

The persisted runner prevalidates individual cells and cross-cell report invariants, translates every settled capture into the schema-v1 core `ExecutionResult` contract, including failures that retain a successfully captured screenshot, and calculates summary coverage from the configured cells. It validates the complete `StatecraftReport`, delegates pure HTML rendering to `statecraft-ui-report`, and coordinates deterministic PNG, JSON, and HTML persistence. A process-owned, phase-aware run lock covers capture and publication and safely recovers abandoned capture-only locks. Writes stage a complete replacement output set, reject symbolic-link output targets, normalize private filesystem modes, hide the old report files before artifact replacement, and make HTML visible only after JSON. Failed publication restores the previous set; incomplete recovery preserves its staging data and lock. The runner does not expose CLI behavior.

### statecraft-ui-report
Report transformation and offline HTML UI/assets. No execution semantics.

The Phase 5 report validates schema-v1 input through the core parser and projects it into deterministic first-seen-order viewport/theme columns, route groups, route/state rows, aligned cells, and execution details. It renders one responsive HTML document with inline CSS, relative references to validated screenshots, escaped report-controlled text, and no external asset. Native route/state/viewport/theme/status controls apply AND semantics, persist valid selections in the local document URL, preserve matrix alignment, and expose a live result count. A small constant embedded script manages filtering and the single active detail inspector; report data stays in escaped markup, while CSP authorizes only the exact script hash. Without script execution, ordinary anchors and complete details remain usable. The runner stages HTML, JSON, and screenshots under one owned project lock and recovery transaction, rejecting symbolic-link/non-file targets and restoring the previous coherent set if publication fails.

### statecraft-ui
Config discovery, commands, orchestration, terminal UX, exit codes.

The initial Phase 4 slice exposes deterministic project-root config discovery and loading. Discovery checks only the explicit working directory, supports an explicit path relative to that directory, canonicalizes results, accepts the documented TypeScript and JavaScript module variants, and rejects ambiguity instead of choosing by extension precedence. Loading executes the selected config as trusted local code, requires a default export, and delegates value validation to `statecraft-ui-core`. Command parsing, runner orchestration, terminal behavior, and report opening remain outside this slice.

The next Phase 4 slice adds an executable dispatcher without a third-party parser and an `init` command. Initialization creates one typed `.mts` config that imports its helper from the installed CLI package plus one valid empty `.mts` scenario. The module-unambiguous extensions work in both CommonJS-default and ESM projects. Initialization accepts no force/overwrite flag, preflights every target, rejects symbolic-link directory boundaries, writes files with exclusive creation, and publishes the config last. It never deletes paths during failure recovery because concurrent filesystem changes could replace a file after creation.

The scan-orchestration slice composes config loading, exact route selection, deterministic matrix expansion, and the complete persisted runner without duplicating those package contracts. Scenario paths resolve from the config directory; `.statecraft/` is rooted at the invocation working directory. `--headed` changes only the Playwright launch mode. The CLI formats terminal output from the validated schema-v1 report and returns `0` when all cells pass, `1` when execution completes with failed cells, and `2` for usage, setup, config, or run-level errors. Unknown routes fail before browser launch or output creation.

The latest-report slice adds `statecraft open` and the programmatic `openReport` boundary. It canonicalizes the invocation root, validates a readable regular `.statecraft/report/index.html` reached through real directory boundaries, and invokes the platform launcher from an absolute system path with a shell-free argument array. The pathname-based OS handoff trusts the local project directory against concurrent same-user mutation. Missing, invalid, and launcher-failure cases retain stable error codes and CLI exit code `2`. The command never creates or modifies report files.

Phase 5 scan integration returns the runner's coordinated output directly. `ScanResult` exposes both the HTML and JSON project-relative paths, and terminal output points developers to the HTML report that `statecraft open` consumes. The CLI does not duplicate transformation, rendering, or persistence behavior.

The public URL orchestration slice adds `statecraft check <url>` and `checkPublicSite`. It snapshots the invocation root, composes bounded same-origin discovery with the runner-owned fixed public-site matrix, and returns discovery metadata beside the existing validated report contract. Headed mode is forwarded to both browser stages; the page budget belongs only to discovery. The terminal layer validates one credential-free HTTP(S) URL and options before browser launch, groups report executions by route pathname, omits diagnostic payloads, and reuses exit codes `0`/`1`/`2` for all-pass/completed-failure/run-error outcomes.

The promotion slice adds explicit `--write-config`/`writeConfig`. It extracts the initializer's exclusive config-last publisher, preflights every supported config name plus the generated scenario and real directory boundaries before the runner is imported, and publishes only after the coordinated evidence run completes. The generated config preserves discovery order and runner route identities, serializes fixed matrix and failure-policy fields from a lightweight runner-owned contract, and uses a shared `.mts` scenario importing the narrow `statecraft-ui/public-site-scenario` subpath. Any conflict fails before browser work, while a late race preserves generated files for inspection and never deletes or overwrites an existing path.

### apps/example-nextjs
The Phase 6 example is a real Next.js App Router application and a deterministic product-state fixture. It owns a self-hosted visual system, fixed commerce-operations data, a narrow `/api/dashboard` response contract, and a client-rendered `/dashboard` state boundary. The page begins in a deliberate loading state, validates the API payload before rendering, classifies a valid no-data payload as empty, and turns transport, HTTP, or contract failures into a recoverable error state. Statecraft scenarios can intercept the API without adding test-only behavior to production components. Theme styling follows the runner-owned `data-theme` attribute before application scripts execute.

The orders slice extends the same boundary with a fixed `/api/orders` contract and `/orders` success, loading, empty, and recoverable error states. Runtime validation rejects malformed records and duplicate IDs before rendering. The success surface derives its summary from the validated queue and provides client-side search and status filters whose selections are reflected in the local URL; those presentation controls do not change the fixture contract. A route-aware shared navigation component marks the current workspace on desktop and mobile. Scenario interception remains the only mechanism for forcing product states.

The customer-detail slice adds a dynamic `/api/customers/[id]` contract and `/customers/[id]` route. The production API returns one deterministic fictional fixture or a conventional 404; scenario interception supplies alternate valid long content, authorization failures, and service failures. A `server-only` fixture module is separate from the client-safe types, parser, and formatters so restricted record fields cannot enter browser chunks. Runtime validation covers nested contacts, metrics, orders, activity, safe integer and cross-record relationships, unique nested identifiers, and route-to-response identity before rendering. The client boundary distinguishes success, loading, 401/403 authorization, 404 not-found, and recoverable service-error states without exposing customer data in restricted surfaces. Long content uses the same public contract and layout as the default fixture rather than a production test switch.

The intentional-defect slice preserves two narrow, deterministic visual failures without a test-only application mode. At mobile widths, an unusually long customer email remains on one line and overflows its contact card while the default customer stays contained. In dark theme, the orders service-error signal uses identical foreground and background colors while the rest of the recoverable error state remains usable. Browser contracts verify both trigger boundaries; the following complete scenario matrix owns the assertions that surface them as known failed cells.

The final Phase 6 slice checks an example-owned Statecraft config into `apps/example-nextjs`. It declares 15 route/state combinations across mobile/desktop and light/dark for 60 stable cells. Three route-level scenario modules use isolated interception to render every dashboard, orders, and customer state, then assert the desired visible state and layout/contrast invariants. The assertions truthfully fail the two dark orders-error cells and the two mobile long-content cells; Statecraft does not gain an expected-failure mode. A real CLI scan gate requires exit code `1`, 56 passing cells, those exact four assertion failures, 60 persisted screenshots, schema-v1 JSON, and offline HTML from a temporary project root.

### Release verification

Phase 7 starts with a dedicated clean-checkout release-smoke job. After a frozen install, pinned Chromium installation, and production build, a repository script starts the example on an allocated loopback port and spawns the built CLI executable from an isolated generated project root. The gate accepts only the four approved known failures and verifies all 60 screenshots, schema-v1 JSON, coverage totals, and offline HTML. The fictional report is uploaded by explicit CI configuration for short-lived inspection; Statecraft itself performs no upload.

The package-release slice publishes four unscoped ESM packages because the original `@statecraft` scope is not controlled by this project. `statecraft-ui` retains the `statecraft` executable and depends on `statecraft-ui-core` plus `statecraft-ui-runner-playwright`; the runner depends on core and `statecraft-ui-report`. A metadata validator maps the repository's `MAJOR.MINOR.PATCH.0` version to npm's three-component version and rejects nonzero fourth components. The artifact gate packs each workspace, validates npm's publish view, initializes a default CommonJS npm project, installs all tarballs together, imports every public API, installs Chromium, and runs the generated `.mts` starter through a complete four-cell scan.

Publication runs only for a non-prerelease GitHub Release whose event commit exactly matches its named tag and belongs to `main`. One repository-wide concurrency group serializes releases. The workflow grants OIDC only to the publish job, uses a protected `npm-publish` Environment, verifies the complete repository and consumer gates, and publishes already-tested tarballs directly to `latest` in dependency order with the CLI last. Registry integrity, dist-tag consistency, and monotonic latest-version checks make retries resumable without letting an older release move consumers backward. The workflow avoids separate dist-tag operations, which npm trusted publishing does not authorize. A short-lived, Environment-protected `All Packages` token is permitted only to bootstrap the unclaimed names before npm trusted publishing can be configured.

After publication, a dependent release job gives the registry-only public URL gate an independent 15-minute budget. It creates a default CommonJS npm project in a private temporary directory, installs the exact release plus the runner manifest's exact Playwright version from the explicit npmjs registry, and provisions the browser's Linux dependencies inside that job. Against a deterministic two-page loopback fixture, it runs evidence-only `check`, executes the exact printed `check --write-config` command, and runs the untouched generated `scan`. Exact eight-cell coordinates, screenshots, schema-v1 JSON, kinetic HTML, generated imports, and source-file stability must pass. Bounded retries cover registry propagation and command timeouts only; the temporary consumer is always removed.

## Scenario API
```ts
interface StatecraftScenario {
  beforeNavigate?(ctx: ScenarioContext): Promise<void>;
  afterNavigate?(ctx: ScenarioContext): Promise<void>;
  assert?(ctx: AssertionScenarioContext): Promise<void>;
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

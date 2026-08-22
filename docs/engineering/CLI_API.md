# CLI API

`statecraft-ui` exposes zero-config public-site checking, deterministic config loading, and executable `init`, `scan`, and `open` workflows. Check composes bounded runner discovery, fixed public-site evidence, and the report-generation contracts. Scan composes the core planner and configured runner. Open launches the generated offline HTML report; report transformation and rendering stay owned by `statecraft-ui-report`.

## Executable

```bash
statecraft init
statecraft check <url> [--max-pages <1-20>] [--headed]
statecraft scan [--config <path>] [--route <id>] [--headed]
statecraft open
statecraft --help
```

`init` creates:

```text
statecraft.config.mts
statecraft/scenarios/home/success.mts
```

The config imports `defineConfig` from the installed `statecraft-ui` package and declares one `/` route, one `success` state, mobile and desktop viewports, and light and dark themes. Both generated files use the module-unambiguous `.mts` extension, so they load correctly even when the nearest `package.json` is the CommonJS default created by `npm init -y`. The scenario starts as a valid empty module with no external import, so the documented one-package installation is sufficient. Developers can add typed Playwright hooks when they customize that scenario. Successful initialization prints the created paths plus edit, hook, and version-control next steps.

No force flag exists. Before writing, initialization checks every supported default config name, the generated scenario, and every directory boundary. Any existing config, an existing scenario, or a symbolic-link starter directory produces exit code `2`. Files use exclusive creation, the config is published last, and alternate config names are rechecked before success is reported. Failure recovery never deletes a path, because a concurrent process could have replaced a newly created file; write failures list the affected targets for inspection before retrying.

Missing or unsupported commands, malformed check/scan options, extra `init` or `open` arguments, invalid public URLs, discovery/config errors, unknown route IDs, absent/invalid HTML reports, launcher failures, and run-level failures return `2`. Help, successful opens, and all-pass checks/scans return `0`. A completed check or scan containing failed cells returns `1` after persisting its report.

## Programmatic command, check, init, scan, and open API

```ts
import {
  checkPublicSite,
  initProject,
  openReport,
  runCli,
  scanProject,
} from "statecraft-ui";

const check = await checkPublicSite({
  cwd: process.cwd(),
  maxPages: 5,
  url: "https://example.com",
});
const result = await initProject({ cwd: process.cwd() });
const exitCode = await runCli({ args: ["init"], cwd: process.cwd() });
const scan = await scanProject({ cwd: process.cwd(), routeId: "dashboard" });
const opened = await openReport({ cwd: process.cwd() });
```

`initProject` returns canonical absolute `projectRoot`, `configPath`, and `scenarioPath` values plus an immutable `files` list. Expected failures use `InitError` with `INIT_CONFLICT`, `INIT_ROOT_INVALID`, or `INIT_WRITE_FAILED` and expose the affected paths.

`checkPublicSite` canonicalizes the output directory before browser work, calls `discoverPublicRoutes`, passes that immutable discovery result to `runPublicSiteChecks`, and returns discovery metadata plus the validated report and stable JSON/HTML paths. `headed: true` is forwarded to both browser launches, while `maxPages` applies only to discovery. Invalid roots, input, and expected starting-page failures become `CheckError` with `CHECK_ROOT_INVALID`, `CHECK_INVALID_INPUT`, or `CHECK_DISCOVERY_FAILED`; unexpected runner details remain hidden by the executable. The executable summary groups fixed cells by route pathname, prints sanitized failure messages rather than diagnostic payloads, and points to the kinetic offline report.

`scanProject` loads and validates config, verifies an optional exact `routeId`, expands the selected matrix, resolves scenarios relative to the selected config, and persists deterministic output beneath the selected `cwd`. `headed: true` forwards `{ headless: false }` to Playwright. The runner publishes PNG, schema-v1 JSON, and offline HTML as one coordinated output set. `scanProject` returns the canonical config path, validated report, stable `.statecraft/report/statecraft.json` machine-readable path, and `.statecraft/report/index.html` `htmlReportPath`. An unknown route raises `ScanError` with `SCAN_ROUTE_NOT_FOUND` before output creation; unexpected runner or filesystem details remain hidden behind CLI exit code `2`.

The terminal summary is derived from report metadata, groups cells by route, prints each state/viewport/theme result and failure messages, then prints execution coverage, HTML report path, and aggregate pass/fail totals. It never parses artifact filenames for metadata.

`openReport` canonicalizes the selected project root and opens only `.statecraft/report/index.html`. Every `.statecraft/` and `report/` boundary must be a real directory and the HTML target must be a readable regular file, not a symbolic link, when inspected. The path is passed as one argument to the absolute system path for macOS `open`, Windows `explorer.exe`, or freedesktop `xdg-open`; neither a command shell nor project-directory executable lookup is used. Because those operating-system launchers accept pathnames rather than open file descriptors, the local project directory is trusted against concurrent same-user mutation during the handoff. The API returns canonical absolute `projectRoot` and `reportPath` values plus the stable project-relative path. Expected failures use `OpenReportError` with `OPEN_REPORT_NOT_FOUND`, `OPEN_REPORT_ROOT_INVALID`, `OPEN_REPORT_PATH_INVALID`, or `OPEN_REPORT_LAUNCH_FAILED`.

Opening is read-only: it does not parse, create, or modify the report. A completed scan now publishes the fixed HTML target that `open` consumes.

`runCli` accepts injectable arguments, working directory, and stdout/stderr writers for embedding and deterministic tests. `CliExitCode` is the stable `0 | 1 | 2` command contract.

## Discovery

```ts
import { discoverConfig } from "statecraft-ui";

const configPath = await discoverConfig({ cwd: process.cwd() });
```

Default discovery checks only the selected working directory for these names:

- `statecraft.config.ts`
- `statecraft.config.mts`
- `statecraft.config.cts`
- `statecraft.config.js`
- `statecraft.config.mjs`
- `statecraft.config.cjs`

It does not walk toward the filesystem root. Exactly one canonical file must match. Multiple distinct matches raise `ConfigDiscoveryError` with code `CONFIG_AMBIGUOUS`; no extension has silent precedence.

Pass `configPath` to select any regular file explicitly. Relative paths resolve from `cwd`. Successful discovery returns the canonical absolute path, including resolution of filesystem aliases and symbolic links.

Expected discovery errors use `ConfigDiscoveryError` and one of:

- `CONFIG_NOT_FOUND`
- `CONFIG_AMBIGUOUS`
- `CONFIG_PATH_INVALID`
- `CONFIG_ROOT_INVALID`

The error exposes stable `code`, `configPath`, and `candidates` fields so later CLI presentation does not need to parse message text.

## Loading

```ts
import { loadConfig } from "statecraft-ui";

const { config, path } = await loadConfig({
  configPath: "./statecraft.config.ts",
  cwd: process.cwd(),
});
```

`loadConfig` discovers the file, imports it as a trusted local module, requires a default export, and validates that export with `statecraft-ui-core`'s `parseConfig`. It returns the validated config and its canonical source path.

Module execution failures and absent default exports use `ConfigLoadError` with `CONFIG_IMPORT_FAILED` or `CONFIG_DEFAULT_EXPORT_MISSING`. Invalid exported values retain the core `ConfigValidationError` contract and its structured issues.

Config files execute with the user's process privileges. Statecraft does not sandbox them and does not upload their contents.

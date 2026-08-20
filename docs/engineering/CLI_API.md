# CLI API

`@statecraft/cli` exposes deterministic config loading plus executable `init`, `scan`, and `open` workflows. Scan composes the existing core planner and Playwright persistence contracts. Open launches an existing offline HTML report; neither command generates report UI.

## Executable

```bash
statecraft init
statecraft scan [--config <path>] [--route <id>] [--headed]
statecraft open
statecraft --help
```

`init` creates:

```text
statecraft.config.ts
statecraft/scenarios/home/success.ts
```

The config imports `defineConfig` from the installed `@statecraft/cli` package and declares one `/` route, one `success` state, mobile and desktop viewports, and light and dark themes. The scenario starts as a valid empty module with no external import, so the documented one-package installation is sufficient. Developers can add typed Playwright hooks when they customize that scenario. Successful initialization prints the created paths plus edit, hook, and version-control next steps.

No force flag exists. Before writing, initialization checks every supported default config name, the generated scenario, and every directory boundary. Any existing config, an existing scenario, or a symbolic-link starter directory produces exit code `2`. Files use exclusive creation, the config is published last, and alternate config names are rechecked before success is reported. Failure recovery never deletes a path, because a concurrent process could have replaced a newly created file; write failures list the affected targets for inspection before retrying.

Missing or unsupported commands, extra `init` or `open` arguments, malformed scan options, config errors, unknown route IDs, absent/invalid HTML reports, launcher failures, and run-level failures return `2`. Help, successful opens, and all-pass scans return `0`. A completed scan containing failed cells returns `1` after persisting its report.

## Programmatic command, init, scan, and open API

```ts
import { initProject, openReport, runCli, scanProject } from "@statecraft/cli";

const result = await initProject({ cwd: process.cwd() });
const exitCode = await runCli({ args: ["init"], cwd: process.cwd() });
const scan = await scanProject({ cwd: process.cwd(), routeId: "dashboard" });
const opened = await openReport({ cwd: process.cwd() });
```

`initProject` returns canonical absolute `projectRoot`, `configPath`, and `scenarioPath` values plus an immutable `files` list. Expected failures use `InitError` with `INIT_CONFLICT`, `INIT_ROOT_INVALID`, or `INIT_WRITE_FAILED` and expose the affected paths.

`scanProject` loads and validates config, verifies an optional exact `routeId`, expands the selected matrix, resolves scenarios relative to the selected config, and persists deterministic output beneath the selected `cwd`. `headed: true` forwards `{ headless: false }` to Playwright. It returns the canonical config path, validated schema-v1 report, and stable `.statecraft/report/statecraft.json` path. An unknown route raises `ScanError` with `SCAN_ROUTE_NOT_FOUND` before output creation.

The terminal summary is derived from report metadata, groups cells by route, prints each state/viewport/theme result and failure messages, then prints execution coverage, JSON report path, and aggregate pass/fail totals. It never parses artifact filenames for metadata.

`openReport` canonicalizes the selected project root and opens only `.statecraft/report/index.html`. Every `.statecraft/` and `report/` boundary must be a real directory and the HTML target must be a readable regular file, not a symbolic link, when inspected. The path is passed as one argument to the absolute system path for macOS `open`, Windows `explorer.exe`, or freedesktop `xdg-open`; neither a command shell nor project-directory executable lookup is used. Because those operating-system launchers accept pathnames rather than open file descriptors, the local project directory is trusted against concurrent same-user mutation during the handoff. The API returns canonical absolute `projectRoot` and `reportPath` values plus the stable project-relative path. Expected failures use `OpenReportError` with `OPEN_REPORT_NOT_FOUND`, `OPEN_REPORT_ROOT_INVALID`, `OPEN_REPORT_PATH_INVALID`, or `OPEN_REPORT_LAUNCH_FAILED`.

Opening is read-only: it does not parse, create, or modify the report. Until Phase 5 supplies HTML generation, a scan produces PNG and JSON artifacts but `open` correctly reports that `index.html` is absent.

`runCli` accepts injectable arguments, working directory, and stdout/stderr writers for embedding and deterministic tests. `CliExitCode` is the stable `0 | 1 | 2` command contract.

## Discovery

```ts
import { discoverConfig } from "@statecraft/cli";

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
import { loadConfig } from "@statecraft/cli";

const { config, path } = await loadConfig({
  configPath: "./statecraft.config.ts",
  cwd: process.cwd(),
});
```

`loadConfig` discovers the file, imports it as a trusted local module, requires a default export, and validates that export with `@statecraft/core`'s `parseConfig`. It returns the validated config and its canonical source path.

Module execution failures and absent default exports use `ConfigLoadError` with `CONFIG_IMPORT_FAILED` or `CONFIG_DEFAULT_EXPORT_MISSING`. Invalid exported values retain the core `ConfigValidationError` contract and its structured issues.

Config files execute with the user's process privileges. Statecraft does not sandbox them and does not upload their contents.

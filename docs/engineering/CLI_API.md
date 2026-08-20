# CLI API

`@statecraft/cli` exposes deterministic config loading plus the executable command foundation. The current executable supports `init` and help. It does not yet run Playwright, implement `scan` or `open`, generate HTML, or open reports.

## Executable

```bash
statecraft init
statecraft --help
```

`init` creates:

```text
statecraft.config.ts
statecraft/scenarios/home/success.ts
```

The config imports `defineConfig` from the installed `@statecraft/cli` package and declares one `/` route, one `success` state, mobile and desktop viewports, and light and dark themes. The scenario starts as a valid empty module with no external import, so the documented one-package installation is sufficient. Developers can add typed Playwright hooks when they customize that scenario. Successful initialization prints the created paths and exact edit/scan next steps.

No force flag exists. Before writing, initialization checks every supported default config name, the generated scenario, and every directory boundary. Any existing config, an existing scenario, or a symbolic-link starter directory produces exit code `2`. Files use exclusive creation and the config is published last. Failure recovery never deletes a path, because a concurrent process could have replaced a newly created file; the reported targets remain available for inspection before retrying.

Missing commands, unsupported commands (including the deferred `scan` and `open` commands), and extra `init` arguments also return `2`. Help returns `0`. Exit code `1` remains reserved for a future completed scan containing failed cells.

## Programmatic command and init API

```ts
import { initProject, runCli } from "@statecraft/cli";

const result = await initProject({ cwd: process.cwd() });
const exitCode = await runCli({ args: ["init"], cwd: process.cwd() });
```

`initProject` returns canonical absolute `projectRoot`, `configPath`, and `scenarioPath` values plus an immutable `files` list. Expected failures use `InitError` with `INIT_CONFLICT`, `INIT_ROOT_INVALID`, or `INIT_WRITE_FAILED` and expose the affected paths.

`runCli` accepts injectable arguments, working directory, and stdout/stderr writers for embedding and deterministic tests. `CliExitCode` is the stable `0 | 1 | 2` command contract; `1` is reserved until the scan slice can complete with failed cells.

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

# CLI Config API

Phase 4 begins with a small programmatic boundary in `@statecraft/cli`. This slice locates and validates configuration; it does not parse commands, run Playwright, render terminal output, generate HTML, or open reports.

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

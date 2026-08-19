# `@statecraft/core` API

Phase 2 builds Statecraft's deterministic, browser-independent contracts. The package is still private while those contracts are completed.

## Configuration

```ts
import { defineConfig } from "@statecraft/core";

export default defineConfig({
  baseURL: "http://localhost:3000",
  viewports: {
    mobile: { width: 390, height: 844 },
    desktop: { width: 1440, height: 1000 },
  },
  themes: ["light", "dark"],
  routes: [
    {
      id: "dashboard",
      path: "/dashboard",
      states: [
        {
          id: "success",
          setup: "./statecraft/scenarios/dashboard/success.ts",
        },
      ],
    },
  ],
});
```

`defineConfig(config)` is an identity helper that provides contextual TypeScript checking. It does not perform runtime validation or load scenario modules.

`parseConfig(input)` strictly validates an unknown value and returns a `StatecraftConfig`. It rejects unknown properties, non-HTTP(S) base URLs, empty collections, invalid viewport dimensions, malformed IDs, duplicate route/state/theme IDs, empty scenario paths, and route paths that are not local slash-prefixed paths.

Route, state, theme, and viewport IDs use lowercase letters and numbers separated by single hyphens. Domain-specific IDs such as `payment-declined` are supported.

The underlying Zod schema is intentionally private. Callers use `parseConfig` so validation behavior and errors remain Statecraft-owned contracts rather than validator-specific APIs.

## Validation errors

`parseConfig` throws `ConfigValidationError`, a `StatecraftError` with:

- `code: "CONFIG_INVALID"` for machine-readable classification;
- a deterministic `issues` array containing `code`, `path`, and `message`;
- Statecraft-owned issue codes that do not expose Zod's internal issue types.

Configuration and scenario modules are trusted local code running with the user's privileges. Validation checks their declared shape; it does not execute or inspect scenario modules.

## Exported types

- `StatecraftConfig`
- `ViewportDefinition`
- `RouteDefinition`
- `StateDefinition`
- `FailurePolicy`
- `StatecraftErrorCode`
- `ConfigValidationIssue` and `ConfigValidationIssueCode`

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

## Matrix planning

`expandMatrix(config, filter?)` expands a validated `StatecraftConfig` into one `MatrixCell` for every configured `route x state x viewport x theme` combination. Each cell carries the route, state, named viewport, viewport dimensions, and theme that a future runner will need.

Expansion follows routes and states in declaration order, viewport keys in deterministic ECMAScript property order, then themes in declaration order. Repeating the same validated input produces the same sequence. For normal named viewport IDs such as `mobile` and `desktop`, property order is declaration order; integer-like IDs are enumerated numerically before other keys. Filters do not change that order:

```ts
import { expandMatrix, parseConfig } from "@statecraft/core";

const cells = expandMatrix(parseConfig(config), {
  routeIds: ["dashboard"],
  stateIds: ["success", "error"],
  viewportIds: ["mobile"],
  themes: ["dark"],
});
```

`MatrixFilter` selections use exact, case-sensitive IDs. An omitted dimension selects all configured values; an empty selection or an unknown value selects no cells. Duplicate filter values never duplicate cells, and filter array order never reorders the configured matrix. Filtering is selection only: the future CLI owns user-facing validation for unmatched flags.

The planner is pure and browser-independent. It does not load scenario modules, access the filesystem, create artifact paths, launch Playwright, or generate reports.

## Exported types

- `StatecraftConfig`
- `ViewportDefinition`
- `RouteDefinition`
- `StateDefinition`
- `FailurePolicy`
- `MatrixCell` and `MatrixFilter`
- `StatecraftErrorCode`
- `ConfigValidationIssue` and `ConfigValidationIssueCode`

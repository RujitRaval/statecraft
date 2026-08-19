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

## Screenshot artifact paths

`screenshotArtifactPath(cell)` returns an opaque `ScreenshotArtifactPath`: the project-relative PNG path reserved for a `MatrixCell`:

```ts
import { screenshotArtifactPath } from "@statecraft/core";

const path = screenshotArtifactPath(cell);
// .statecraft/artifacts/dashboard/success/desktop-light.png
```

The function is deterministic and pure: it does not inspect the clock, read directories, create files, or depend on the host path separator. Route and state IDs form directories; the viewport and theme form the PNG filename.

Filename identifiers use a fixed-width encoding for hyphens and other non-lowercase-alphanumeric characters. This keeps `desktop` + `wide-dark` distinct from `desktop-wide` + `dark`, and it protects against traversal if a caller forges a `MatrixCell` instead of using a validated configuration. Windows-reserved route and state basenames are encoded too. The resulting ASCII path stays stable under case folding and Unicode normalization.

Each encoded identifier has a 120-character budget. Longer identifiers retain a readable prefix and add a full SHA-256 digest, so directory components remain below common 255-byte limits and the combined viewport/theme filename remains at most 245 bytes including `.png`. Short encodings are reversible; long encodings are collision-resistant and intentionally opaque after the prefix.

Paths identify storage locations only. Later result contracts carry route, state, viewport, and theme metadata explicitly; consumers must not reconstruct metadata by parsing filenames. Directory creation and PNG writes remain runner responsibilities.

Plain strings are not assignable to `ScreenshotArtifactPath`. Code that reads a serialized path must validate it against report metadata and the expected cell rather than asserting the opaque type.

## Exported types

- `StatecraftConfig`
- `ViewportDefinition`
- `RouteDefinition`
- `StateDefinition`
- `FailurePolicy`
- `MatrixCell` and `MatrixFilter`
- `ScreenshotArtifactPath`
- `StatecraftErrorCode`
- `ConfigValidationIssue` and `ConfigValidationIssueCode`

Exported functions are `defineConfig`, `parseConfig`, `expandMatrix`, and `screenshotArtifactPath`.

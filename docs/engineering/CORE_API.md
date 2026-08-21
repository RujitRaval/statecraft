# `statecraft-ui-core` API

`statecraft-ui-core` provides Statecraft's published, deterministic, browser-independent contracts. Most users install `statecraft-ui`; direct consumers can build integrations against this package's stable configuration, matrix, coverage, artifact-path, and report boundaries.

## Configuration

```ts
import { defineConfig } from "statecraft-ui-core";

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

`expandMatrix(config, filter?)` expands a validated `StatecraftConfig` into one `MatrixCell` for every configured `route x state x viewport x theme` combination. Each cell carries the route, state, named viewport, viewport dimensions, and theme that the runner needs.

Expansion follows routes and states in declaration order, viewport keys in deterministic ECMAScript property order, then themes in declaration order. Repeating the same validated input produces the same sequence. For normal named viewport IDs such as `mobile` and `desktop`, property order is declaration order; integer-like IDs are enumerated numerically before other keys. Filters do not change that order:

```ts
import { expandMatrix, parseConfig } from "statecraft-ui-core";

const cells = expandMatrix(parseConfig(config), {
  routeIds: ["dashboard"],
  stateIds: ["success", "error"],
  viewportIds: ["mobile"],
  themes: ["dark"],
});
```

`MatrixFilter` selections use exact, case-sensitive IDs. An omitted dimension selects all configured values; an empty selection or an unknown value selects no cells. Duplicate filter values never duplicate cells, and filter array order never reorders the configured matrix. Filtering is selection only: the CLI owns user-facing validation for unmatched flags.

The planner is pure and browser-independent. It does not load scenario modules, access the filesystem, create artifact paths, launch Playwright, or generate reports.

## Coverage calculations

`calculateCoverage(cells, observations)` calculates configured-state coverage without depending on runner or report contracts. The matrix is the source of truth for what was configured. Each `CoverageObservation` is a minimal exact coordinate plus a `passed` boolean:

```ts
import { calculateCoverage, expandMatrix } from "statecraft-ui-core";

const cells = expandMatrix(config);
const coverage = calculateCoverage(cells, [
  {
    passed: true,
    routeId: "dashboard",
    stateId: "success",
    viewportId: "mobile",
    theme: "light",
  },
]);

coverage.execution;
// { covered: 1, total: cells.length, percentage: ... }
```

Every metric is a `CoverageMetric` with an integer `covered` numerator, integer `total` denominator, and percentage from 0 through 100 rounded to at most two decimal places:

- Execution coverage counts passed execution cells out of unique configured cells.
- State coverage counts route/state pairs with at least one passed cell.
- Responsive coverage counts route/state pairs where every configured viewport has at least one passed cell across its configured themes.
- Theme coverage counts route/state pairs where every configured theme has at least one passed cell across its configured viewports.

Route/state pairs remain route-scoped, so the same state ID on two routes contributes two state denominators. Coverage is calculated against the supplied matrix, including a filtered matrix when a caller intentionally measures a selection.

Missing observations remain uncovered. Unknown or case-mismatched coordinates are ignored, so an unconfigured state can never inflate configured-state coverage. Duplicate configured coordinates are counted once. Duplicate observations pass only when every observation for that coordinate passed, making conflicts conservative and independent of input order. An empty matrix returns zero numerators, denominators, and percentages instead of `NaN`.

The calculator is pure, does not mutate its inputs, and returns immutable summary and metric objects. A later runner or result contract can project its records into `CoverageObservation`; coverage calculation does not define execution diagnostics, report serialization, Playwright behavior, or the report UI.

## Screenshot artifact paths

`screenshotArtifactPath(cell)` returns an opaque `ScreenshotArtifactPath`: the project-relative PNG path reserved for a `MatrixCell`:

```ts
import { screenshotArtifactPath } from "statecraft-ui-core";

const path = screenshotArtifactPath(cell);
// .statecraft/artifacts/dashboard/success/desktop-light.png
```

The function is deterministic and pure: it does not inspect the clock, read directories, create files, or depend on the host path separator. Route and state IDs form directories; the viewport and theme form the PNG filename.

Filename identifiers use a fixed-width encoding for hyphens and other non-lowercase-alphanumeric characters. This keeps `desktop` + `wide-dark` distinct from `desktop-wide` + `dark`, and it protects against traversal if a caller forges a `MatrixCell` instead of using a validated configuration. Windows-reserved route and state basenames are encoded too. The resulting ASCII path stays stable under case folding and Unicode normalization.

Each encoded identifier has a 120-character budget. Longer identifiers retain a readable prefix and add a full SHA-256 digest, so directory components remain below common 255-byte limits and the combined viewport/theme filename remains at most 245 bytes including `.png`. Short encodings are reversible; long encodings are collision-resistant and intentionally opaque after the prefix.

Paths identify storage locations only. Later result contracts carry route, state, viewport, and theme metadata explicitly; consumers must not reconstruct metadata by parsing filenames. Directory creation and PNG writes remain runner responsibilities.

Plain strings are not assignable to `ScreenshotArtifactPath`. Code that reads a serialized path must validate it against report metadata and the expected cell rather than asserting the opaque type.

## Result and report contracts

`ExecutionResult` is the browser-independent persisted outcome for one matrix cell. It carries explicit route, state, viewport, theme, URL, scenario source, duration, status, screenshot, failure, and diagnostic data. Metadata is never reconstructed from a screenshot filename.

`parseExecutionResult(input)` strictly validates an unknown record. Passed executions require a screenshot and cannot contain failures. Failed executions require at least one failure and may have a screenshot. Failure codes are a stable schema-v1 union covering navigation, page, console, request, assertion, screenshot, and internal failures.

Diagnostics contain console-error strings, page-error strings, optional navigation status, and failed requests with only `url`, `method`, and sanitized `errorText`. Strict validation rejects headers, cookies, request or response bodies, and every other unknown property. Parsing removes URL credentials and fragments and replaces every query value with `[REDACTED]` while preserving query keys. This applies to the project base URL, route path, execution URL, and failed-request URLs. The runner remains responsible for sanitizing every free-form diagnostic string before constructing a result.

When `screenshotPath` is present, parsing recomputes `screenshotArtifactPath` from the record's explicit coordinate and requires an exact match. The validated result therefore returns `ScreenshotArtifactPath | null` without trusting an arbitrary serialized string.

`StatecraftReport` is the external JSON contract. Version 1 has this top-level shape:

```ts
interface StatecraftReport {
  schemaVersion: 1;
  generatedAt: string;
  project: { baseURL: string };
  summary: ReportSummary;
  executions: readonly ExecutionResult[];
}
```

Use `REPORT_SCHEMA_VERSION` when constructing the report, `parseReport(input)` when reading unknown data, and `serializeReport(report)` when writing `.statecraft/report/statecraft.json`. The serializer validates before producing deterministic two-space-indented JSON with a trailing newline; it does not read the clock or filesystem.

Report validation rejects unsupported versions, malformed RFC 3339 generation times, unknown properties, duplicate execution coordinates, conflicting route/state/viewport metadata, inconsistent counts or duration, and coverage that differs from `calculateCoverage` over the execution records. Empty execution selections remain representable with zero-valued summary and coverage metrics.

`ResultValidationError` and `ReportValidationError` use the stable `RESULT_INVALID` and `REPORT_INVALID` error codes. Their immutable issue arrays use the same Statecraft-owned issue categories and deterministic `$` paths as configuration validation. The underlying Zod schemas remain private.

## Exported types

- `StatecraftConfig`
- `ViewportDefinition`
- `RouteDefinition`
- `StateDefinition`
- `FailurePolicy`
- `MatrixCell` and `MatrixFilter`
- `CoverageObservation`, `CoverageMetric`, and `CoverageSummary`
- `ScreenshotArtifactPath`
- `ExecutionResult`, `ExecutionStatus`, `ExecutionFailure`, `ExecutionFailureCode`, `ExecutionDiagnostics`, and `FailedRequestDiagnostic`
- `StatecraftReport` and `ReportSummary`
- `StatecraftErrorCode`
- `ConfigValidationIssue`, `ResultValidationIssue`, `ReportValidationIssue`, and `ConfigValidationIssueCode`

Exported functions are `defineConfig`, `parseConfig`, `expandMatrix`, `calculateCoverage`, `screenshotArtifactPath`, `parseExecutionResult`, `parseReport`, and `serializeReport`. The `REPORT_SCHEMA_VERSION` constant is also exported.

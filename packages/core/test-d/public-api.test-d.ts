import {
  ConfigValidationError,
  StatecraftError,
  calculateCoverage,
  defineConfig,
  expandMatrix,
  parseConfig,
  screenshotArtifactPath,
  type ConfigValidationIssue,
  type ConfigValidationIssueCode,
  type CoverageMetric,
  type CoverageObservation,
  type CoverageSummary,
  type FailurePolicy,
  type MatrixCell,
  type MatrixFilter,
  type RouteDefinition,
  type ScreenshotArtifactPath,
  type StateDefinition,
  type StatecraftConfig,
  type StatecraftErrorCode,
  type ViewportDefinition,
} from "@statecraft/core";

const config = defineConfig({
  baseURL: "http://localhost:3000",
  failOn: { pageError: true },
  routes: [
    {
      id: "dashboard",
      path: "/dashboard",
      states: [{ id: "success", setup: "./scenarios/dashboard/success.ts" }],
    },
  ],
  themes: ["light"],
  viewports: { desktop: { height: 900, width: 1440 } },
});

const parsed: StatecraftConfig = parseConfig(config);
const filter: MatrixFilter = { routeIds: ["dashboard"] };
const matrix: readonly MatrixCell[] = expandMatrix(parsed, filter);
const coverageObservation: CoverageObservation = {
  passed: true,
  routeId: matrix[0]!.route.id,
  stateId: matrix[0]!.state.id,
  theme: matrix[0]!.theme,
  viewportId: matrix[0]!.viewportId,
};
const coverage: CoverageSummary = calculateCoverage(matrix, [
  coverageObservation,
]);
const executionCoverage: CoverageMetric = coverage.execution;
const invalidCoverageObservation: CoverageObservation = {
  // @ts-expect-error Coverage observations require a boolean pass result.
  passed: "yes",
  routeId: "dashboard",
  stateId: "success",
  theme: "light",
  viewportId: "desktop",
};
const screenshotPath: ScreenshotArtifactPath = screenshotArtifactPath(matrix[0]!);
// @ts-expect-error Artifact paths must come from the safe encoder.
const forgedScreenshotPath: ScreenshotArtifactPath =
  ".statecraft/artifacts/../../outside/screenshot.png";
const validationError: StatecraftError = new ConfigValidationError([]);
void parsed;
void matrix;
void coverage;
void executionCoverage;
void invalidCoverageObservation;
void screenshotPath;
void forgedScreenshotPath;
void validationError;

export type PublicTypeContract = {
  config: StatecraftConfig;
  coverage: CoverageSummary;
  errorCode: StatecraftErrorCode;
  failurePolicy: FailurePolicy;
  issue: ConfigValidationIssue;
  issueCode: ConfigValidationIssueCode;
  route: RouteDefinition;
  state: StateDefinition;
  viewport: ViewportDefinition;
};

defineConfig({
  baseURL: "http://localhost:3000",
  routes: [{ id: "dashboard", path: "/dashboard", states: [{ id: "success", setup: "./scenario.ts" }] }],
  themes: ["light"],
  viewports: { desktop: { height: 900, width: 1440 } },
  // @ts-expect-error Unknown configuration properties must be rejected.
  telemetry: true,
});

defineConfig({
  baseURL: "http://localhost:3000",
  failOn: {
    // @ts-expect-error Failure policy values must remain boolean.
    pageError: "yes",
  },
  routes: [{ id: "dashboard", path: "/dashboard", states: [{ id: "success", setup: "./scenario.ts" }] }],
  themes: ["light"],
  viewports: { desktop: { height: 900, width: 1440 } },
});

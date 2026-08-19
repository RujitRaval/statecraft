import {
  ConfigValidationError,
  REPORT_SCHEMA_VERSION,
  ReportValidationError,
  ResultValidationError,
  StatecraftError,
  calculateCoverage,
  defineConfig,
  expandMatrix,
  parseConfig,
  parseExecutionResult,
  parseReport,
  screenshotArtifactPath,
  serializeReport,
  type ConfigValidationIssue,
  type ConfigValidationIssueCode,
  type CoverageMetric,
  type CoverageObservation,
  type CoverageSummary,
  type FailurePolicy,
  type ExecutionDiagnostics,
  type ExecutionFailure,
  type ExecutionFailureCode,
  type ExecutionResult,
  type ExecutionStatus,
  type FailedRequestDiagnostic,
  type MatrixCell,
  type MatrixFilter,
  type RouteDefinition,
  type ReportSummary,
  type ReportValidationIssue,
  type ResultValidationIssue,
  type ScreenshotArtifactPath,
  type StateDefinition,
  type StatecraftConfig,
  type StatecraftReport,
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
const executionFailureCode: ExecutionFailureCode = "ASSERTION_FAILED";
const executionStatus: ExecutionStatus = "passed";
const executionFailure: ExecutionFailure = {
  code: executionFailureCode,
  message: "Expected heading to be visible.",
};
const failedRequest: FailedRequestDiagnostic = {
  errorText: "net::ERR_CONNECTION_RESET",
  method: "GET",
  url: "http://localhost:3000/api/dashboard",
};
const diagnostics: ExecutionDiagnostics = {
  consoleErrors: [],
  failedRequests: [failedRequest],
  navigationStatus: 200,
  pageErrors: [],
};
const execution: ExecutionResult = parseExecutionResult({
  diagnostics,
  durationMs: 120,
  failures: [],
  routeId: "dashboard",
  routePath: "/dashboard",
  scenarioSource: "./scenarios/dashboard/success.ts",
  screenshotPath,
  stateId: "success",
  status: executionStatus,
  theme: "light",
  url: "http://localhost:3000/dashboard",
  viewport: matrix[0]!.viewport,
  viewportId: "desktop",
});
const reportSummary: ReportSummary = {
  coverage,
  durationMs: 120,
  executions: 1,
  failed: 0,
  passed: 1,
  routes: 1,
  states: 1,
};
const report: StatecraftReport = parseReport({
  executions: [execution],
  generatedAt: "2026-08-19T14:30:00.000Z",
  project: { baseURL: config.baseURL },
  schemaVersion: REPORT_SCHEMA_VERSION,
  summary: reportSummary,
});
const serializedReport: string = serializeReport(report);
const resultValidationError: StatecraftError = new ResultValidationError([]);
const reportValidationError: StatecraftError = new ReportValidationError([]);
const resultIssue: ResultValidationIssue = {
  code: "invalid_value",
  message: "Invalid result.",
  path: "$.status",
};
const reportIssue: ReportValidationIssue = resultIssue;
void parsed;
void matrix;
void coverage;
void executionCoverage;
void invalidCoverageObservation;
void screenshotPath;
void forgedScreenshotPath;
void validationError;
void executionFailure;
void execution;
void report;
void serializedReport;
void resultValidationError;
void reportValidationError;
void reportIssue;

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

const invalidReport: StatecraftReport = {
  ...report,
  // @ts-expect-error Only report schema version 1 is supported.
  schemaVersion: 2,
};
const invalidFailure: ExecutionFailure = {
  // @ts-expect-error Failure codes are a stable closed contract in schema v1.
  code: "UNKNOWN",
  message: "Unknown failure.",
};
const invalidExecution: ExecutionResult = {
  ...execution,
  // @ts-expect-error Serialized screenshot paths must be runtime-validated.
  screenshotPath: ".statecraft/artifacts/dashboard/success/desktop-light.png",
};
void invalidReport;
void invalidFailure;
void invalidExecution;

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

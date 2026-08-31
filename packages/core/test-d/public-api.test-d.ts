import {
  ConfigValidationError,
  REPORT_SCHEMA_VERSION,
  ReportValidationError,
  ResultValidationError,
  UIWitnessError,
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
  type ReportExecutionResult,
  type ReportScreenshotArtifactPath,
  type ReportSummary,
  type ReportValidationIssue,
  type ResultValidationIssue,
  type ScreenshotArtifactPath,
  type StateDefinition,
  type UIWitnessConfig,
  type UIWitnessReport,
  type UIWitnessErrorCode,
  type ViewportDefinition,
} from "uiwitness-core";

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

const parsed: UIWitnessConfig = parseConfig(config);
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
const validationError: UIWitnessError = new ConfigValidationError([]);
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
const report: UIWitnessReport = parseReport({
  executions: [execution],
  generatedAt: "2026-08-19T14:30:00.000Z",
  project: { baseURL: config.baseURL },
  schemaVersion: REPORT_SCHEMA_VERSION,
  summary: reportSummary,
});
const serializedReport: string = serializeReport(report);
const reportExecution: ReportExecutionResult = report.executions[0]!;
const readableScreenshotPath: ReportScreenshotArtifactPath | null =
  reportExecution.screenshotPath;
const resultValidationError: UIWitnessError = new ResultValidationError([]);
const reportValidationError: UIWitnessError = new ReportValidationError([]);
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
void reportExecution;
void readableScreenshotPath;
void resultValidationError;
void reportValidationError;
void reportIssue;

export type PublicTypeContract = {
  config: UIWitnessConfig;
  coverage: CoverageSummary;
  errorCode: UIWitnessErrorCode;
  failurePolicy: FailurePolicy;
  issue: ConfigValidationIssue;
  issueCode: ConfigValidationIssueCode;
  route: RouteDefinition;
  state: StateDefinition;
  viewport: ViewportDefinition;
};

const invalidReport: UIWitnessReport = {
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

// @ts-expect-error Legacy StatecraftConfig aliases are intentionally not exported.
type LegacyConfig = import("uiwitness-core").StatecraftConfig;
// @ts-expect-error Legacy StatecraftReport aliases are intentionally not exported.
type LegacyReport = import("uiwitness-core").StatecraftReport;
// @ts-expect-error Legacy StatecraftError aliases are intentionally not exported.
type LegacyError = typeof import("uiwitness-core").StatecraftError;
// @ts-expect-error Legacy StatecraftErrorCode aliases are intentionally not exported.
type LegacyErrorCode = import("uiwitness-core").StatecraftErrorCode;
void (null as unknown as LegacyConfig);
void (null as unknown as LegacyReport);
void (null as unknown as LegacyError);
void (null as unknown as LegacyErrorCode);

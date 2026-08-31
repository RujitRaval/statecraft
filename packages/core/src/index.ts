export {
  defineConfig,
  parseConfig,
} from "./config.js";
export type {
  FailurePolicy,
  RouteDefinition,
  StateDefinition,
  UIWitnessConfig,
  ViewportDefinition,
} from "./config.js";
export {
  ConfigValidationError,
  ReportValidationError,
  ResultValidationError,
  UIWitnessError,
} from "./errors.js";
export type {
  ConfigValidationIssue,
  ConfigValidationIssueCode,
  ReportValidationIssue,
  ResultValidationIssue,
  UIWitnessErrorCode,
} from "./errors.js";
export { expandMatrix } from "./matrix.js";
export type { MatrixCell, MatrixFilter } from "./matrix.js";
export { screenshotArtifactPath } from "./artifacts.js";
export type {
  LegacyScreenshotArtifactPath,
  ReportScreenshotArtifactPath,
  ScreenshotArtifactPath,
} from "./artifacts.js";
export { calculateCoverage } from "./coverage.js";
export type {
  CoverageMetric,
  CoverageObservation,
  CoverageSummary,
} from "./coverage.js";
export {
  REPORT_SCHEMA_VERSION,
  parseExecutionResult,
  parseReport,
  serializeReport,
} from "./results.js";
export type {
  ExecutionDiagnostics,
  ExecutionFailure,
  ExecutionFailureCode,
  ExecutionResult,
  ExecutionStatus,
  FailedRequestDiagnostic,
  ReportExecutionResult,
  ReportSummary,
  UIWitnessReport,
} from "./results.js";

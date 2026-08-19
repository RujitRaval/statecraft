export {
  defineConfig,
  parseConfig,
} from "./config.js";
export type {
  FailurePolicy,
  RouteDefinition,
  StateDefinition,
  StatecraftConfig,
  ViewportDefinition,
} from "./config.js";
export {
  ConfigValidationError,
  ReportValidationError,
  ResultValidationError,
  StatecraftError,
} from "./errors.js";
export type {
  ConfigValidationIssue,
  ConfigValidationIssueCode,
  ReportValidationIssue,
  ResultValidationIssue,
  StatecraftErrorCode,
} from "./errors.js";
export { expandMatrix } from "./matrix.js";
export type { MatrixCell, MatrixFilter } from "./matrix.js";
export { screenshotArtifactPath } from "./artifacts.js";
export type { ScreenshotArtifactPath } from "./artifacts.js";
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
  ReportSummary,
  StatecraftReport,
} from "./results.js";

export {
  CANONICAL_JSON_ALGORITHM,
  canonicalizeJson,
  canonicalJsonDigest,
} from "./canonical-json.js";
export type { JsonValue, Sha256Digest } from "./canonical-json.js";
export {
  CONTRACT_DIGEST_ALGORITHM,
  CONTRACT_FAILURE_CODES,
  CONTRACT_SCHEMA_VERSION,
  canonicalizeContract,
  contractDigest,
  parseContract,
} from "./contract.js";
export type {
  ContractCoordinate,
  ContractException,
  ContractExpectation,
  ContractFailureCode,
  UIWitnessContract,
} from "./contract.js";
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
  CanonicalJsonError,
  ConfigValidationError,
  ContractValidationError,
  ReportValidationError,
  ResultValidationError,
  UIWitnessError,
} from "./errors.js";
export type {
  CanonicalJsonIssue,
  ConfigValidationIssue,
  ConfigValidationIssueCode,
  ContractValidationIssue,
  ContractValidationIssueCode,
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

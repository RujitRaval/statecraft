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
  CONTRACT_CONFIG_DIGEST_ALGORITHM,
  compareContract,
  contractConfigDigest,
} from "./contract-comparison.js";
export type {
  CompareContractOptions,
  ContractConfigurationCoordinate,
  ContractExecutionObservation,
} from "./contract-comparison.js";
export {
  CONTRACT_FINDING_KINDS,
  CONTRACT_FINDING_PRECEDENCE,
  contractVerdictStatus,
} from "./contract-verdict.js";
export {
  CONTRACT_METADATA_SCHEMA_VERSION,
  CONTRACT_PROPOSAL_OPERATIONS,
  CONTRACT_PROPOSAL_SCHEMA_VERSION,
  CONTRACT_SOURCE_SCHEMA_VERSION,
  applyContractProposal,
  contractProposalDigest,
  contractProposalSourceDigest,
  createContractProposal,
  createContractProposalSource,
  emptyContractProposalMetadata,
  parseContractProposal,
  parseContractProposalMetadata,
  parseContractProposalSource,
  serializeContractProposal,
  serializeContractProposalMetadata,
  serializeContractProposalSource,
  withContractProposalAnnotation,
} from "./contract-proposal.js";
export {
  COMMITTED_GENERATION_SCHEMA_VERSION,
  GENERATION_ARTIFACT_ROLES,
  GENERATION_MANIFEST_SCHEMA_VERSION,
  generationManifestDigest,
  parseCommittedGeneration,
  parseGenerationManifest,
  serializeCommittedGeneration,
  serializeGenerationManifest,
} from "./generation.js";
export type {
  GenerationArtifactDescriptor,
  GenerationArtifactRole,
  UIWitnessCommittedGeneration,
  UIWitnessGenerationManifest,
} from "./generation.js";
export type {
  ContractProposal,
  ContractProposalChange,
  ContractProposalMetadata,
  ContractProposalOperation,
  ContractProposalSource,
  ContractSourceDigest,
  ContractSourceExecution,
  ProposedExpectation,
} from "./contract-proposal.js";
export type {
  ChangedKnownFailureContractFinding,
  ContractActualOutcome,
  ContractComparisonResult,
  ContractFinding,
  ContractFindingKind,
  ContractRunErrorReason,
  ContractVerdictStatus,
  ExpiredExceptionContractFinding,
  KnownFailureContractFinding,
  MatchedContractFinding,
  MissingCoordinateContractFinding,
  RecoveredKnownFailureContractFinding,
  RegressionContractFinding,
  RunErrorContractFinding,
  UnacceptedAdditionContractFinding,
  UnacceptedConfigDriftContractFinding,
} from "./contract-verdict.js";
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
  ContractProposalValidationError,
  GenerationValidationError,
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
  GenerationValidationIssue,
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

import {
  CANONICAL_JSON_ALGORITHM,
  COMMITTED_GENERATION_SCHEMA_VERSION,
  CONTRACT_CONFIG_DIGEST_ALGORITHM,
  CONTRACT_DIGEST_ALGORITHM,
  CONTRACT_FAILURE_CODES,
  CONTRACT_FINDING_KINDS,
  CONTRACT_FINDING_PRECEDENCE,
  CONTRACT_METADATA_SCHEMA_VERSION,
  CONTRACT_PROPOSAL_OPERATIONS,
  CONTRACT_PROPOSAL_SCHEMA_VERSION,
  CONTRACT_SCHEMA_VERSION,
  CONTRACT_SOURCE_SCHEMA_VERSION,
  CanonicalJsonError,
  ConfigValidationError,
  ContractProposalValidationError,
  ContractValidationError,
  GENERATION_ARTIFACT_ROLES,
  GENERATION_MANIFEST_SCHEMA_VERSION,
  GenerationValidationError,
  REPORT_SCHEMA_VERSION,
  ReportValidationError,
  ResultValidationError,
  UIWitnessError,
  calculateCoverage,
  canonicalizeContract,
  canonicalizeJson,
  canonicalJsonDigest,
  compareContract,
  applyContractProposal,
  contractConfigDigest,
  contractDigest,
  contractProposalDigest,
  contractProposalSourceDigest,
  contractVerdictStatus,
  createContractProposal,
  createContractProposalSource,
  defineConfig,
  emptyContractProposalMetadata,
  expandMatrix,
  generationManifestDigest,
  parseCommittedGeneration,
  parseConfig,
  parseContract,
  parseContractProposal,
  parseContractProposalMetadata,
  parseContractProposalSource,
  parseExecutionResult,
  parseGenerationManifest,
  parseReport,
  screenshotArtifactPath,
  serializeCommittedGeneration,
  serializeContractProposal,
  serializeContractProposalMetadata,
  serializeContractProposalSource,
  serializeGenerationManifest,
  serializeReport,
  withContractProposalAnnotation,
  type CanonicalJsonIssue,
  type ConfigValidationIssue,
  type ConfigValidationIssueCode,
  type ContractCoordinate,
  type ContractComparisonResult,
  type ContractConfigurationCoordinate,
  type ContractExecutionObservation,
  type ContractException,
  type ContractExpectation,
  type ContractFailureCode,
  type ContractProposal,
  type ContractProposalChange,
  type ContractProposalMetadata,
  type ContractProposalOperation,
  type ContractProposalSource,
  type ContractSourceDigest,
  type ContractSourceExecution,
  type ContractValidationIssue,
  type ContractValidationIssueCode,
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
  type GenerationArtifactDescriptor,
  type GenerationArtifactRole,
  type GenerationValidationIssue,
  type JsonValue,
  type MatrixCell,
  type MatrixFilter,
  type RouteDefinition,
  type ReportExecutionResult,
  type ReportScreenshotArtifactPath,
  type ReportSummary,
  type ReportValidationIssue,
  type ResultValidationIssue,
  type ProposedExpectation,
  type ScreenshotArtifactPath,
  type Sha256Digest,
  type StateDefinition,
  type UIWitnessConfig,
  type UIWitnessCommittedGeneration,
  type UIWitnessContract,
  type UIWitnessGenerationManifest,
  type UIWitnessReport,
  type UIWitnessErrorCode,
  type ViewportDefinition,
} from "uiwitness-core";

const contractException: ContractException = {
  createdOn: "2026-09-02",
  expiresOn: "2026-09-03",
  owner: "checkout-team",
  reason: "UIW-1842 tracks the repair",
};
const contractExpectation: ContractExpectation = {
  exception: contractException,
  failureCodes: ["ASSERTION_FAILED"],
  status: "failed",
};
const configDigest: Sha256Digest = `sha256:${"a".repeat(64)}`;
const contractCoordinate: ContractCoordinate = {
  configFingerprint: configDigest,
  expected: contractExpectation,
  id: "dashboard/success/desktop/light",
  routeId: "dashboard",
  routePath: "/dashboard",
  scenarioSource: "./scenarios/dashboard/success.mjs",
  stateId: "success",
  theme: "light",
  viewport: { height: 900, width: 1440 },
  viewportId: "desktop",
};
const contractSource = JSON.stringify({
  configDigest,
  coordinates: [contractCoordinate],
  schemaVersion: CONTRACT_SCHEMA_VERSION,
});
const stateContract: UIWitnessContract = parseContract(contractSource);
const canonicalValue: JsonValue = { b: 2, a: 1 };
const canonicalText: string = canonicalizeJson(canonicalValue);
const canonicalDigest: Sha256Digest = canonicalJsonDigest(canonicalValue);
const canonicalContract: string = canonicalizeContract(stateContract);
const stateContractDigest: Sha256Digest = contractDigest(stateContract);
const canonicalError: UIWitnessError = new CanonicalJsonError([]);
const contractError: UIWitnessError = new ContractValidationError([]);
const canonicalIssue: CanonicalJsonIssue = {
  code: "invalid_value",
  message: "Invalid canonical value.",
  path: "$",
};
const contractIssueCode: ContractValidationIssueCode = "invalid_syntax";
const contractIssue: ContractValidationIssue = {
  code: contractIssueCode,
  message: "Invalid contract.",
  path: "$",
};
const knownFailureCode: ContractFailureCode = CONTRACT_FAILURE_CODES[0];
void CANONICAL_JSON_ALGORITHM;
void CONTRACT_CONFIG_DIGEST_ALGORITHM;
void CONTRACT_DIGEST_ALGORITHM;
void stateContract;
void canonicalText;
void canonicalDigest;
void canonicalContract;
void stateContractDigest;
void canonicalError;
void contractError;
void canonicalIssue;
void contractIssue;
void knownFailureCode;

const comparisonConfiguration: ContractConfigurationCoordinate = {
  configFingerprint: configDigest,
  id: contractCoordinate.id,
  routeId: contractCoordinate.routeId,
  routePath: contractCoordinate.routePath,
  scenarioSource: contractCoordinate.scenarioSource,
  stateId: contractCoordinate.stateId,
  theme: contractCoordinate.theme,
  viewport: contractCoordinate.viewport,
  viewportId: contractCoordinate.viewportId,
};
const comparisonExecution: ContractExecutionObservation = {
  failures: [{ code: "ASSERTION_FAILED" }],
  routeId: contractCoordinate.routeId,
  stateId: contractCoordinate.stateId,
  status: "failed",
  theme: contractCoordinate.theme,
  viewportId: contractCoordinate.viewportId,
};
const comparisonConfigDigest: Sha256Digest = contractConfigDigest([
  comparisonConfiguration,
]);
const comparisonContract: UIWitnessContract = {
  ...stateContract,
  configDigest: comparisonConfigDigest,
};
const comparison: ContractComparisonResult = compareContract({
  complete: true,
  configuration: [comparisonConfiguration],
  contract: comparisonContract,
  executions: [comparisonExecution],
  now: () => new Date("2026-09-03T00:00:00.000Z"),
});
const comparisonStatus = contractVerdictStatus(comparison.findings);
void CONTRACT_FINDING_KINDS;
void CONTRACT_FINDING_PRECEDENCE;
void comparison;
void comparisonStatus;

const proposalExecution: ContractSourceExecution = {
  actual: { status: "passed" },
  id: comparisonConfiguration.id,
};
const proposalSource: ContractProposalSource = createContractProposalSource({
  configuration: [comparisonConfiguration],
  contract: null,
  evaluatedOn: "2026-09-03",
  executions: [proposalExecution],
  runDigest: configDigest,
});
const proposal: ContractProposal = createContractProposal(proposalSource, "1.0.0");
const proposalChange: ContractProposalChange = proposal.changes[0]!;
const proposalOperation: ContractProposalOperation = CONTRACT_PROPOSAL_OPERATIONS[0];
const proposedExpectation: ProposedExpectation = { status: "passed" };
const sourceDigest: ContractSourceDigest = "absent";
const metadata: ContractProposalMetadata = emptyContractProposalMetadata(proposal);
const annotatedMetadata = withContractProposalAnnotation(
  proposal,
  metadata,
  proposalChange.id,
  {
    createdOn: "2026-09-03",
    expiresOn: "2026-09-04",
    owner: "quality-team",
    reason: "UIW-2041 tracks repair",
  },
  "2026-09-03",
);
const proposalText = serializeContractProposal(proposal);
const sourceText = serializeContractProposalSource(proposalSource);
const metadataText = serializeContractProposalMetadata(annotatedMetadata);
const proposalContract: UIWitnessContract = applyContractProposal({
  acceptedOn: "2026-09-03",
  changeIds: [proposalChange.id],
  metadata,
  proposal,
  source: proposalSource,
});
const proposalError: UIWitnessError = new ContractProposalValidationError([]);
void CONTRACT_METADATA_SCHEMA_VERSION;
void CONTRACT_PROPOSAL_SCHEMA_VERSION;
void CONTRACT_SOURCE_SCHEMA_VERSION;
void proposalOperation;
void proposedExpectation;
void sourceDigest;
void parseContractProposal(proposalText);
void parseContractProposalSource(sourceText);
void parseContractProposalMetadata(metadataText);
void contractProposalDigest(proposal);
void contractProposalSourceDigest(proposalSource);
void proposalContract;
void proposalError;

const generationArtifacts: readonly GenerationArtifactDescriptor[] = [
  { bytes: 4, digest: configDigest, mutable: false, path: ".uiwitness/report/index.html", role: "report-html" },
  { bytes: 6, digest: canonicalDigest, mutable: false, path: ".uiwitness/report/uiwitness.json", role: "report-json" },
];
const generationRole: GenerationArtifactRole = GENERATION_ARTIFACT_ROLES[0];
const generation: UIWitnessGenerationManifest = parseGenerationManifest(
  serializeGenerationManifest({
    artifacts: generationArtifacts,
    complete: true,
    reportDigest: canonicalDigest,
    runDigest: null,
    schemaVersion: GENERATION_MANIFEST_SCHEMA_VERSION,
    sourceGenerationDigests: [],
    toolVersion: "1.0.0",
  }),
);
const generationDigest = generationManifestDigest(generation);
const committedGeneration: UIWitnessCommittedGeneration = parseCommittedGeneration(
  serializeCommittedGeneration({
    manifestDigest: generationDigest,
    manifestPath: `.uiwitness/generations/${generationDigest.slice(7)}.manifest.json`,
    schemaVersion: COMMITTED_GENERATION_SCHEMA_VERSION,
    sourceGenerationDigests: [],
  }),
);
const generationError: UIWitnessError = new GenerationValidationError([]);
const generationIssue: GenerationValidationIssue = contractIssue;
void generationRole;
void committedGeneration;
void generationError;
void generationIssue;

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
  contract: UIWitnessContract;
  contractCoordinate: ContractCoordinate;
  contractException: ContractException;
  contractExpectation: ContractExpectation;
  contractFailureCode: ContractFailureCode;
  contractIssue: ContractValidationIssue;
  contractIssueCode: ContractValidationIssueCode;
  coverage: CoverageSummary;
  errorCode: UIWitnessErrorCode;
  failurePolicy: FailurePolicy;
  issue: ConfigValidationIssue;
  issueCode: ConfigValidationIssueCode;
  json: JsonValue;
  route: RouteDefinition;
  sha256: Sha256Digest;
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

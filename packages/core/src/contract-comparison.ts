import { canonicalJsonDigest, type JsonValue, type Sha256Digest } from "./canonical-json.js";
import { z, type ZodIssue } from "zod";
import {
  CONTRACT_SCHEMA_VERSION,
  digestValidatedContract,
  validatedContractSnapshot,
  type ContractCoordinate,
  type UIWitnessContract,
} from "./contract.js";
import {
  ConfigValidationError,
  ContractValidationError,
  ResultValidationError,
  type ConfigValidationIssueCode,
} from "./errors.js";
import {
  CONTRACT_FINDING_PRECEDENCE,
  contractVerdictStatus,
  sameContractFailureCodes,
  type ContractActualOutcome,
  type ContractComparisonResult,
  type ContractFinding,
  type ContractRunErrorReason,
  type RunErrorContractFinding,
} from "./contract-verdict.js";
import {
  EXECUTION_FAILURE_CODES,
  type ExecutionFailure,
  type ExecutionStatus,
} from "./results.js";

/** Current configuration metadata required for contract comparison. */
export type ContractConfigurationCoordinate = Omit<ContractCoordinate, "expected">;

/** Fresh message-free execution input accepted by the comparison engine. */
export interface ContractExecutionObservation {
  readonly failures: readonly Pick<ExecutionFailure, "code">[];
  readonly routeId: string;
  readonly stateId: string;
  readonly status: ExecutionStatus;
  readonly theme: string;
  readonly viewportId: string;
}

export interface CompareContractOptions {
  /** False when any run-level failure makes the execution set untrustworthy. */
  readonly complete: boolean;
  readonly configuration: readonly ContractConfigurationCoordinate[];
  readonly contract: UIWitnessContract;
  readonly executions: readonly ContractExecutionObservation[];
  /** Called exactly once; inject in tests and coordinated shard runs. */
  readonly now?: (() => Date) | undefined;
}

/** Domain normalization used for current configuration inventory digests. */
export const CONTRACT_CONFIG_DIGEST_ALGORITHM = "jcs-rfc8785+config-v1" as const;

const zeroDigest = `sha256:${"0".repeat(64)}` as Sha256Digest;
const maximumCoordinates = 10_000;
const maximumExecutionFailures = 100;
const maximumIssues = 100;
const maximumTextLength = 1_024;
const identifierPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const identifierSchema = z.string().max(maximumTextLength).regex(identifierPattern);
const observationSchema = z
  .strictObject({
    failures: z
      .array(z.strictObject({ code: z.enum(EXECUTION_FAILURE_CODES) }))
      .max(maximumExecutionFailures),
    routeId: identifierSchema,
    stateId: identifierSchema,
    status: z.enum(["failed", "passed"]),
    theme: identifierSchema,
    viewportId: identifierSchema,
  })
  .superRefine((observation, context) => {
    if (observation.status === "passed" && observation.failures.length > 0) {
      context.addIssue({
        code: "custom",
        message: "Passed execution observations cannot contain failures.",
        path: ["failures"],
      });
    }
    if (observation.status === "failed" && observation.failures.length === 0) {
      context.addIssue({
        code: "custom",
        message: "Failed execution observations must contain at least one failure.",
        path: ["failures"],
      });
    }
  });

function issueCode(issue: ZodIssue): ConfigValidationIssueCode {
  if (issue.code === "invalid_type") {
    return "invalid_type";
  }
  if (issue.code === "unrecognized_keys") {
    return "unrecognized_key";
  }
  return "invalid_value";
}

function issuePath(index: number, issue: ZodIssue): string {
  return issue.path.reduce<string>((path, segment) => (
    typeof segment === "number"
      ? `${path}[${segment}]`
      : `${path}.${String(segment)}`
  ), `$.executions[${index}]`);
}

function validateExecutions(
  executions: readonly ContractExecutionObservation[],
): readonly ContractExecutionObservation[] {
  if (!Array.isArray(executions) || executions.length > maximumCoordinates) {
    throw new ResultValidationError([{
      code: Array.isArray(executions) ? "invalid_value" : "invalid_type",
      message: `Execution observations must be an array of at most ${maximumCoordinates} entries.`,
      path: "$.executions",
    }]);
  }
  const validated: ContractExecutionObservation[] = [];
  const issues: { code: ConfigValidationIssueCode; message: string; path: string }[] = [];
  let omitted = false;
  for (const [index, execution] of executions.entries()) {
    const result = observationSchema.safeParse(execution);
    if (result.success) {
      validated.push(result.data);
      continue;
    }
    for (const issue of result.error.issues) {
      if (issues.length < maximumIssues - 1) {
        issues.push({
          code: issueCode(issue),
          message: issue.message,
          path: issuePath(index, issue),
        });
      } else {
        omitted = true;
        break;
      }
    }
    if (omitted) break;
  }
  if (omitted) {
    issues.push({
      code: "invalid_value",
      message: `Additional execution observation issues were omitted after the first ${maximumIssues - 1}.`,
      path: "$.executions",
    });
  }
  if (issues.length > 0) {
    throw new ResultValidationError(issues);
  }
  return validated;
}

function coordinateId(coordinate: {
  readonly routeId: string;
  readonly stateId: string;
  readonly theme: string;
  readonly viewportId: string;
}): string {
  return [
    coordinate.routeId,
    coordinate.stateId,
    coordinate.viewportId,
    coordinate.theme,
  ].join("/");
}

function compareConfigurationCoordinates(
  left: ContractConfigurationCoordinate,
  right: ContractConfigurationCoordinate,
): number {
  const sortable = (value: unknown): string => typeof value === "string" ? value : "";
  const leftTuple = [left.routeId, left.stateId, left.viewportId, left.theme].map(sortable);
  const rightTuple = [right.routeId, right.stateId, right.viewportId, right.theme].map(sortable);
  for (let index = 0; index < leftTuple.length; index += 1) {
    if (leftTuple[index]! < rightTuple[index]!) {
      return -1;
    }
    if (leftTuple[index]! > rightTuple[index]!) {
      return 1;
    }
  }
  return 0;
}

function sortedConfiguration(
  configuration: readonly ContractConfigurationCoordinate[],
): readonly ContractConfigurationCoordinate[] {
  return [...configuration].sort(compareConfigurationCoordinates);
}

function configDigestProjection(
  configuration: readonly ContractConfigurationCoordinate[],
): JsonValue {
  return sortedConfiguration(configuration).map((coordinate) => ({
    configFingerprint: coordinate.configFingerprint,
    id: coordinate.id,
  }));
}

function configurationCoordinate(
  coordinate: ContractCoordinate,
): ContractConfigurationCoordinate {
  return {
    configFingerprint: coordinate.configFingerprint,
    id: coordinate.id,
    routeId: coordinate.routeId,
    routePath: coordinate.routePath,
    scenarioSource: coordinate.scenarioSource,
    stateId: coordinate.stateId,
    theme: coordinate.theme,
    viewport: coordinate.viewport,
    viewportId: coordinate.viewportId,
  };
}

/** Hashes the canonical ordered coordinate/fingerprint inventory. */
export function contractConfigDigest(
  configuration: readonly ContractConfigurationCoordinate[],
): Sha256Digest {
  return canonicalJsonDigest(configDigestProjection(configuration));
}

function validateConfiguration(
  configuration: readonly ContractConfigurationCoordinate[],
): readonly ContractConfigurationCoordinate[] {
  if (!Array.isArray(configuration) || configuration.length > maximumCoordinates) {
    throw new ConfigValidationError([{
      code: Array.isArray(configuration) ? "invalid_value" : "invalid_type",
      message: `Configuration must be an array of at most ${maximumCoordinates} coordinates.`,
      path: "$.configuration",
    }]);
  }
  const invalidIndex = configuration.findIndex((coordinate) => (
    coordinate === null || typeof coordinate !== "object" || Array.isArray(coordinate)
  ));
  if (invalidIndex >= 0) {
    throw new ConfigValidationError([{
      code: "invalid_type",
      message: "Configuration coordinates must be objects.",
      path: `$.configuration[${invalidIndex}]`,
    }]);
  }
  const sorted = sortedConfiguration(configuration);
  const syntheticContract: UIWitnessContract = {
    configDigest: zeroDigest,
    coordinates: sorted.map((coordinate) => ({
      ...coordinate,
      expected: { status: "passed" },
    })),
    schemaVersion: CONTRACT_SCHEMA_VERSION,
  };
  try {
    const validated = validatedContractSnapshot(syntheticContract);
    return validated.coordinates.map(configurationCoordinate);
  } catch (error) {
    if (error instanceof ContractValidationError) {
      throw new ConfigValidationError(error.issues.map((issue) => ({
        code: issue.code === "invalid_syntax" ? "invalid_value" : issue.code,
        message: issue.message,
        path: issue.path.replace(/^\$\.coordinates/u, "$.configuration"),
      })));
    }
    throw error;
  }
}

function actualOutcome(
  execution: ContractExecutionObservation,
): ContractActualOutcome {
  if (execution.status === "passed") {
    return Object.freeze({ status: "passed" });
  }
  const failureCodes = Object.freeze(
    [...new Set(execution.failures.map((failure) => failure.code))].sort(),
  );
  return Object.freeze({ failureCodes, status: "failed" });
}

function evaluatedOn(now: (() => Date) | undefined): string {
  const value = (now ?? (() => new Date()))();
  if (!(value instanceof Date) || !Number.isFinite(value.valueOf())) {
    throw new RangeError("The contract comparison clock must return a valid Date.");
  }
  const date = value.toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(date) || date.startsWith("0000-")) {
    throw new RangeError("The contract comparison clock must use years 0001 through 9999.");
  }
  return date;
}

function rejectFutureExceptions(contract: UIWitnessContract, date: string): void {
  const issues = contract.coordinates.flatMap((coordinate, index) => (
    coordinate.expected.status === "failed" &&
      coordinate.expected.exception.createdOn > date
      ? [{
          code: "invalid_value" as const,
          message: "Exception creation dates cannot be later than the evaluation date.",
          path: `$.coordinates[${index}].expected.exception.createdOn`,
        }]
      : []
  ));
  if (issues.length > 0) {
    throw new ContractValidationError(issues);
  }
}

function duplicateIds<T>(
  values: readonly T[],
  idFor: (value: T) => string,
): readonly string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    const id = idFor(value);
    if (seen.has(id)) {
      duplicates.add(id);
    }
    seen.add(id);
  }
  return [...duplicates].sort();
}

function runErrors(
  configuration: readonly ContractConfigurationCoordinate[],
  executions: readonly ContractExecutionObservation[],
  declaredComplete: boolean,
): readonly RunErrorContractFinding[] {
  if (!declaredComplete) {
    return [Object.freeze({
      id: null,
      kind: "run-error",
      reasons: Object.freeze(["declared-incomplete"] as const),
    })];
  }

  const reasonsById = new Map<string, Set<ContractRunErrorReason>>();
  const addReason = (id: string, reason: ContractRunErrorReason): void => {
    const reasons = reasonsById.get(id) ?? new Set<ContractRunErrorReason>();
    reasons.add(reason);
    reasonsById.set(id, reasons);
  };
  for (const id of duplicateIds(executions, coordinateId)) {
    addReason(id, "duplicate-execution-coordinate");
  }

  const configuredIds = new Set(configuration.map((coordinate) => coordinate.id));
  const executedIds = new Set(executions.map(coordinateId));
  for (const id of [...configuredIds].filter((candidate) => !executedIds.has(candidate)).sort()) {
    addReason(id, "missing-execution");
  }
  for (const id of [...executedIds].filter((candidate) => !configuredIds.has(candidate)).sort()) {
    addReason(id, "unexpected-execution");
  }
  return [...reasonsById]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([id, reasons]) => Object.freeze({
      id,
      kind: "run-error" as const,
      reasons: Object.freeze([...reasons].sort()),
    }));
}

function findingOrder(left: ContractFinding, right: ContractFinding): number {
  const leftId = left.id ?? "";
  const rightId = right.id ?? "";
  if (leftId < rightId) {
    return -1;
  }
  if (leftId > rightId) {
    return 1;
  }
  return CONTRACT_FINDING_PRECEDENCE[left.kind] -
    CONTRACT_FINDING_PRECEDENCE[right.kind];
}

function frozenExpected(expected: ContractCoordinate["expected"]): ContractCoordinate["expected"] {
  if (expected.status === "passed") {
    return Object.freeze({ status: "passed" });
  }
  return Object.freeze({
    exception: Object.freeze({ ...expected.exception }),
    failureCodes: Object.freeze([...expected.failureCodes]),
    status: "failed",
  });
}

function frozenActual(actual: ContractActualOutcome): ContractActualOutcome {
  return actual.status === "passed"
    ? Object.freeze({ status: "passed" })
    : Object.freeze({
        failureCodes: Object.freeze([...actual.failureCodes]),
        status: "failed",
      });
}

function frozenFinding(finding: ContractFinding): ContractFinding {
  const copy: Record<string, unknown> = { ...finding };
  if ("actual" in finding && finding.actual !== null) {
    copy["actual"] = frozenActual(finding.actual);
  }
  if ("expected" in finding && finding.expected !== null) {
    copy["expected"] = frozenExpected(finding.expected);
  }
  if (finding.kind === "run-error") {
    copy["reasons"] = Object.freeze([...finding.reasons]);
  }
  return Object.freeze(copy) as unknown as ContractFinding;
}

function observedFinding(
  contractCoordinate: ContractCoordinate,
  currentCoordinate: ContractConfigurationCoordinate,
  actual: ContractActualOutcome,
  date: string,
): readonly ContractFinding[] {
  const findings: ContractFinding[] = [];
  if (contractCoordinate.configFingerprint !== currentCoordinate.configFingerprint) {
    findings.push({
      actual,
      contractConfigFingerprint: contractCoordinate.configFingerprint,
      currentConfigFingerprint: currentCoordinate.configFingerprint,
      expected: contractCoordinate.expected,
      id: contractCoordinate.id,
      kind: "unaccepted-config-drift",
    });
  }

  if (
    contractCoordinate.expected.status === "failed" &&
    contractCoordinate.expected.exception.expiresOn < date
  ) {
    findings.push({
      actual,
      expected: contractCoordinate.expected,
      id: contractCoordinate.id,
      kind: "expired-exception",
    });
  }

  if (contractCoordinate.configFingerprint !== currentCoordinate.configFingerprint) {
    return findings;
  }

  if (contractCoordinate.expected.status === "passed") {
    findings.push(actual.status === "passed"
      ? {
          actual,
          expected: contractCoordinate.expected,
          id: contractCoordinate.id,
          kind: "matched",
        }
      : {
          actual,
          expected: contractCoordinate.expected,
          id: contractCoordinate.id,
          kind: "regression",
        });
    return findings;
  }

  if (actual.status === "passed") {
    findings.push({
      actual,
      expected: contractCoordinate.expected,
      id: contractCoordinate.id,
      kind: "recovered-known-failure",
    });
  } else if (sameContractFailureCodes(
    contractCoordinate.expected.failureCodes,
    actual.failureCodes,
  )) {
    findings.push({
      actual,
      expected: contractCoordinate.expected,
      id: contractCoordinate.id,
      kind: "matched-known-failure",
    });
  } else {
    findings.push({
      actual,
      expected: contractCoordinate.expected,
      id: contractCoordinate.id,
      kind: "changed-known-failure",
    });
  }
  return findings;
}

/**
 * Compares one validated contract against one current configuration and one
 * complete fresh execution set without reading files, browsers, or the network.
 */
export function compareContract(
  options: CompareContractOptions,
): ContractComparisonResult {
  const contract = validatedContractSnapshot(options.contract);
  const digest = digestValidatedContract(contract);
  const declaredConfigDigest = contractConfigDigest(contract.coordinates);
  if (contract.configDigest !== declaredConfigDigest) {
    throw new ContractValidationError([{
      code: "invalid_value",
      message: "Contract configDigest must match its coordinate fingerprints.",
      path: "$.configDigest",
    }]);
  }
  const configuration = validateConfiguration(options.configuration);
  const executions = validateExecutions(options.executions);
  const complete = options.complete;
  if (typeof complete !== "boolean") {
    throw new ResultValidationError([{
      code: "invalid_type",
      message: "Comparison completeness must be a boolean.",
      path: "$.complete",
    }]);
  }
  const date = evaluatedOn(options.now);
  rejectFutureExceptions(contract, date);
  const configDigest = contractConfigDigest(configuration);
  const errors = runErrors(configuration, executions, complete);
  if (errors.length > 0) {
    const findings = Object.freeze([...errors].sort(findingOrder).map(frozenFinding));
    return Object.freeze({
      complete: false,
      configDigest,
      contractDigest: digest,
      evaluatedOn: date,
      findings,
      verdict: contractVerdictStatus(findings),
    });
  }
  const contractCoordinates = new Map(
    contract.coordinates.map((coordinate) => [coordinate.id, coordinate]),
  );
  const currentCoordinates = new Map(
    configuration.map((coordinate) => [coordinate.id, coordinate]),
  );
  const executionsById = new Map(
    executions.map((execution) => [coordinateId(execution), execution]),
  );
  const ids = [...new Set([
    ...contractCoordinates.keys(),
    ...currentCoordinates.keys(),
  ])].sort();
  const findings: ContractFinding[] = [];

  for (const id of ids) {
    const contractCoordinate = contractCoordinates.get(id);
    const currentCoordinate = currentCoordinates.get(id);
    if (contractCoordinate === undefined) {
      const actual = actualOutcome(executionsById.get(id)!);
      findings.push({
        actual,
        currentConfigFingerprint: currentCoordinate!.configFingerprint,
        expected: null,
        id,
        kind: "unaccepted-addition",
      });
      continue;
    }
    if (currentCoordinate === undefined) {
      findings.push({
        actual: null,
        contractConfigFingerprint: contractCoordinate.configFingerprint,
        expected: contractCoordinate.expected,
        id,
        kind: "missing-coordinate",
      });
      continue;
    }
    findings.push(...observedFinding(
      contractCoordinate,
      currentCoordinate,
      actualOutcome(executionsById.get(id)!),
      date,
    ));
  }

  const sortedFindings = Object.freeze(findings.sort(findingOrder).map(frozenFinding));
  return Object.freeze({
    complete: true,
    configDigest,
    contractDigest: digest,
    evaluatedOn: date,
    findings: sortedFindings,
    verdict: contractVerdictStatus(sortedFindings),
  });
}

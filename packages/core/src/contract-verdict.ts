import type { Sha256Digest } from "./canonical-json.js";
import type {
  ContractExpectation,
  ContractFailureCode,
} from "./contract.js";
import type { ExecutionFailureCode } from "./results.js";

/** Stable coordinate outcomes emitted by the state-contract comparison engine. */
export const CONTRACT_FINDING_KINDS: readonly [
  "run-error",
  "unaccepted-addition",
  "missing-coordinate",
  "unaccepted-config-drift",
  "expired-exception",
  "regression",
  "changed-known-failure",
  "recovered-known-failure",
  "matched-known-failure",
  "matched",
] = Object.freeze([
  "run-error",
  "unaccepted-addition",
  "missing-coordinate",
  "unaccepted-config-drift",
  "expired-exception",
  "regression",
  "changed-known-failure",
  "recovered-known-failure",
  "matched-known-failure",
  "matched",
] as const);

export type ContractFindingKind = (typeof CONTRACT_FINDING_KINDS)[number];

/**
 * Total ordering used after coordinate ID ordering. Lower values are more
 * important and therefore appear first when one coordinate has multiple outcomes.
 */
export const CONTRACT_FINDING_PRECEDENCE: Readonly<
  Record<ContractFindingKind, number>
> = Object.freeze({
  "run-error": 0,
  "unaccepted-addition": 1,
  "missing-coordinate": 2,
  "unaccepted-config-drift": 3,
  "expired-exception": 4,
  regression: 5,
  "changed-known-failure": 6,
  "recovered-known-failure": 7,
  "matched-known-failure": 8,
  matched: 9,
});

/** The message-free execution projection used for contract identity. */
export type ContractActualOutcome =
  | { readonly status: "passed" }
  | {
      readonly failureCodes: readonly ExecutionFailureCode[];
      readonly status: "failed";
    };

interface CoordinateFindingBase {
  readonly id: string;
  readonly actual: ContractActualOutcome;
}

export interface MatchedContractFinding extends CoordinateFindingBase {
  readonly expected: { readonly status: "passed" };
  readonly kind: "matched";
}

export interface RegressionContractFinding extends CoordinateFindingBase {
  readonly actual: Extract<ContractActualOutcome, { readonly status: "failed" }>;
  readonly expected: { readonly status: "passed" };
  readonly kind: "regression";
}

export interface KnownFailureContractFinding extends CoordinateFindingBase {
  readonly actual: Extract<ContractActualOutcome, { readonly status: "failed" }>;
  readonly expected: Extract<ContractExpectation, { readonly status: "failed" }>;
  readonly kind: "matched-known-failure";
}

export interface ChangedKnownFailureContractFinding
  extends CoordinateFindingBase {
  readonly actual: Extract<ContractActualOutcome, { readonly status: "failed" }>;
  readonly expected: Extract<ContractExpectation, { readonly status: "failed" }>;
  readonly kind: "changed-known-failure";
}

export interface RecoveredKnownFailureContractFinding
  extends CoordinateFindingBase {
  readonly actual: { readonly status: "passed" };
  readonly expected: Extract<ContractExpectation, { readonly status: "failed" }>;
  readonly kind: "recovered-known-failure";
}

export interface ExpiredExceptionContractFinding extends CoordinateFindingBase {
  readonly expected: Extract<ContractExpectation, { readonly status: "failed" }>;
  readonly kind: "expired-exception";
}

export interface UnacceptedConfigDriftContractFinding
  extends CoordinateFindingBase {
  readonly contractConfigFingerprint: Sha256Digest;
  readonly currentConfigFingerprint: Sha256Digest;
  readonly expected: ContractExpectation;
  readonly kind: "unaccepted-config-drift";
}

export interface UnacceptedAdditionContractFinding
  extends CoordinateFindingBase {
  readonly currentConfigFingerprint: Sha256Digest;
  readonly expected: null;
  readonly kind: "unaccepted-addition";
}

export interface MissingCoordinateContractFinding {
  readonly actual: null;
  readonly contractConfigFingerprint: Sha256Digest;
  readonly expected: ContractExpectation;
  readonly id: string;
  readonly kind: "missing-coordinate";
}

export type ContractRunErrorReason =
  | "declared-incomplete"
  | "duplicate-execution-coordinate"
  | "missing-execution"
  | "unexpected-execution";

export interface RunErrorContractFinding {
  readonly id: string | null;
  readonly kind: "run-error";
  readonly reasons: readonly ContractRunErrorReason[];
}

/** One canonical result from the comparison truth table. */
export type ContractFinding =
  | ChangedKnownFailureContractFinding
  | ExpiredExceptionContractFinding
  | KnownFailureContractFinding
  | MatchedContractFinding
  | MissingCoordinateContractFinding
  | RecoveredKnownFailureContractFinding
  | RegressionContractFinding
  | RunErrorContractFinding
  | UnacceptedAdditionContractFinding
  | UnacceptedConfigDriftContractFinding;

/** Stable process-independent classification of one comparison. */
export type ContractVerdictStatus = "error" | "failed" | "passed";

/** Browser-independent output of one state-contract comparison. */
export interface ContractComparisonResult {
  readonly complete: boolean;
  readonly configDigest: Sha256Digest;
  readonly contractDigest: Sha256Digest;
  readonly evaluatedOn: string;
  readonly findings: readonly ContractFinding[];
  readonly verdict: ContractVerdictStatus;
}

const passingKinds = new Set<ContractFindingKind>([
  "matched",
  "matched-known-failure",
]);

/** Chooses one overall verdict using the approved comparison precedence. */
export function contractVerdictStatus(
  findings: readonly ContractFinding[],
): ContractVerdictStatus {
  if (findings.some((finding) => finding.kind === "run-error")) {
    return "error";
  }
  return findings.every((finding) => passingKinds.has(finding.kind))
    ? "passed"
    : "failed";
}

/** @internal Shared exact-set comparison for eligible known failures. */
export function sameContractFailureCodes(
  expected: readonly ContractFailureCode[],
  actual: readonly ExecutionFailureCode[],
): boolean {
  return expected.length === actual.length &&
    expected.every((code, index) => code === actual[index]);
}

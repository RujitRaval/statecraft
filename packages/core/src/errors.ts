/** Stable machine-readable categories for errors produced by UIWitness core. */
export type UIWitnessErrorCode =
  | "CANONICAL_JSON_INVALID"
  | "CONFIG_INVALID"
  | "CONTRACT_INVALID"
  | "REPORT_INVALID"
  | "RESULT_INVALID";

/** Stable validation categories that do not expose validator-specific codes. */
export type ConfigValidationIssueCode =
  | "duplicate"
  | "invalid_type"
  | "invalid_value"
  | "unrecognized_key";

/** A single configuration problem with a deterministic path and category. */
export interface ConfigValidationIssue {
  readonly code: ConfigValidationIssueCode;
  readonly message: string;
  readonly path: string;
}

/** A single execution-result problem with a deterministic path and category. */
export type ResultValidationIssue = ConfigValidationIssue;

/** A single report problem with a deterministic path and category. */
export type ReportValidationIssue = ConfigValidationIssue;

/** Stable canonical-JSON failures that do not expose dependency internals. */
export interface CanonicalJsonIssue {
  readonly code: "invalid_type" | "invalid_value";
  readonly message: string;
  readonly path: string;
}

/** Stable contract-validation categories, including source-syntax failures. */
export type ContractValidationIssueCode =
  | ConfigValidationIssueCode
  | "invalid_syntax";

/** A single contract problem with a deterministic path and optional source span. */
export interface ContractValidationIssue {
  readonly code: ContractValidationIssueCode;
  readonly length?: number | undefined;
  readonly message: string;
  readonly offset?: number | undefined;
  readonly path: string;
}

/** @internal Contract parsers retain 99 exact issues plus one omission marker. */
export const CONTRACT_VALIDATION_ISSUE_LIMIT = 100;

/** @internal Shared deterministic marker for bounded contract diagnostics. */
export function contractIssuesOmitted(): ContractValidationIssue {
  return {
    code: "invalid_value",
    message: `Additional contract issues were omitted after the first ${CONTRACT_VALIDATION_ISSUE_LIMIT - 1}.`,
    path: "$",
  };
}

function boundedContractIssues(
  issues: readonly ContractValidationIssue[],
): readonly ContractValidationIssue[] {
  const retained = issues.length <= CONTRACT_VALIDATION_ISSUE_LIMIT
    ? issues
    : [
        ...issues.slice(0, CONTRACT_VALIDATION_ISSUE_LIMIT - 1),
        contractIssuesOmitted(),
      ];
  return Object.freeze(retained.map((issue) => Object.freeze({ ...issue })));
}

/** Base class for errors callers may classify without inspecting messages. */
export class UIWitnessError extends Error {
  readonly code: UIWitnessErrorCode;

  constructor(code: UIWitnessErrorCode, message: string) {
    super(message);
    this.name = "UIWitnessError";
    this.code = code;
  }
}

/** Thrown when a programmatic value cannot be represented as strict JCS JSON. */
export class CanonicalJsonError extends UIWitnessError {
  readonly issues: readonly CanonicalJsonIssue[];

  constructor(issues: readonly CanonicalJsonIssue[]) {
    super("CANONICAL_JSON_INVALID", "Invalid canonical JSON value.");
    this.name = "CanonicalJsonError";
    this.issues = Object.freeze(issues.map((issue) => Object.freeze({ ...issue })));
  }
}

/** Thrown when JSON source cannot be parsed as a versioned UIWitness contract. */
export class ContractValidationError extends UIWitnessError {
  readonly issues: readonly ContractValidationIssue[];

  constructor(issues: readonly ContractValidationIssue[]) {
    super("CONTRACT_INVALID", "Invalid UIWitness contract.");
    this.name = "ContractValidationError";
    this.issues = boundedContractIssues(issues);
  }
}

/** Thrown when an unknown value cannot be parsed as a UIWitness config. */
export class ConfigValidationError extends UIWitnessError {
  readonly issues: readonly ConfigValidationIssue[];

  constructor(issues: readonly ConfigValidationIssue[]) {
    super("CONFIG_INVALID", "Invalid UIWitness configuration.");
    this.name = "ConfigValidationError";
    this.issues = Object.freeze(issues.map((issue) => Object.freeze({ ...issue })));
  }
}

/** Thrown when an unknown value cannot be parsed as an execution result. */
export class ResultValidationError extends UIWitnessError {
  readonly issues: readonly ResultValidationIssue[];

  constructor(issues: readonly ResultValidationIssue[]) {
    super("RESULT_INVALID", "Invalid UIWitness execution result.");
    this.name = "ResultValidationError";
    this.issues = Object.freeze(issues.map((issue) => Object.freeze({ ...issue })));
  }
}

/** Thrown when an unknown value cannot be parsed as a versioned report. */
export class ReportValidationError extends UIWitnessError {
  readonly issues: readonly ReportValidationIssue[];

  constructor(issues: readonly ReportValidationIssue[]) {
    super("REPORT_INVALID", "Invalid UIWitness report.");
    this.name = "ReportValidationError";
    this.issues = Object.freeze(issues.map((issue) => Object.freeze({ ...issue })));
  }
}

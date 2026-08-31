/** Stable machine-readable categories for errors produced by UIWitness core. */
export type UIWitnessErrorCode =
  | "CONFIG_INVALID"
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

/** Base class for errors callers may classify without inspecting messages. */
export class UIWitnessError extends Error {
  readonly code: UIWitnessErrorCode;

  constructor(code: UIWitnessErrorCode, message: string) {
    super(message);
    this.name = "UIWitnessError";
    this.code = code;
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

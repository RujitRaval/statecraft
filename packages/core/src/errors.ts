/** Stable machine-readable categories for errors produced by Statecraft core. */
export type StatecraftErrorCode = "CONFIG_INVALID";

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

/** Base class for errors callers may classify without inspecting messages. */
export class StatecraftError extends Error {
  readonly code: StatecraftErrorCode;

  constructor(code: StatecraftErrorCode, message: string) {
    super(message);
    this.name = "StatecraftError";
    this.code = code;
  }
}

/** Thrown when an unknown value cannot be parsed as a Statecraft config. */
export class ConfigValidationError extends StatecraftError {
  readonly issues: readonly ConfigValidationIssue[];

  constructor(issues: readonly ConfigValidationIssue[]) {
    super("CONFIG_INVALID", "Invalid Statecraft configuration.");
    this.name = "ConfigValidationError";
    this.issues = Object.freeze(issues.map((issue) => Object.freeze({ ...issue })));
  }
}

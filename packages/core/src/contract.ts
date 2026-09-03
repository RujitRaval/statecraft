import { posix } from "node:path";

import {
  getLocation,
  parseTree,
  printParseErrorCode,
  type Node as JsonNode,
  type ParseError,
} from "jsonc-parser";
import { z, type ZodIssue } from "zod";

import {
  canonicalizeJson,
  canonicalJsonDigest,
  hasLoneSurrogate,
  type JsonValue,
  type Sha256Digest,
} from "./canonical-json.js";
import {
  CONTRACT_VALIDATION_ISSUE_LIMIT,
  ContractValidationError,
  contractIssuesOmitted,
  type ContractValidationIssue,
  type ContractValidationIssueCode,
} from "./errors.js";

/** The current committed state-contract schema version. */
export const CONTRACT_SCHEMA_VERSION = 1 as const;

/** Domain normalization layered on top of RFC 8785 for contract digests. */
export const CONTRACT_DIGEST_ALGORITHM = "jcs-rfc8785+domain-v1" as const;

/** Execution failures eligible for an explicit, expiring known-failure entry. */
export const CONTRACT_FAILURE_CODES: readonly [
  "ASSERTION_FAILED",
  "CONSOLE_ERROR",
  "FAILED_REQUEST",
  "PAGE_ERROR",
] = Object.freeze([
  "ASSERTION_FAILED",
  "CONSOLE_ERROR",
  "FAILED_REQUEST",
  "PAGE_ERROR",
] as const);

export type ContractFailureCode = (typeof CONTRACT_FAILURE_CODES)[number];

export interface ContractException {
  readonly createdOn: string;
  readonly expiresOn: string;
  readonly owner: string;
  readonly reason: string;
}

export type ContractExpectation =
  | { readonly status: "passed" }
  | {
      readonly exception: ContractException;
      readonly failureCodes: readonly ContractFailureCode[];
      readonly status: "failed";
    };

export interface ContractCoordinate {
  readonly configFingerprint: Sha256Digest;
  readonly expected: ContractExpectation;
  readonly id: string;
  readonly routeId: string;
  readonly routePath: string;
  readonly scenarioSource: string;
  readonly stateId: string;
  readonly theme: string;
  readonly viewport: {
    readonly height: number;
    readonly width: number;
  };
  readonly viewportId: string;
}

export interface UIWitnessContract {
  readonly configDigest: Sha256Digest;
  readonly coordinates: readonly ContractCoordinate[];
  readonly schemaVersion: typeof CONTRACT_SCHEMA_VERSION;
}

const identifierPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const digestPattern = /^sha256:[a-f0-9]{64}$/u;
const isoDatePattern = /^(\d{4})-(\d{2})-(\d{2})$/u;
const referenceOrigin = "https://uiwitness.invalid";
const maximumContractCoordinates = 10_000;
const maximumContractTextLength = 1_024;
const maximumJsonDepth = 256;

const identifierSchema = z
  .string()
  .max(maximumContractTextLength)
  .regex(
    identifierPattern,
    "IDs must use lowercase letters or numbers separated by single hyphens.",
  );
const digestSchema = z.string().regex(
  digestPattern,
  "Digests must use sha256 followed by 64 lowercase hexadecimal characters.",
) as z.ZodType<Sha256Digest>;
const nonEmptyStringSchema = z
  .string()
  .max(maximumContractTextLength)
  .refine((value) => value.trim().length > 0, {
    message: "Values cannot be empty.",
  });

function isValidIsoDate(value: string): boolean {
  const match = isoDatePattern.exec(value);
  if (match === null || match[1] === "0000") {
    return false;
  }
  const instant = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(instant.valueOf()) && instant.toISOString().slice(0, 10) === value;
}

const isoDateSchema = z.string().refine(isValidIsoDate, {
  message: "Dates must be real ISO calendar dates in YYYY-MM-DD format.",
});

function isSanitizedRoutePath(value: string): boolean {
  try {
    if (!value.startsWith("/") || value.includes("#")) {
      return false;
    }
    const url = new URL(value, referenceOrigin);
    if (url.origin !== referenceOrigin) {
      return false;
    }
    const redactedSearch = new URLSearchParams();
    for (const [queryKey, queryValue] of url.searchParams) {
      if (queryValue !== "[REDACTED]") {
        return false;
      }
      redactedSearch.append(queryKey, "[REDACTED]");
    }
    const normalizedSearch = redactedSearch.size > 0
      ? `?${redactedSearch.toString()}`
      : "";
    return `${url.pathname}${normalizedSearch}` === value;
  } catch {
    return false;
  }
}

function isWorkspaceRelativePosixPath(value: string): boolean {
  if (!value.startsWith("./") || value.includes("\\") || value.includes("\0")) {
    return false;
  }
  const relative = value.slice(2);
  if (relative.length === 0 || relative.endsWith("/")) {
    return false;
  }
  return posix.normalize(relative) === relative &&
    relative.split("/").every((segment) => segment !== "." && segment !== "..");
}

const routePathSchema = z.string().max(maximumContractTextLength).refine(isSanitizedRoutePath, {
  message: "Route paths must be normalized local paths with redacted query values.",
});
const scenarioSourceSchema = z.string().max(maximumContractTextLength).refine(isWorkspaceRelativePosixPath, {
  message: "Scenario sources must be normalized ./-prefixed POSIX paths.",
});
const viewportSchema = z.strictObject({
  height: z.number().int().positive(),
  width: z.number().int().positive(),
});
const exceptionSchema = z
  .strictObject({
    createdOn: isoDateSchema,
    expiresOn: isoDateSchema,
    owner: nonEmptyStringSchema,
    reason: nonEmptyStringSchema,
  })
  .superRefine((exception, context) => {
    if (!isValidIsoDate(exception.createdOn) || !isValidIsoDate(exception.expiresOn)) {
      return;
    }
    const created = Date.parse(`${exception.createdOn}T00:00:00.000Z`);
    const expires = Date.parse(`${exception.expiresOn}T00:00:00.000Z`);
    const days = (expires - created) / 86_400_000;
    if (days < 1 || days > 30) {
      context.addIssue({
        code: "custom",
        message: "Exception expiry must be 1 to 30 UTC calendar days after creation.",
        path: ["expiresOn"],
      });
    }
  });
const failureCodesSchema = z
  .array(z.enum(CONTRACT_FAILURE_CODES))
  .min(1, "Failed expectations must declare at least one failure code.")
  .max(CONTRACT_FAILURE_CODES.length)
  .superRefine((codes, context) => {
    if (codes.length > CONTRACT_FAILURE_CODES.length) {
      return;
    }
    const seen = new Set<ContractFailureCode>();
    codes.forEach((code, index) => {
      if (seen.has(code)) {
        context.addIssue({
          code: "custom",
          message: `Duplicate failure code "${code}".`,
          params: { uiwitnessIssueCode: "duplicate" },
          path: [index],
        });
      }
      seen.add(code);
    });
    const sorted = [...codes].sort();
    if (codes.some((code, index) => code !== sorted[index])) {
      context.addIssue({
        code: "custom",
        message: "Failure codes must be sorted lexicographically.",
        path: [],
      });
    }
  });
const expectationSchema = z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("passed") }),
  z.strictObject({
    exception: exceptionSchema,
    failureCodes: failureCodesSchema,
    status: z.literal("failed"),
  }),
]);
const coordinateSchema = z
  .strictObject({
    configFingerprint: digestSchema,
    expected: expectationSchema,
    id: z.string().max(maximumContractTextLength),
    routeId: identifierSchema,
    routePath: routePathSchema,
    scenarioSource: scenarioSourceSchema,
    stateId: identifierSchema,
    theme: identifierSchema,
    viewport: viewportSchema,
    viewportId: identifierSchema,
  })
  .superRefine((coordinate, context) => {
    const expectedId = [
      coordinate.routeId,
      coordinate.stateId,
      coordinate.viewportId,
      coordinate.theme,
    ].join("/");
    if (coordinate.id !== expectedId) {
      context.addIssue({
        code: "custom",
        message: `Coordinate id must equal "${expectedId}".`,
        path: ["id"],
      });
    }
  });
const contractSchema = z
  .strictObject({
    configDigest: digestSchema,
    coordinates: z
      .array(coordinateSchema)
      .min(1, "Contracts must declare at least one coordinate.")
      .max(maximumContractCoordinates),
    schemaVersion: z.literal(CONTRACT_SCHEMA_VERSION),
  })
  .superRefine((contract, context) => {
    const seen = new Set<string>();
    contract.coordinates.forEach((coordinate, index) => {
      if (seen.has(coordinate.id)) {
        context.addIssue({
          code: "custom",
          message: `Duplicate coordinate id "${coordinate.id}".`,
          params: { uiwitnessIssueCode: "duplicate" },
          path: ["coordinates", index, "id"],
        });
      }
      seen.add(coordinate.id);
    });
    const sorted = [...contract.coordinates].sort(compareCoordinates);
    if (contract.coordinates.some((coordinate, index) => coordinate !== sorted[index])) {
      context.addIssue({
        code: "custom",
        message: "Coordinates must be sorted by route, state, viewport, and theme IDs.",
        path: ["coordinates"],
      });
    }
  });

function compareCoordinates(
  left: Pick<ContractCoordinate, "routeId" | "stateId" | "theme" | "viewportId">,
  right: Pick<ContractCoordinate, "routeId" | "stateId" | "theme" | "viewportId">,
): number {
  const leftTuple = [left.routeId, left.stateId, left.viewportId, left.theme];
  const rightTuple = [right.routeId, right.stateId, right.viewportId, right.theme];
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

function formatIssuePath(path: readonly PropertyKey[]): string {
  return path.reduce<string>((formatted, segment) => {
    if (typeof segment === "number") {
      return `${formatted}[${segment}]`;
    }
    if (typeof segment === "string" && /^[A-Za-z_$][A-Za-z0-9_$]*$/u.test(segment)) {
      return `${formatted}.${segment}`;
    }
    return `${formatted}[${JSON.stringify(String(segment))}]`;
  }, "$");
}

function issueCode(issue: ZodIssue): ContractValidationIssueCode {
  if (issue.code === "custom" && issue.params?.["uiwitnessIssueCode"] === "duplicate") {
    return "duplicate";
  }
  if (issue.code === "invalid_type") {
    return "invalid_type";
  }
  if (issue.code === "unrecognized_keys") {
    return "unrecognized_key";
  }
  return "invalid_value";
}

function zodIssue(issue: ZodIssue): ContractValidationIssue {
  return Object.freeze({
    code: issueCode(issue),
    message: issue.message,
    path: formatIssuePath(issue.path),
  });
}

function sourceIssue(source: string, error: ParseError): ContractValidationIssue {
  const path = [...getLocation(source, error.offset).path];
  if (path.at(-1) === "") {
    path.pop();
  }
  return Object.freeze({
    code: "invalid_syntax" as const,
    length: error.length,
    message: `Invalid JSON syntax: ${printParseErrorCode(error.error)}.`,
    offset: error.offset,
    path: formatIssuePath(path),
  });
}

interface SourcePath {
  readonly parent?: SourcePath | undefined;
  readonly segment: number | string;
}

function sourcePathSegments(path: SourcePath | undefined): readonly (number | string)[] {
  const segments: (number | string)[] = [];
  for (let current = path; current !== undefined; current = current.parent) {
    segments.push(current.segment);
  }
  return segments.reverse();
}

function inspectSourceTree(
  source: string,
  root: JsonNode,
): ContractValidationIssue[] {
  const issues: ContractValidationIssue[] = [];
  const addIssue = (issue: ContractValidationIssue): boolean => {
    if (issues.length < CONTRACT_VALIDATION_ISSUE_LIMIT - 1) {
      issues.push(issue);
      return false;
    }
    issues.push(contractIssuesOmitted());
    return true;
  };
  const stack: { readonly node: JsonNode; readonly path?: SourcePath | undefined }[] = [
    { node: root },
  ];

  while (stack.length > 0) {
    const entry = stack.pop()!;
    const { node, path } = entry;
    if (node.type === "number" && !Number.isFinite(node.value)) {
      if (addIssue(Object.freeze({
        code: "invalid_value",
        length: node.length,
        message: "Contract JSON numbers must be finite.",
        offset: node.offset,
        path: formatIssuePath(sourcePathSegments(path)),
      }))) {
        return issues;
      }
      continue;
    }
    if (node.type === "number" && Object.is(node.value, -0)) {
      if (addIssue(Object.freeze({
        code: "invalid_value",
        length: node.length,
        message: "Negative zero is not accepted in contract JSON.",
        offset: node.offset,
        path: formatIssuePath(sourcePathSegments(path)),
      }))) {
        return issues;
      }
      continue;
    }
    const decodedString = node.type === "string"
      ? JSON.parse(source.slice(node.offset, node.offset + node.length)) as string
      : undefined;
    if (decodedString !== undefined && hasLoneSurrogate(decodedString)) {
      if (addIssue(Object.freeze({
        code: "invalid_value",
        length: node.length,
        message: "Contract JSON strings cannot contain lone UTF-16 surrogates.",
        offset: node.offset,
        path: formatIssuePath(sourcePathSegments(path)),
      }))) {
        return issues;
      }
      continue;
    }
    if (node.type === "array") {
      const children = node.children ?? [];
      for (let index = children.length - 1; index >= 0; index -= 1) {
        stack.push({
          node: children[index]!,
          path: { parent: path, segment: index },
        });
      }
      continue;
    }
    if (node.type !== "object") {
      continue;
    }

    const seen = new Set<string>();
    const childEntries: { readonly node: JsonNode; readonly path: SourcePath }[] = [];
    for (const property of node.children ?? []) {
      const keyNode = property.children?.[0];
      const valueNode = property.children?.[1];
      if (keyNode === undefined) {
        continue;
      }
      const key = JSON.parse(
        source.slice(keyNode.offset, keyNode.offset + keyNode.length),
      ) as string;
      const propertyPath = { parent: path, segment: key };
      if (hasLoneSurrogate(key)) {
        if (addIssue(Object.freeze({
          code: "invalid_value",
          length: keyNode.length,
          message: "Contract JSON property names cannot contain lone UTF-16 surrogates.",
          offset: keyNode.offset,
          path: formatIssuePath(sourcePathSegments(propertyPath)),
        }))) {
          return issues;
        }
      }
      if (seen.has(key)) {
        if (addIssue(Object.freeze({
          code: "duplicate",
          length: keyNode.length,
          message: `Duplicate JSON property "${key}".`,
          offset: keyNode.offset,
          path: formatIssuePath(sourcePathSegments(propertyPath)),
        }))) {
          return issues;
        }
      }
      seen.add(key);
      if (valueNode !== undefined) {
        childEntries.push({ node: valueNode, path: propertyPath });
      }
    }
    for (let index = childEntries.length - 1; index >= 0; index -= 1) {
      stack.push(childEntries[index]!);
    }
  }

  return issues;
}

function assertSourceDepth(source: string): void {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let offset = 0; offset < source.length; offset += 1) {
    const character = source[offset]!;
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }
    if (character === '"') {
      inString = true;
    } else if (character === "{" || character === "[") {
      depth += 1;
      if (depth > maximumJsonDepth) {
        throw new ContractValidationError([{
          code: "invalid_syntax",
          length: 1,
          message: `Contract JSON cannot exceed ${maximumJsonDepth} nested containers.`,
          offset,
          path: "$",
        }]);
      }
    } else if (character === "}" || character === "]") {
      depth = Math.max(0, depth - 1);
    }
  }
}

class BoundedParseErrors extends Array<ParseError> {
  omitted = false;

  override push(...errors: ParseError[]): number {
    for (const error of errors) {
      if (this.length < CONTRACT_VALIDATION_ISSUE_LIMIT - 1) {
        super.push(error);
      } else {
        this.omitted = true;
      }
    }
    return this.length;
  }
}

function parseSource(source: string): JsonValue {
  assertSourceDepth(source);
  const syntaxErrors = new BoundedParseErrors();
  let root: JsonNode | undefined;
  try {
    root = parseTree(source, syntaxErrors, {
      allowEmptyContent: false,
      allowTrailingComma: false,
      disallowComments: true,
    });
  } catch {
    throw new ContractValidationError([{
      code: "invalid_syntax",
      length: 0,
      message: "Contract JSON could not be parsed safely.",
      offset: 0,
      path: "$",
    }]);
  }
  if (syntaxErrors.length > 0 || root === undefined) {
    const issues = syntaxErrors.length > 0
      ? [
          ...syntaxErrors
            .slice(0, CONTRACT_VALIDATION_ISSUE_LIMIT - 1)
            .map((error) => sourceIssue(source, error)),
          ...(syntaxErrors.omitted
            ? [contractIssuesOmitted()]
            : []),
        ]
      : [{
          code: "invalid_syntax" as const,
          length: 0,
          message: "Contract JSON must contain one value.",
          offset: 0,
          path: "$",
        }];
    throw new ContractValidationError(issues);
  }

  const sourceIssues = inspectSourceTree(source, root);
  if (sourceIssues.length > 0) {
    throw new ContractValidationError(sourceIssues);
  }
  return JSON.parse(source) as JsonValue;
}

function parseContractValue(input: unknown): UIWitnessContract {
  const result = contractSchema.safeParse(input);
  if (!result.success) {
    const issues = result.error.issues
      .slice(0, CONTRACT_VALIDATION_ISSUE_LIMIT - 1)
      .map(zodIssue);
    if (result.error.issues.length >= CONTRACT_VALIDATION_ISSUE_LIMIT) {
      issues.push(contractIssuesOmitted());
    }
    throw new ContractValidationError(issues);
  }
  return result.data;
}

function normalizedContract(contract: UIWitnessContract): JsonValue {
  return {
    configDigest: contract.configDigest,
    coordinates: [...contract.coordinates]
      .sort(compareCoordinates)
      .map<JsonValue>((coordinate) => ({
        configFingerprint: coordinate.configFingerprint,
        expected: coordinate.expected.status === "failed"
          ? {
              exception: {
                createdOn: coordinate.expected.exception.createdOn,
                expiresOn: coordinate.expected.exception.expiresOn,
                owner: coordinate.expected.exception.owner,
                reason: coordinate.expected.exception.reason,
              },
              failureCodes: [...coordinate.expected.failureCodes].sort(),
              status: coordinate.expected.status,
            }
          : { status: coordinate.expected.status },
        id: coordinate.id,
        routeId: coordinate.routeId,
        routePath: coordinate.routePath,
        scenarioSource: coordinate.scenarioSource,
        stateId: coordinate.stateId,
        theme: coordinate.theme,
        viewport: {
          height: coordinate.viewport.height,
          width: coordinate.viewport.width,
        },
        viewportId: coordinate.viewportId,
      })),
    schemaVersion: contract.schemaVersion,
  };
}

/** Parses strict JSON source or throws a stable, validator-independent error. */
export function parseContract(source: string): UIWitnessContract {
  if (typeof source !== "string") {
    throw new ContractValidationError([{
      code: "invalid_type",
      message: "Contract source must be a string.",
      path: "$",
    }]);
  }
  return parseContractValue(parseSource(source));
}

/** Produces the normalized RFC 8785 representation used for contract identity. */
export function canonicalizeContract(contract: UIWitnessContract): string {
  const validated = parseContractValue(contract);
  return canonicalizeJson(normalizedContract(validated));
}

/** Produces a stable SHA-256 digest over normalized RFC 8785 contract bytes. */
export function contractDigest(contract: UIWitnessContract): Sha256Digest {
  const validated = parseContractValue(contract);
  return canonicalJsonDigest(normalizedContract(validated));
}

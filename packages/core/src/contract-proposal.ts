import { z, type ZodIssue } from "zod";

import {
  canonicalizeJson,
  canonicalJsonDigest,
  type JsonValue,
  type Sha256Digest,
} from "./canonical-json.js";
import {
  CONTRACT_FAILURE_CODES,
  CONTRACT_SCHEMA_VERSION,
  contractDigest,
  validatedContractSnapshot,
  type ContractCoordinate,
  type ContractException,
  type ContractExpectation,
  type ContractFailureCode,
  type UIWitnessContract,
} from "./contract.js";
import {
  contractConfigDigest,
  type ContractConfigurationCoordinate,
} from "./contract-comparison.js";
import {
  ContractProposalValidationError,
  ContractValidationError,
} from "./errors.js";
import { EXECUTION_FAILURE_CODES, type ExecutionFailureCode } from "./results.js";

export const CONTRACT_PROPOSAL_SCHEMA_VERSION = 1 as const;
export const CONTRACT_SOURCE_SCHEMA_VERSION = 1 as const;
export const CONTRACT_METADATA_SCHEMA_VERSION = 1 as const;
export const CONTRACT_PROPOSAL_OPERATIONS: readonly [
  "add",
  "remove",
  "config",
  "expectation",
  "exception",
] = Object.freeze([
  "add",
  "remove",
  "config",
  "expectation",
  "exception",
] as const);

export type ContractProposalOperation =
  (typeof CONTRACT_PROPOSAL_OPERATIONS)[number];
export type ContractSourceDigest = Sha256Digest | "absent";

export type ProposedExpectation =
  | { readonly status: "passed" }
  | {
      readonly failureCodes: readonly ExecutionFailureCode[];
      readonly status: "failed";
    };

export interface ContractSourceExecution {
  readonly actual: ProposedExpectation;
  readonly id: string;
}

export interface ContractProposalSource {
  readonly complete: true;
  readonly configDigest: Sha256Digest;
  readonly configuration: readonly ContractConfigurationCoordinate[];
  readonly contract: UIWitnessContract | null;
  readonly evaluatedOn: string;
  readonly executions: readonly ContractSourceExecution[];
  readonly runDigest: Sha256Digest;
  readonly schemaVersion: typeof CONTRACT_SOURCE_SCHEMA_VERSION;
  readonly sourceContractDigest: ContractSourceDigest;
}

export interface ContractProposalChange {
  readonly after: JsonValue | null;
  readonly before: JsonValue | null;
  readonly coordinateId: string;
  readonly id: string;
  readonly operation: ContractProposalOperation;
}

export interface ContractProposal {
  readonly changes: readonly ContractProposalChange[];
  readonly complete: true;
  readonly configDigest: Sha256Digest;
  readonly evaluatedOn: string;
  readonly runDigest: Sha256Digest;
  readonly schemaVersion: typeof CONTRACT_PROPOSAL_SCHEMA_VERSION;
  readonly sourceContractDigest: ContractSourceDigest;
  readonly sourceGenerationDigest: Sha256Digest;
  readonly toolVersion: string;
}

export interface ContractProposalMetadata {
  readonly annotations: Readonly<Record<string, ContractException>>;
  readonly proposalDigest: Sha256Digest;
  readonly schemaVersion: typeof CONTRACT_METADATA_SCHEMA_VERSION;
}

const digestSchema = z.string().regex(/^sha256:[a-f0-9]{64}$/u) as z.ZodType<Sha256Digest>;
const sourceDigestSchema = z.union([digestSchema, z.literal("absent")]);
const dateSchema = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/u)
  .refine(validDate, "Dates must be real UTC calendar dates.");
const identifierSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u);
const coordinateIdSchema = z.string().refine((value) => {
  const parts = value.split("/");
  return parts.length === 4 && parts.every((part) => identifierSchema.safeParse(part).success);
}, "Coordinate IDs must contain four lowercase kebab-case components.");
const viewportSchema = z.strictObject({
  height: z.number().int().positive(),
  width: z.number().int().positive(),
});
const configurationSchema = z.strictObject({
  configFingerprint: digestSchema,
  id: coordinateIdSchema,
  routeId: identifierSchema,
  routePath: z.string(),
  scenarioSource: z.string(),
  stateId: identifierSchema,
  theme: identifierSchema,
  viewport: viewportSchema,
  viewportId: identifierSchema,
});
const proposedExpectationSchema = z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("passed") }),
  z.strictObject({
    failureCodes: z.array(z.enum(EXECUTION_FAILURE_CODES)).min(1),
    status: z.literal("failed"),
  }),
]);
const sourceExecutionSchema = z.strictObject({
  actual: proposedExpectationSchema,
  id: coordinateIdSchema,
});
const sourceSchema = z.strictObject({
  complete: z.literal(true),
  configDigest: digestSchema,
  configuration: z.array(configurationSchema).min(1).max(10_000),
  contract: z.unknown().nullable(),
  evaluatedOn: dateSchema,
  executions: z.array(sourceExecutionSchema).min(1).max(10_000),
  runDigest: digestSchema,
  schemaVersion: z.literal(CONTRACT_SOURCE_SCHEMA_VERSION),
  sourceContractDigest: sourceDigestSchema,
});
const changeSchema = z.strictObject({
  after: z.unknown().nullable(),
  before: z.unknown().nullable(),
  coordinateId: coordinateIdSchema,
  id: z.string(),
  operation: z.enum(CONTRACT_PROPOSAL_OPERATIONS),
});
const proposalSchema = z.strictObject({
  changes: z.array(changeSchema).max(50_000),
  complete: z.literal(true),
  configDigest: digestSchema,
  evaluatedOn: dateSchema,
  runDigest: digestSchema,
  schemaVersion: z.literal(CONTRACT_PROPOSAL_SCHEMA_VERSION),
  sourceContractDigest: sourceDigestSchema,
  sourceGenerationDigest: digestSchema,
  toolVersion: z.string().min(1).max(128),
});
const exceptionSchema = z.strictObject({
  createdOn: dateSchema,
  expiresOn: dateSchema,
  owner: z.string().min(1).max(1_024),
  reason: z.string().min(1).max(1_024),
});
const metadataSchema = z.strictObject({
  annotations: z.record(z.string(), exceptionSchema),
  proposalDigest: digestSchema,
  schemaVersion: z.literal(CONTRACT_METADATA_SCHEMA_VERSION),
});

function issuePath(root: string, issue: ZodIssue): string {
  return issue.path.reduce<string>((path, segment) =>
    typeof segment === "number" ? `${path}[${segment}]` : `${path}.${String(segment)}`,
  root);
}

function validationError(root: string, issues: readonly ZodIssue[]): never {
  throw new ContractProposalValidationError(issues.map((issue) => ({
    code: issue.code === "invalid_type"
      ? "invalid_type"
      : issue.code === "unrecognized_keys" ? "unrecognized_key" : "invalid_value",
    message: issue.message,
    path: issuePath(root, issue),
  })));
}

function parseCanonicalSource(source: string): JsonValue {
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch {
    throw new ContractProposalValidationError([{
      code: "invalid_syntax",
      message: "Proposal JSON must be valid canonical JSON.",
      path: "$",
    }]);
  }
  let canonical: string;
  try {
    canonical = canonicalizeJson(value as JsonValue);
  } catch {
    throw new ContractProposalValidationError([{
      code: "invalid_value",
      message: "Proposal JSON must contain only strict canonical JSON values.",
      path: "$",
    }]);
  }
  if (source !== canonical && source !== `${canonical}\n`) {
    throw new ContractProposalValidationError([{
      code: "invalid_syntax",
      message: "Proposal JSON must use its exact canonical representation.",
      path: "$",
    }]);
  }
  return value as JsonValue;
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const nested of Object.values(value as Record<string, unknown>)) {
      deepFreeze(nested);
    }
    Object.freeze(value);
  }
  return value;
}

function sortedFailureCodes(
  codes: readonly ExecutionFailureCode[],
): readonly ExecutionFailureCode[] {
  return Object.freeze([...new Set(codes)].sort());
}

function configurationView(
  coordinate: ContractCoordinate | ContractConfigurationCoordinate,
): ContractConfigurationCoordinate {
  return {
    configFingerprint: coordinate.configFingerprint,
    id: coordinate.id,
    routeId: coordinate.routeId,
    routePath: coordinate.routePath,
    scenarioSource: coordinate.scenarioSource,
    stateId: coordinate.stateId,
    theme: coordinate.theme,
    viewport: { ...coordinate.viewport },
    viewportId: coordinate.viewportId,
  };
}

function proposedExpectation(
  expectation: ContractExpectation | ProposedExpectation,
): ProposedExpectation {
  return expectation.status === "passed"
    ? { status: "passed" }
    : {
        failureCodes: sortedFailureCodes(expectation.failureCodes),
        status: "failed",
      };
}

function asJson(value: unknown): JsonValue {
  return JSON.parse(canonicalizeJson(value as JsonValue)) as JsonValue;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

const operationOrder = new Map(
  CONTRACT_PROPOSAL_OPERATIONS.map((operation, index) => [operation, index]),
);

function compareChanges(
  left: Pick<ContractProposalChange, "coordinateId" | "operation">,
  right: Pick<ContractProposalChange, "coordinateId" | "operation">,
): number {
  return compareText(left.coordinateId, right.coordinateId) ||
    operationOrder.get(left.operation)! - operationOrder.get(right.operation)!;
}

function validatedConfigurationSnapshot(
  configuration: readonly ContractConfigurationCoordinate[],
): readonly ContractConfigurationCoordinate[] {
  try {
    return validatedContractSnapshot({
      configDigest: contractConfigDigest(configuration),
      coordinates: configuration.map((coordinate) => ({
        ...coordinate,
        expected: { status: "passed" },
      })),
      schemaVersion: CONTRACT_SCHEMA_VERSION,
    }).coordinates.map(configurationView);
  } catch (error: unknown) {
    if (!(error instanceof ContractValidationError)) throw error;
    throw new ContractProposalValidationError(error.issues.map((issue) => ({
      ...issue,
      path: issue.path.replace(/^\$\.coordinates/u, "$.configuration"),
    })));
  }
}

function change(
  operation: ContractProposalOperation,
  coordinateId: string,
  before: unknown,
  after: unknown,
): ContractProposalChange {
  return Object.freeze({
    after: after === null ? null : asJson(after),
    before: before === null ? null : asJson(before),
    coordinateId,
    id: `${operation}:${coordinateId}`,
    operation,
  });
}

function isExpired(expectation: ContractExpectation, evaluatedOn: string): boolean {
  return expectation.status === "failed" && expectation.exception.expiresOn < evaluatedOn;
}

/** Creates the immutable source snapshot from one complete fresh run. */
export function createContractProposalSource(input: {
  readonly configuration: readonly ContractConfigurationCoordinate[];
  readonly contract: UIWitnessContract | null;
  readonly evaluatedOn: string;
  readonly executions: readonly ContractSourceExecution[];
  readonly runDigest: Sha256Digest;
}): ContractProposalSource {
  const inputConfiguration = input.configuration;
  const inputExecutions = input.executions;
  const inputContract = input.contract;
  const evaluatedOn = input.evaluatedOn;
  const runDigest = input.runDigest;
  if (!Array.isArray(inputConfiguration) || !Array.isArray(inputExecutions)) {
    throw new ContractProposalValidationError([{
      code: "invalid_type",
      message: "Proposal configuration and executions must be arrays.",
      path: "$",
    }]);
  }
  const configuration = validatedConfigurationSnapshot([...inputConfiguration]
    .sort((left, right) => compareText(left.id, right.id))
    .map(configurationView));
  const executions = [...inputExecutions]
    .sort((left, right) => compareText(left.id, right.id))
    .map((execution) => ({
      actual: proposedExpectation(execution.actual),
      id: execution.id,
    }));
  const ids = new Set(configuration.map(({ id }) => id));
  if (
    configuration.length === 0 ||
    executions.length !== configuration.length ||
    executions.some(({ id }) => !ids.delete(id)) ||
    ids.size > 0
  ) {
    throw new ContractProposalValidationError([{
      code: "invalid_value",
      message: "Proposal sources require one fresh execution for every configured coordinate.",
      path: "$.executions",
    }]);
  }
  const contract = inputContract === null
    ? null
    : validatedContractSnapshot(inputContract);
  const source: ContractProposalSource = {
    complete: true,
    configDigest: contractConfigDigest(configuration),
    configuration,
    contract,
    evaluatedOn,
    executions,
    runDigest,
    schemaVersion: CONTRACT_SOURCE_SCHEMA_VERSION,
    sourceContractDigest: contract === null ? "absent" : contractDigest(contract),
  };
  return parseContractProposalSource(serializeContractProposalSource(source));
}

/** Builds stable named changes from one validated source snapshot. */
export function createContractProposal(
  source: ContractProposalSource,
  toolVersion: string,
): ContractProposal {
  const validated = parseContractProposalSource(serializeContractProposalSource(source));
  const contractById = new Map(
    (validated.contract?.coordinates ?? []).map((coordinate) => [coordinate.id, coordinate]),
  );
  const configurationById = new Map(
    validated.configuration.map((coordinate) => [coordinate.id, coordinate]),
  );
  const executionById = new Map(
    validated.executions.map((execution) => [execution.id, execution.actual]),
  );
  const changes: ContractProposalChange[] = [];
  const ids = [...new Set([
    ...contractById.keys(),
    ...configurationById.keys(),
  ])].sort();
  for (const id of ids) {
    const before = contractById.get(id);
    const current = configurationById.get(id);
    const actual = executionById.get(id);
    if (before === undefined && current !== undefined && actual !== undefined) {
      changes.push(change("add", id, null, {
        ...current,
        expected: actual,
      }));
      continue;
    }
    if (before !== undefined && current === undefined) {
      changes.push(change("remove", id, before, null));
      continue;
    }
    if (before === undefined || current === undefined || actual === undefined) {
      continue;
    }
    if (before.configFingerprint !== current.configFingerprint) {
      changes.push(change("config", id, configurationView(before), current));
    }
    const expected = proposedExpectation(before.expected);
    if (canonicalizeJson(expected as unknown as JsonValue) !== canonicalizeJson(actual as unknown as JsonValue)) {
      changes.push(change("expectation", id, expected, actual));
    }
    if (
      before.expected.status === "failed" &&
      isExpired(before.expected, validated.evaluatedOn)
    ) {
      changes.push(change("exception", id, before.expected.exception, null));
    }
  }
  changes.sort(compareChanges);
  const proposal: ContractProposal = {
    changes,
    complete: true,
    configDigest: validated.configDigest,
    evaluatedOn: validated.evaluatedOn,
    runDigest: validated.runDigest,
    schemaVersion: CONTRACT_PROPOSAL_SCHEMA_VERSION,
    sourceContractDigest: validated.sourceContractDigest,
    sourceGenerationDigest: contractProposalSourceDigest(validated),
    toolVersion,
  };
  return parseContractProposal(serializeContractProposal(proposal));
}

function validDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (value.startsWith("0000-")) return false;
  const instant = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(instant.valueOf()) && instant.toISOString().slice(0, 10) === value;
}

function validateException(exception: ContractException, evaluatedOn: string): void {
  const created = Date.parse(`${exception.createdOn}T00:00:00.000Z`);
  const expires = Date.parse(`${exception.expiresOn}T00:00:00.000Z`);
  const days = (expires - created) / 86_400_000;
  if (
    !validDate(evaluatedOn) ||
    !validDate(exception.createdOn) ||
    !validDate(exception.expiresOn) ||
    exception.createdOn > evaluatedOn ||
    exception.expiresOn < evaluatedOn ||
    days < 1 ||
    days > 30 ||
    exception.owner.trim().length === 0 ||
    exception.reason.trim().length === 0
  ) {
    throw new ContractProposalValidationError([{
      code: "invalid_value",
      message: "Accepted exceptions require non-empty ownership, valid current dates, and a 1-30 day lifetime.",
      path: "$.annotations",
    }]);
  }
}

function acceptedExpectation(
  expectation: ProposedExpectation,
  annotation: ContractException | undefined,
  evaluatedOn: string,
): ContractExpectation {
  if (expectation.status === "passed") return { status: "passed" };
  if (annotation === undefined) {
    throw new ContractProposalValidationError([{
      code: "invalid_value",
      message: "Accepting a failed expectation requires an annotation for that named change.",
      path: "$.annotations",
    }]);
  }
  validateException(annotation, evaluatedOn);
  if (expectation.failureCodes.some((code) =>
    !(CONTRACT_FAILURE_CODES as readonly string[]).includes(code)
  )) {
    throw new ContractProposalValidationError([{
      code: "invalid_value",
      message: "Only assertion and configured diagnostic failures may become known failures.",
      path: "$.changes",
    }]);
  }
  return {
    exception: { ...annotation },
    failureCodes: expectation.failureCodes as readonly ContractFailureCode[],
    status: "failed",
  };
}

/** Applies only the explicitly named changes to the source contract. */
export function applyContractProposal(input: {
  readonly acceptedOn: string;
  readonly changeIds: readonly string[];
  readonly metadata: ContractProposalMetadata;
  readonly proposal: ContractProposal;
  readonly source: ContractProposalSource;
}): UIWitnessContract {
  const acceptedOn = input.acceptedOn;
  const changeIds = Array.isArray(input.changeIds)
    ? [...input.changeIds]
    : [];
  const source = parseContractProposalSource(
    serializeContractProposalSource(input.source),
  );
  const proposalText = serializeContractProposal(input.proposal);
  const proposal = parseContractProposal(proposalText);
  const metadata = parseContractProposalMetadata(
    serializeContractProposalMetadata(input.metadata),
  );
  if (typeof acceptedOn !== "string" || !validDate(acceptedOn)) {
    throw new ContractProposalValidationError([{
      code: "invalid_value",
      message: "Acceptance requires a real UTC calendar date.",
      path: "$.acceptedOn",
    }]);
  }
  const regenerated = createContractProposal(source, proposal.toolVersion);
  if (serializeContractProposal(regenerated) !== proposalText) {
    throw new ContractProposalValidationError([{
      code: "invalid_value",
      message: "Proposal contents do not match their immutable source generation.",
      path: "$",
    }]);
  }
  if (metadata.proposalDigest !== contractProposalDigest(proposal)) {
    throw new ContractProposalValidationError([{
      code: "invalid_value",
      message: "Proposal metadata targets a different proposal.",
      path: "$.proposalDigest",
    }]);
  }
  const requested = new Set(changeIds);
  if (
    requested.size === 0 ||
    requested.size !== changeIds.length ||
    changeIds.some((id) => typeof id !== "string")
  ) {
    throw new ContractProposalValidationError([{
      code: "invalid_value",
      message: "Acceptance requires one or more unique named changes.",
      path: "$.changeIds",
    }]);
  }
  const changes = new Map(proposal.changes.map((entry) => [entry.id, entry]));
  for (const id of requested) {
    if (!changes.has(id)) {
      throw new ContractProposalValidationError([{
        code: "invalid_value",
        message: `Unknown proposal change "${id}".`,
        path: "$.changeIds",
      }]);
    }
  }
  for (const key of Object.keys(metadata.annotations)) {
    const annotatedChange = changes.get(key);
    if (annotatedChange === undefined) {
      throw new ContractProposalValidationError([{
        code: "unrecognized_key",
        message: `Metadata targets unknown proposal change "${key}".`,
        path: `$.annotations[${JSON.stringify(key)}]`,
      }]);
    }
    if (!changeAcceptsAnnotation(annotatedChange)) {
      throw new ContractProposalValidationError([{
        code: "invalid_value",
        message: `Change "${key}" cannot accept exception metadata.`,
        path: `$.annotations[${JSON.stringify(key)}]`,
      }]);
    }
  }

  const coordinates = new Map(
    (source.contract?.coordinates ?? []).map((coordinate) => [coordinate.id, { ...coordinate }]),
  );
  for (const proposalChange of proposal.changes) {
    if (!requested.has(proposalChange.id)) continue;
    const annotation = metadata.annotations[proposalChange.id];
    if (proposalChange.operation === "remove") {
      coordinates.delete(proposalChange.coordinateId);
      continue;
    }
    if (proposalChange.operation === "add") {
      const after = proposalChange.after as unknown as ContractConfigurationCoordinate & { expected: ProposedExpectation };
      coordinates.set(proposalChange.coordinateId, {
        ...after,
        expected: acceptedExpectation(after.expected, annotation, acceptedOn),
      });
      continue;
    }
    const current = coordinates.get(proposalChange.coordinateId);
    if (current === undefined) {
      throw new ContractProposalValidationError([{
        code: "invalid_value",
        message: `Change "${proposalChange.id}" has no source coordinate.`,
        path: "$.changes",
      }]);
    }
    if (proposalChange.operation === "config") {
      coordinates.set(proposalChange.coordinateId, {
        ...(proposalChange.after as unknown as ContractConfigurationCoordinate),
        expected: current.expected,
      });
    } else if (proposalChange.operation === "expectation") {
      coordinates.set(proposalChange.coordinateId, {
        ...current,
        expected: acceptedExpectation(
          proposalChange.after as unknown as ProposedExpectation,
          annotation,
          acceptedOn,
        ),
      });
    } else {
      if (current.expected.status !== "failed" || annotation === undefined) {
        throw new ContractProposalValidationError([{
          code: "invalid_value",
          message: `Exception change "${proposalChange.id}" requires a failed source and annotation.`,
          path: "$.changes",
        }]);
      }
      validateException(annotation, acceptedOn);
      coordinates.set(proposalChange.coordinateId, {
        ...current,
        expected: { ...current.expected, exception: { ...annotation } },
      });
    }
  }
  const ordered = [...coordinates.values()].sort((left, right) => compareText(left.id, right.id));
  if (ordered.length === 0) {
    throw new ContractProposalValidationError([{
      code: "invalid_value",
      message: "Acceptance cannot produce an empty state contract.",
      path: "$.changes",
    }]);
  }
  return validatedContractSnapshot({
    configDigest: contractConfigDigest(ordered.map(configurationView)),
    coordinates: ordered,
    schemaVersion: CONTRACT_SCHEMA_VERSION,
  });
}

export function emptyContractProposalMetadata(
  proposal: ContractProposal,
): ContractProposalMetadata {
  const validated = parseContractProposal(serializeContractProposal(proposal));
  return Object.freeze({
    annotations: Object.freeze({}),
    proposalDigest: contractProposalDigest(validated),
    schemaVersion: CONTRACT_METADATA_SCHEMA_VERSION,
  });
}

function changeAcceptsAnnotation(change: ContractProposalChange): boolean {
  if (change.operation === "exception") return true;
  if (change.operation !== "add" && change.operation !== "expectation") {
    return false;
  }
  const after = change.after as Readonly<Record<string, unknown>> | null;
  const expectation = change.operation === "add"
    ? after?.["expected"] as Readonly<Record<string, unknown>> | undefined
    : after;
  return expectation?.["status"] === "failed";
}

export function withContractProposalAnnotation(
  proposal: ContractProposal,
  metadata: ContractProposalMetadata,
  changeId: string,
  exception: ContractException,
  evaluatedOn: string,
): ContractProposalMetadata {
  const validatedProposal = parseContractProposal(serializeContractProposal(proposal));
  const validatedMetadata = parseContractProposalMetadata(
    serializeContractProposalMetadata(metadata),
  );
  const annotation = {
    createdOn: exception.createdOn,
    expiresOn: exception.expiresOn,
    owner: exception.owner,
    reason: exception.reason,
  };
  if (validatedMetadata.proposalDigest !== contractProposalDigest(validatedProposal)) {
    throw new ContractProposalValidationError([{
      code: "invalid_value",
      message: "Proposal metadata targets a different proposal.",
      path: "$.proposalDigest",
    }]);
  }
  const selected = validatedProposal.changes.find(({ id }) => id === changeId);
  if (selected === undefined || !changeAcceptsAnnotation(selected)) {
    throw new ContractProposalValidationError([{
      code: "invalid_value",
      message: `Change "${changeId}" cannot accept exception metadata.`,
      path: "$.changeId",
    }]);
  }
  const updated = parseContractProposalMetadata(serializeContractProposalMetadata({
    annotations: { ...validatedMetadata.annotations, [changeId]: annotation },
    proposalDigest: validatedMetadata.proposalDigest,
    schemaVersion: validatedMetadata.schemaVersion,
  }));
  validateException(updated.annotations[changeId]!, evaluatedOn);
  return updated;
}

export function parseContractProposalSource(source: string): ContractProposalSource {
  const result = sourceSchema.safeParse(parseCanonicalSource(source));
  if (!result.success) validationError("$", result.error.issues);
  const configuration = validatedConfigurationSnapshot(result.data.configuration);
  const contract = result.data.contract === null
    ? null
    : validatedContractSnapshot(result.data.contract);
  const configurationCanonical = canonicalizeJson(configuration as unknown as JsonValue);
  const sourceConfigurationCanonical = canonicalizeJson(
    result.data.configuration as unknown as JsonValue,
  );
  const executionsCanonical = canonicalizeJson(
    result.data.executions as unknown as JsonValue,
  );
  const normalizedExecutions = [...result.data.executions]
    .sort((left, right) => compareText(left.id, right.id))
    .map((execution) => ({
      actual: proposedExpectation(execution.actual),
      id: execution.id,
    }));
  const executionIds = new Set(normalizedExecutions.map(({ id }) => id));
  const hasCompleteExecutionInventory =
    executionIds.size === configuration.length &&
    normalizedExecutions.length === configuration.length &&
    configuration.every(({ id }) => executionIds.has(id));
  if (
    (contract === null && result.data.sourceContractDigest !== "absent") ||
    (contract !== null && result.data.sourceContractDigest !== contractDigest(contract)) ||
    result.data.configDigest !== contractConfigDigest(configuration) ||
    configurationCanonical !== sourceConfigurationCanonical ||
    executionsCanonical !== canonicalizeJson(normalizedExecutions as unknown as JsonValue) ||
    !hasCompleteExecutionInventory
  ) {
    throw new ContractProposalValidationError([{
      code: "invalid_value",
      message: "Proposal source contents or digests do not match their canonical complete inputs.",
      path: "$",
    }]);
  }
  return deepFreeze({
    ...result.data,
    configuration,
    contract,
    executions: normalizedExecutions,
  } as ContractProposalSource);
}

export function parseContractProposal(source: string): ContractProposal {
  const result = proposalSchema.safeParse(parseCanonicalSource(source));
  if (!result.success) validationError("$", result.error.issues);
  const seen = new Set<string>();
  for (const entry of result.data.changes) {
    if (entry.id !== `${entry.operation}:${entry.coordinateId}` || seen.has(entry.id)) {
      throw new ContractProposalValidationError([{
        code: "duplicate",
        message: "Proposal change IDs must be unique operation and coordinate joins.",
        path: "$.changes",
      }]);
    }
    seen.add(entry.id);
  }
  if (result.data.changes.some((entry, index, changes) =>
    index > 0 && compareChanges(changes[index - 1]!, entry) >= 0
  )) {
    throw new ContractProposalValidationError([{
      code: "invalid_value",
      message: "Proposal changes must use canonical coordinate and operation order.",
      path: "$.changes",
    }]);
  }
  return deepFreeze(result.data as ContractProposal);
}

export function parseContractProposalMetadata(source: string): ContractProposalMetadata {
  const result = metadataSchema.safeParse(parseCanonicalSource(source));
  if (!result.success) validationError("$", result.error.issues);
  return deepFreeze(result.data as ContractProposalMetadata);
}

export function serializeContractProposalSource(source: ContractProposalSource): string {
  return `${canonicalizeJson(source as unknown as JsonValue)}\n`;
}

export function serializeContractProposal(proposal: ContractProposal): string {
  return `${canonicalizeJson(proposal as unknown as JsonValue)}\n`;
}

export function serializeContractProposalMetadata(metadata: ContractProposalMetadata): string {
  return `${canonicalizeJson(metadata as unknown as JsonValue)}\n`;
}

export function contractProposalSourceDigest(source: ContractProposalSource): Sha256Digest {
  return canonicalJsonDigest(source as unknown as JsonValue);
}

export function contractProposalDigest(proposal: ContractProposal): Sha256Digest {
  return canonicalJsonDigest(proposal as unknown as JsonValue);
}

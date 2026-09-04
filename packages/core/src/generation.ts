import { z, type ZodIssue } from "zod";

import {
  canonicalizeJson,
  canonicalJsonDigest,
  type JsonValue,
  type Sha256Digest,
} from "./canonical-json.js";
import { GenerationValidationError } from "./errors.js";

export const GENERATION_MANIFEST_SCHEMA_VERSION = 1 as const;
export const COMMITTED_GENERATION_SCHEMA_VERSION = 1 as const;
export const GENERATION_ARTIFACT_ROLES: readonly [
  "evidence",
  "report-json",
  "report-html",
  "contract-verdict",
  "contract-source",
  "contract-proposal",
  "contract-metadata",
  "json-copy",
] = Object.freeze([
  "evidence",
  "report-json",
  "report-html",
  "contract-verdict",
  "contract-source",
  "contract-proposal",
  "contract-metadata",
  "json-copy",
] as const);

export type GenerationArtifactRole = (typeof GENERATION_ARTIFACT_ROLES)[number];

export interface GenerationArtifactDescriptor {
  readonly bytes: number;
  readonly digest: Sha256Digest;
  readonly mutable: boolean;
  readonly path: string;
  readonly role: GenerationArtifactRole;
}

export interface UIWitnessGenerationManifest {
  readonly artifacts: readonly GenerationArtifactDescriptor[];
  readonly complete: true;
  readonly reportDigest: Sha256Digest;
  readonly runDigest: Sha256Digest | null;
  readonly schemaVersion: typeof GENERATION_MANIFEST_SCHEMA_VERSION;
  readonly sourceGenerationDigests: readonly Sha256Digest[];
  readonly toolVersion: string;
}

export interface UIWitnessCommittedGeneration {
  readonly manifestDigest: Sha256Digest;
  readonly manifestPath: string;
  readonly schemaVersion: typeof COMMITTED_GENERATION_SCHEMA_VERSION;
  readonly sourceGenerationDigests: readonly Sha256Digest[];
}

const digestSchema = z.string().regex(/^sha256:[a-f0-9]{64}$/u) as z.ZodType<Sha256Digest>;
const safePathSchema = z.string().min(1).max(1_024).refine((value) => {
  if (value.startsWith("/") || value.includes("\\") || value.includes("\0")) return false;
  const segments = value.split("/");
  return segments.every((segment) => segment.length > 0 && segment !== "." && segment !== "..");
}, "Generation artifact paths must be safe project-relative POSIX paths.");
const artifactSchema = z.strictObject({
  bytes: z.number().int().nonnegative(),
  digest: digestSchema,
  mutable: z.boolean(),
  path: safePathSchema,
  role: z.enum(GENERATION_ARTIFACT_ROLES),
});
const manifestSchema = z.strictObject({
  artifacts: z.array(artifactSchema).min(2).max(20_050),
  complete: z.literal(true),
  reportDigest: digestSchema,
  runDigest: digestSchema.nullable(),
  schemaVersion: z.literal(GENERATION_MANIFEST_SCHEMA_VERSION),
  sourceGenerationDigests: z.array(digestSchema).max(1_000),
  toolVersion: z.string().min(1).max(128),
});
const committedSchema = z.strictObject({
  manifestDigest: digestSchema,
  manifestPath: safePathSchema,
  schemaVersion: z.literal(COMMITTED_GENERATION_SCHEMA_VERSION),
  sourceGenerationDigests: z.array(digestSchema).max(1_000),
});

function issuePath(root: string, issue: ZodIssue): string {
  return issue.path.reduce<string>((path, segment) =>
    typeof segment === "number" ? `${path}[${segment}]` : `${path}.${String(segment)}`,
  root);
}

function invalid(issues: readonly ZodIssue[]): never {
  throw new GenerationValidationError(issues.map((issue) => ({
    code: issue.code === "invalid_type"
      ? "invalid_type"
      : issue.code === "unrecognized_keys" ? "unrecognized_key" : "invalid_value",
    message: issue.message,
    path: issuePath("$", issue),
  })));
}

function parseCanonical(source: string): JsonValue {
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch {
    throw new GenerationValidationError([{
      code: "invalid_syntax",
      message: "Generation JSON must be valid canonical JSON.",
      path: "$",
    }]);
  }
  let canonical: string;
  try {
    canonical = canonicalizeJson(value as JsonValue);
  } catch {
    throw new GenerationValidationError([{
      code: "invalid_value",
      message: "Generation JSON must contain only strict canonical JSON values.",
      path: "$",
    }]);
  }
  if (source !== canonical && source !== `${canonical}\n`) {
    throw new GenerationValidationError([{
      code: "invalid_syntax",
      message: "Generation JSON must use its exact canonical representation.",
      path: "$",
    }]);
  }
  return value as JsonValue;
}

function freeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const nested of Object.values(value as Record<string, unknown>)) freeze(nested);
    Object.freeze(value);
  }
  return value;
}

function orderedUnique(values: readonly string[]): boolean {
  return values.every((value, index) => index === 0 || values[index - 1]! < value);
}

export function parseGenerationManifest(source: string): UIWitnessGenerationManifest {
  const result = manifestSchema.safeParse(parseCanonical(source));
  if (!result.success) invalid(result.error.issues);
  const paths = result.data.artifacts.map(({ path }) => path);
  if (!orderedUnique(paths) || !orderedUnique(result.data.sourceGenerationDigests)) {
    throw new GenerationValidationError([{
      code: "duplicate",
      message: "Generation artifacts and source digests must be unique and canonically ordered.",
      path: "$",
    }]);
  }
  const report = result.data.artifacts.find(({ role }) => role === "report-json");
  const html = result.data.artifacts.find(({ role }) => role === "report-html");
  if (
    report === undefined || html === undefined ||
    result.data.artifacts.filter(({ role }) => role === "report-json").length !== 1 ||
    result.data.artifacts.filter(({ role }) => role === "report-html").length !== 1 ||
    report.digest !== result.data.reportDigest || report.mutable || html.mutable
  ) {
    throw new GenerationValidationError([{
      code: "invalid_value",
      message: "A generation requires one immutable report JSON and one immutable report HTML artifact.",
      path: "$.artifacts",
    }]);
  }
  return freeze(result.data as UIWitnessGenerationManifest);
}

export function serializeGenerationManifest(manifest: UIWitnessGenerationManifest): string {
  return `${canonicalizeJson(manifest as unknown as JsonValue)}\n`;
}

export function generationManifestDigest(manifest: UIWitnessGenerationManifest): Sha256Digest {
  return canonicalJsonDigest(manifest as unknown as JsonValue);
}

export function parseCommittedGeneration(source: string): UIWitnessCommittedGeneration {
  const result = committedSchema.safeParse(parseCanonical(source));
  if (!result.success) invalid(result.error.issues);
  if (!orderedUnique(result.data.sourceGenerationDigests)) {
    throw new GenerationValidationError([{
      code: "duplicate",
      message: "Committed source-generation digests must be unique and canonically ordered.",
      path: "$.sourceGenerationDigests",
    }]);
  }
  const digest = result.data.manifestDigest.slice("sha256:".length);
  if (result.data.manifestPath !== `.uiwitness/generations/${digest}.manifest.json`) {
    throw new GenerationValidationError([{
      code: "invalid_value",
      message: "Committed generation manifest paths must match their content digest.",
      path: "$.manifestPath",
    }]);
  }
  return freeze(result.data as UIWitnessCommittedGeneration);
}

export function serializeCommittedGeneration(marker: UIWitnessCommittedGeneration): string {
  return `${canonicalizeJson(marker as unknown as JsonValue)}\n`;
}

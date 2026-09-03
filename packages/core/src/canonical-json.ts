import { createHash } from "node:crypto";

import canonicalize from "canonicalize";

import { CanonicalJsonError } from "./errors.js";

/** A value representable by strict JSON and RFC 8785 JCS. */
export type JsonValue =
  | boolean
  | null
  | number
  | string
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

/** A lowercase hexadecimal SHA-256 digest with an explicit algorithm prefix. */
export type Sha256Digest = `sha256:${string}`;

/** The canonicalization standard used by {@link canonicalizeJson}. */
export const CANONICAL_JSON_ALGORITHM = "jcs-rfc8785" as const;

function invalid(
  path: string,
  message: string,
  code: "invalid_type" | "invalid_value" = "invalid_value",
): never {
  throw new CanonicalJsonError([
    Object.freeze({ code, message, path }),
  ]);
}

function propertyPath(path: string, key: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/u.test(key)
    ? `${path}.${key}`
    : `${path}[${JSON.stringify(key)}]`;
}

/** @internal Shared source/value validation; intentionally not exported publicly. */
export function hasLoneSurrogate(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      if (index + 1 >= value.length) {
        return true;
      }
      const next = value.charCodeAt(index + 1);
      if (next < 0xdc00 || next > 0xdfff) {
        return true;
      }
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      return true;
    }
  }
  return false;
}

function inheritedCallableToJson(value: object): boolean {
  let prototype = Object.getPrototypeOf(value) as object | null;
  while (prototype !== null) {
    const descriptor = Object.getOwnPropertyDescriptor(prototype, "toJSON");
    if (
      descriptor !== undefined &&
      (descriptor.get !== undefined ||
        descriptor.set !== undefined ||
        typeof descriptor.value === "function")
    ) {
      return true;
    }
    prototype = Object.getPrototypeOf(prototype) as object | null;
  }
  return false;
}

function normalizeJsonValue(
  value: unknown,
  path: string,
  ancestors: Set<object>,
): JsonValue {
  if (value === null || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    if (hasLoneSurrogate(value)) {
      invalid(path, "JSON strings cannot contain lone UTF-16 surrogates.");
    }
    return value;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      invalid(path, "JSON numbers must be finite.");
    }
    if (Object.is(value, -0)) {
      invalid(path, "Negative zero is not accepted for canonical JSON.");
    }
    return value;
  }

  if (typeof value !== "object") {
    invalid(path, "Values must use only JSON data types.", "invalid_type");
  }

  if (ancestors.has(value)) {
    invalid(path, "Canonical JSON cannot contain circular references.");
  }
  ancestors.add(value);

  try {
    if (Array.isArray(value)) {
      const prototype = Object.getPrototypeOf(value);
      if (prototype !== Array.prototype) {
        invalid(path, "JSON arrays must use the standard prototype.", "invalid_type");
      }
      if (inheritedCallableToJson(value)) {
        invalid(path, "JSON arrays cannot inherit a toJSON method.", "invalid_type");
      }

      const ownKeys = Reflect.ownKeys(value);
      const indexDescriptors = new Map<number, PropertyDescriptor>();
      for (const key of ownKeys) {
        if (key === "length") {
          continue;
        }
        if (
          typeof key !== "string" ||
          !/^(?:0|[1-9][0-9]*)$/u.test(key) ||
          Number(key) >= value.length
        ) {
          invalid(path, "JSON arrays cannot contain named or symbolic properties.");
        }
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (descriptor === undefined) {
          invalid(`${path}[${key}]`, "JSON array entries must remain stable while read.");
        }
        indexDescriptors.set(Number(key), descriptor);
      }

      const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
      const length = lengthDescriptor?.value;
      if (
        typeof length !== "number" ||
        !Number.isInteger(length) ||
        length < 0 ||
        indexDescriptors.size !== length
      ) {
        invalid(path, "JSON arrays cannot contain sparse entries.");
      }

      const normalized: JsonValue[] = [];
      for (let index = 0; index < length; index += 1) {
        const descriptor = indexDescriptors.get(index);
        if (descriptor === undefined) {
          invalid(`${path}[${index}]`, "JSON arrays cannot contain sparse entries.");
        }
        if (descriptor.get !== undefined || descriptor.set !== undefined) {
          invalid(`${path}[${index}]`, "JSON values cannot use accessor properties.");
        }
        normalized.push(normalizeJsonValue(descriptor.value, `${path}[${index}]`, ancestors));
      }
      return normalized;
    }

    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      invalid(path, "JSON objects must use a plain or null prototype.", "invalid_type");
    }
    if (inheritedCallableToJson(value)) {
      invalid(path, "JSON objects cannot inherit a toJSON method.", "invalid_type");
    }

    const normalized: Record<string, JsonValue> = Object.create(null) as Record<string, JsonValue>;
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== "string") {
        invalid(path, "JSON objects cannot contain symbol properties.");
      }
      if (hasLoneSurrogate(key)) {
        invalid(propertyPath(path, key), "JSON property names cannot contain lone UTF-16 surrogates.");
      }
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined || !descriptor.enumerable) {
        invalid(propertyPath(path, key), "JSON object properties must be enumerable.");
      }
      if (descriptor.get !== undefined || descriptor.set !== undefined) {
        invalid(propertyPath(path, key), "JSON values cannot use accessor properties.");
      }
      normalized[key] = normalizeJsonValue(
        descriptor.value,
        propertyPath(path, key),
        ancestors,
      );
    }
    return normalized;
  } finally {
    ancestors.delete(value);
  }
}

/** Serializes a strict JSON value with RFC 8785 JSON Canonicalization Scheme. */
export function canonicalizeJson(value: JsonValue): string {
  try {
    const normalized = normalizeJsonValue(value, "$", new Set<object>());
    const result = canonicalize(normalized);
    if (result === undefined) {
      return invalid("$", "The canonicalizer did not produce JSON output.");
    }
    return result;
  } catch (error) {
    if (error instanceof CanonicalJsonError) {
      throw error;
    }
    return invalid("$", "The value could not be canonicalized.");
  }
}

/** Hashes the UTF-8 JCS bytes of a strict JSON value with SHA-256. */
export function canonicalJsonDigest(value: JsonValue): Sha256Digest {
  const digest = createHash("sha256")
    .update(canonicalizeJson(value), "utf8")
    .digest("hex");
  return `sha256:${digest}`;
}

import { describe, expect, it } from "vitest";

import {
  CANONICAL_JSON_ALGORITHM,
  CONTRACT_DIGEST_ALGORITHM,
  CONTRACT_FAILURE_CODES,
  CONTRACT_SCHEMA_VERSION,
  CanonicalJsonError,
  ContractValidationError,
  canonicalizeContract,
  canonicalizeJson,
  canonicalJsonDigest,
  contractDigest,
  parseContract,
  type JsonValue,
  type UIWitnessContract,
} from "../src/index.js";

const digestA = `sha256:${"a".repeat(64)}` as const;
const digestB = `sha256:${"b".repeat(64)}` as const;

function coordinate(
  overrides: Partial<UIWitnessContract["coordinates"][number]> = {},
): UIWitnessContract["coordinates"][number] {
  return {
    configFingerprint: digestB,
    expected: { status: "passed" },
    id: "home/public/desktop/light",
    routeId: "home",
    routePath: "/",
    scenarioSource: "./uiwitness/scenarios/public.mjs",
    stateId: "public",
    theme: "light",
    viewport: { height: 900, width: 1440 },
    viewportId: "desktop",
    ...overrides,
  };
}

function contract(
  overrides: Partial<UIWitnessContract> = {},
): UIWitnessContract {
  return {
    configDigest: digestA,
    coordinates: [coordinate()],
    schemaVersion: CONTRACT_SCHEMA_VERSION,
    ...overrides,
  };
}

function source(value: unknown = contract()): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function withoutKey(
  value: unknown,
  path: readonly (number | string)[],
): unknown {
  const clone = structuredClone(value) as Record<PropertyKey, unknown>;
  let parent = clone;
  for (const segment of path.slice(0, -1)) {
    parent = parent[segment] as Record<PropertyKey, unknown>;
  }
  Reflect.deleteProperty(parent, path.at(-1)!);
  return clone;
}

function expectContractIssues(
  input: string,
  expected: readonly { code: string; path: string }[],
): void {
  try {
    parseContract(input);
    throw new Error("Expected parseContract to fail.");
  } catch (error) {
    expect(error).toBeInstanceOf(ContractValidationError);
    if (!(error instanceof ContractValidationError)) {
      return;
    }
    expect(error.code).toBe("CONTRACT_INVALID");
    expect(error.issues).toEqual(
      expect.arrayContaining(expected.map((issue) => expect.objectContaining(issue))),
    );
  }
}

describe("strict contract parsing", () => {
  it("parses the minimal passing contract and exposes stable protocol constants", () => {
    expect(parseContract(source())).toEqual(contract());
    expect(CONTRACT_SCHEMA_VERSION).toBe(1);
    expect(CONTRACT_DIGEST_ALGORITHM).toBe("jcs-rfc8785+domain-v1");
    expect(CONTRACT_FAILURE_CODES).toEqual([
      "ASSERTION_FAILED",
      "CONSOLE_ERROR",
      "FAILED_REQUEST",
      "PAGE_ERROR",
    ]);
    expect(Object.isFrozen(CONTRACT_FAILURE_CODES)).toBe(true);
    expect(Reflect.set(CONTRACT_FAILURE_CODES, "length", 0)).toBe(false);
  });

  it("parses an exact governed known failure", () => {
    const knownFailure = contract({
      coordinates: [coordinate({
        expected: {
          exception: {
            createdOn: "2026-09-02",
            expiresOn: "2026-10-02",
            owner: "checkout-team",
            reason: "UIW-1842 tracks the repair",
          },
          failureCodes: ["ASSERTION_FAILED", "PAGE_ERROR"],
          status: "failed",
        },
      })],
    });

    expect(parseContract(source(knownFailure))).toEqual(knownFailure);
  });

  it.each([
    ["", "invalid_syntax", "$"],
    ["{/*comment*/\"schemaVersion\":1}", "invalid_syntax", "$"],
    ["{\"schemaVersion\":1,}", "invalid_syntax", "$"],
    ["{} {}", "invalid_syntax", "$"],
  ])("rejects non-strict JSON source %#", (input, code, path) => {
    expectContractIssues(input, [{ code, path }]);
  });

  it("rejects duplicate decoded property names before object conversion", () => {
    const valid = source();
    const duplicated = valid.replace(
      '"schemaVersion": 1',
      '"schemaVersion": 1, "schema\\u0056ersion": 1',
    );

    expectContractIssues(duplicated, [{ code: "duplicate", path: "$.schemaVersion" }]);
  });

  it("rejects duplicate nested property names", () => {
    const duplicated = source().replace(
      '"width": 1440',
      '"width": 1440, "width": 1440',
    );

    expectContractIssues(duplicated, [{
      code: "duplicate",
      path: "$.coordinates[0].viewport.width",
    }]);
  });

  it("rejects negative zero before schema conversion", () => {
    const negativeZero = source().replace('"width": 1440', '"width": -0');
    expectContractIssues(negativeZero, [{
      code: "invalid_value",
      path: "$.coordinates[0].viewport.width",
    }]);
  });

  it("rejects non-finite number text before object conversion", () => {
    const overflow = source().replace(
      `"configDigest": "${digestA}",`,
      `"configDigest": "${digestA}", "overflow": 1e400,`,
    );
    expectContractIssues(overflow, [{
      code: "invalid_value",
      path: "$.overflow",
    }]);
  });

  it.each([
    ['"theme": "light"', '"theme": "\\ud800"', "$.coordinates[0].theme"],
    ['"theme": "light"', '"\\ud800": "light"', '$.coordinates[0]["\\ud800"]'],
  ])("rejects lone surrogates in JSON strings and keys %#", (from, to, path) => {
    expectContractIssues(source().replace(from, to), [{ code: "invalid_value", path }]);
  });

  it("reports syntax source spans without dependency-specific error codes", () => {
    try {
      parseContract("{]");
      throw new Error("Expected parseContract to fail.");
    } catch (error) {
      expect(error).toBeInstanceOf(ContractValidationError);
      if (error instanceof ContractValidationError) {
        expect(error.issues[0]).toEqual(expect.objectContaining({
          code: "invalid_syntax",
          length: expect.any(Number),
          message: expect.stringMatching(/^Invalid JSON syntax:/u),
          offset: expect.any(Number),
        }));
      }
    }
  });

  it("bounds issue output for adversarial sources", () => {
    const duplicated = `{${Array.from({ length: 200 }, () => '"same":1').join(",")}}`;
    try {
      parseContract(duplicated);
      throw new Error("Expected parseContract to fail.");
    } catch (error) {
      expect(error).toBeInstanceOf(ContractValidationError);
      if (error instanceof ContractValidationError) {
        expect(error.issues).toHaveLength(100);
        expect(error.issues.at(-1)).toEqual({
          code: "invalid_value",
          message: "Additional contract issues were omitted after the first 99.",
          path: "$",
        });
      }
    }

    try {
      parseContract(`[${",".repeat(1_000)}]`);
      throw new Error("Expected parseContract to fail.");
    } catch (error) {
      expect(error).toBeInstanceOf(ContractValidationError);
      if (error instanceof ContractValidationError) {
        expect(error.issues).toHaveLength(100);
        expect(error.issues.at(-1)?.message).toBe(
          "Additional contract issues were omitted after the first 99.",
        );
      }
    }
  });

  it("caps JSON nesting before the recursive parser can exhaust the stack", () => {
    const atLimit = `${"[".repeat(256)}0${"]".repeat(256)}`;
    expectContractIssues(atLimit, [{ code: "invalid_type", path: "$" }]);

    const aboveLimit = `${"[".repeat(257)}0${"]".repeat(257)}`;
    expectContractIssues(aboveLimit, [{ code: "invalid_syntax", path: "$" }]);
  });
});

describe("contract schema", () => {
  it.each([
    ["schema version", { ...contract(), schemaVersion: 2 }, "$.schemaVersion"],
    ["digest", { ...contract(), configDigest: "sha256:ABC" }, "$.configDigest"],
    ["empty coordinates", { ...contract(), coordinates: [] }, "$.coordinates"],
  ])("rejects an invalid %s", (_label, value, path) => {
    expectContractIssues(source(value), [{ code: "invalid_value", path }]);
  });

  it("rejects unknown keys with the stable category", () => {
    expectContractIssues(source({ ...contract(), extra: true }), [{
      code: "unrecognized_key",
      path: "$",
    }]);
  });

  it.each([
    [["schemaVersion"], "$.schemaVersion", "invalid_value"],
    [["configDigest"], "$.configDigest", "invalid_type"],
    [["coordinates"], "$.coordinates", "invalid_type"],
    [["coordinates", 0, "configFingerprint"], "$.coordinates[0].configFingerprint", "invalid_type"],
    [["coordinates", 0, "expected"], "$.coordinates[0].expected", "invalid_type"],
    [["coordinates", 0, "id"], "$.coordinates[0].id", "invalid_type"],
    [["coordinates", 0, "routeId"], "$.coordinates[0].routeId", "invalid_type"],
    [["coordinates", 0, "routePath"], "$.coordinates[0].routePath", "invalid_type"],
    [["coordinates", 0, "scenarioSource"], "$.coordinates[0].scenarioSource", "invalid_type"],
    [["coordinates", 0, "stateId"], "$.coordinates[0].stateId", "invalid_type"],
    [["coordinates", 0, "theme"], "$.coordinates[0].theme", "invalid_type"],
    [["coordinates", 0, "viewport"], "$.coordinates[0].viewport", "invalid_type"],
    [["coordinates", 0, "viewport", "height"], "$.coordinates[0].viewport.height", "invalid_type"],
    [["coordinates", 0, "viewport", "width"], "$.coordinates[0].viewport.width", "invalid_type"],
    [["coordinates", 0, "viewportId"], "$.coordinates[0].viewportId", "invalid_type"],
    [["coordinates", 0, "expected", "status"], "$.coordinates[0].expected.status", "invalid_value"],
  ] as const)("rejects a missing required field at %s", (path, issuePath, code) => {
    expectContractIssues(source(withoutKey(contract(), path)), [{
      code,
      path: issuePath,
    }]);
  });

  it.each([
    [["coordinates", 0, "expected", "exception"], "$.coordinates[0].expected.exception"],
    [["coordinates", 0, "expected", "failureCodes"], "$.coordinates[0].expected.failureCodes"],
    [["coordinates", 0, "expected", "exception", "createdOn"], "$.coordinates[0].expected.exception.createdOn"],
    [["coordinates", 0, "expected", "exception", "expiresOn"], "$.coordinates[0].expected.exception.expiresOn"],
    [["coordinates", 0, "expected", "exception", "owner"], "$.coordinates[0].expected.exception.owner"],
    [["coordinates", 0, "expected", "exception", "reason"], "$.coordinates[0].expected.exception.reason"],
  ] as const)("rejects a missing known-failure field at %s", (path, issuePath) => {
    const value = contract({
      coordinates: [coordinate({
        expected: {
          exception: {
            createdOn: "2026-09-02",
            expiresOn: "2026-09-03",
            owner: "owner",
            reason: "reason",
          },
          failureCodes: ["ASSERTION_FAILED"],
          status: "failed",
        },
      })],
    });
    expectContractIssues(source(withoutKey(value, path)), [{
      code: "invalid_type",
      path: issuePath,
    }]);
  });

  it.each([
    ["coordinate", contract({ coordinates: [{ ...coordinate(), extra: true } as never] }), "$.coordinates[0]"],
    ["viewport", contract({ coordinates: [coordinate({ viewport: { height: 900, width: 1440, extra: true } as never })] }), "$.coordinates[0].viewport"],
    ["passing expectation", contract({ coordinates: [coordinate({ expected: { status: "passed", extra: true } as never })] }), "$.coordinates[0].expected"],
    ["failed expectation", contract({ coordinates: [coordinate({ expected: { exception: { createdOn: "2026-09-02", expiresOn: "2026-09-03", owner: "owner", reason: "reason" }, failureCodes: ["ASSERTION_FAILED"], status: "failed", extra: true } as never })] }), "$.coordinates[0].expected"],
    ["exception", contract({ coordinates: [coordinate({ expected: { exception: { createdOn: "2026-09-02", expiresOn: "2026-09-03", owner: "owner", reason: "reason", extra: true } as never, failureCodes: ["ASSERTION_FAILED"], status: "failed" } })] }), "$.coordinates[0].expected.exception"],
  ])("rejects an unknown %s key", (_label, value, path) => {
    expectContractIssues(source(value), [{ code: "unrecognized_key", path }]);
  });

  it.each([
    ["coordinate id", coordinate({ id: "wrong" }), "$.coordinates[0].id"],
    ["identifier", coordinate({ routeId: "Home" }), "$.coordinates[0].routeId"],
    ["scenario traversal", coordinate({ scenarioSource: "./states/../secret.mjs" }), "$.coordinates[0].scenarioSource"],
    ["scenario platform separator", coordinate({ scenarioSource: ".\\states\\public.mjs" }), "$.coordinates[0].scenarioSource"],
    ["unredacted query", coordinate({ routePath: "/?token=secret" }), "$.coordinates[0].routePath"],
    ["fragment", coordinate({ routePath: "/#secret" }), "$.coordinates[0].routePath"],
    ["cross-origin path", coordinate({ routePath: "//evil.example/path" }), "$.coordinates[0].routePath"],
    ["viewport", coordinate({ viewport: { height: 900, width: 0 } }), "$.coordinates[0].viewport.width"],
  ])("rejects an invalid %s", (_label, value, path) => {
    expectContractIssues(source(contract({ coordinates: [value] })), [{
      code: "invalid_value",
      path,
    }]);
  });

  it("accepts the exact normalized redacted query representation", () => {
    const value = contract({
      coordinates: [coordinate({ routePath: "/search?q=%5BREDACTED%5D&q=%5BREDACTED%5D" })],
    });
    expect(parseContract(source(value))).toEqual(value);
  });

  it.each([
    "/search?q=[REDACTED]",
    "/search?q=%5bREDACTED%5d",
    "/search?q=%5BREDACTED%5D&",
    "/search?q=%5BREDACTED%5D&&page=%5BREDACTED%5D",
  ])("rejects non-canonical redacted route path %s", (routePath) => {
    expectContractIssues(
      source(contract({ coordinates: [coordinate({ routePath })] })),
      [{ code: "invalid_value", path: "$.coordinates[0].routePath" }],
    );
  });

  it("rejects duplicate and unsorted coordinate identities", () => {
    const first = coordinate();
    const second = coordinate({
      id: "account/public/desktop/light",
      routeId: "account",
      routePath: "/account",
    });
    expectContractIssues(source(contract({ coordinates: [first, first] })), [{
      code: "duplicate",
      path: "$.coordinates[1].id",
    }]);
    expectContractIssues(source(contract({ coordinates: [first, second] })), [{
      code: "invalid_value",
      path: "$.coordinates",
    }]);
  });

  it("sorts coordinates by their four-field tuple rather than their joined id", () => {
    const first = coordinate();
    const second = coordinate({
      id: "home-alt/public/desktop/light",
      routeId: "home-alt",
      routePath: "/home-alt",
    });
    const value = contract({ coordinates: [first, second] });

    expect(parseContract(source(value))).toEqual(value);
    expect(JSON.parse(canonicalizeContract(value))).toMatchObject({
      coordinates: [{ id: first.id }, { id: second.id }],
    });
    expectContractIssues(source(contract({ coordinates: [second, first] })), [{
      code: "invalid_value",
      path: "$.coordinates",
    }]);
  });

  it.each([
    [[], "$.coordinates[0].expected.failureCodes", "invalid_value"],
    [["ASSERTION_FAILED", "ASSERTION_FAILED"], "$.coordinates[0].expected.failureCodes[1]", "duplicate"],
    [["PAGE_ERROR", "ASSERTION_FAILED"], "$.coordinates[0].expected.failureCodes", "invalid_value"],
    [["NAVIGATION_FAILED"], "$.coordinates[0].expected.failureCodes[0]", "invalid_value"],
    [["ASSERTION_FAILED", "CONSOLE_ERROR", "FAILED_REQUEST", "PAGE_ERROR", "PAGE_ERROR"], "$.coordinates[0].expected.failureCodes", "invalid_value"],
  ])("rejects invalid known-failure codes %#", (failureCodes, path, code) => {
    const value = contract({
      coordinates: [coordinate({
        expected: {
          exception: {
            createdOn: "2026-09-02",
            expiresOn: "2026-09-03",
            owner: "owner",
            reason: "reason",
          },
          failureCodes: failureCodes as never,
          status: "failed",
        },
      })],
    });
    expectContractIssues(source(value), [{ code, path }]);
  });

  it.each([
    ["owner", "   ", "$.coordinates[0].expected.exception.owner"],
    ["reason", "\t", "$.coordinates[0].expected.exception.reason"],
  ])("rejects an empty known-failure %s", (field, emptyValue, path) => {
    const exception = {
      createdOn: "2026-09-02",
      expiresOn: "2026-09-03",
      owner: "owner",
      reason: "reason",
      [field]: emptyValue,
    };
    const value = contract({
      coordinates: [coordinate({
        expected: {
          exception,
          failureCodes: ["ASSERTION_FAILED"],
          status: "failed",
        },
      })],
    });
    expectContractIssues(source(value), [{ code: "invalid_value", path }]);
  });

  it("enforces the 1,024-character contract text boundary", () => {
    const exactOwner = "o".repeat(1_024);
    const exactRoutePath = `/${"a".repeat(1_023)}`;
    const exactScenarioSource = `./${"a".repeat(1_022)}`;
    const exact = contract({
      coordinates: [coordinate({
        expected: {
          exception: {
            createdOn: "2026-09-02",
            expiresOn: "2026-09-03",
            owner: exactOwner,
            reason: "reason",
          },
          failureCodes: ["ASSERTION_FAILED"],
          status: "failed",
        },
        routePath: exactRoutePath,
        scenarioSource: exactScenarioSource,
      })],
    });
    expect(parseContract(source(exact))).toEqual(exact);

    for (const [value, path] of [
      [contract({ coordinates: [coordinate({ routePath: `/${"a".repeat(1_024)}` })] }), "$.coordinates[0].routePath"],
      [contract({ coordinates: [coordinate({ scenarioSource: `./${"a".repeat(1_023)}` })] }), "$.coordinates[0].scenarioSource"],
      [contract({ coordinates: [coordinate({ expected: { exception: { createdOn: "2026-09-02", expiresOn: "2026-09-03", owner: "o".repeat(1_025), reason: "reason" }, failureCodes: ["ASSERTION_FAILED"], status: "failed" } })] }), "$.coordinates[0].expected.exception.owner"],
      [contract({ coordinates: [coordinate({ expected: { exception: { createdOn: "2026-09-02", expiresOn: "2026-09-03", owner: "owner", reason: "r".repeat(1_025) }, failureCodes: ["ASSERTION_FAILED"], status: "failed" } })] }), "$.coordinates[0].expected.exception.reason"],
    ] as const) {
      expectContractIssues(source(value), [{ code: "invalid_value", path }]);
    }
  });

  it("enforces the 10,000-coordinate contract boundary", () => {
    const coordinates = Array.from({ length: 10_001 }, (_, index) => {
      const routeId = `route-${String(index).padStart(5, "0")}`;
      return coordinate({
        id: `${routeId}/public/desktop/light`,
        routeId,
        routePath: `/${routeId}`,
      });
    });
    const atLimit = contract({ coordinates: coordinates.slice(0, 10_000) });
    expect(parseContract(source(atLimit)).coordinates).toHaveLength(10_000);
    expectContractIssues(source(contract({ coordinates })), [{
      code: "invalid_value",
      path: "$.coordinates",
    }]);
  });

  it.each([
    ["2026-09-02", "2026-09-02"],
    ["2026-09-02", "2026-10-03"],
    ["2026-02-29", "2026-03-01"],
    ["0000-01-01", "0000-01-02"],
  ])("rejects invalid exception dates from %s to %s", (createdOn, expiresOn) => {
    const value = contract({
      coordinates: [coordinate({
        expected: {
          exception: { createdOn, expiresOn, owner: "owner", reason: "reason" },
          failureCodes: ["ASSERTION_FAILED"],
          status: "failed",
        },
      })],
    });
    expectContractIssues(source(value), [{
      code: "invalid_value",
      path: expect.stringMatching(/^\$\.coordinates\[0\]\.expected\.exception/u) as unknown as string,
    }]);
  });

  it.each([1, 30])("accepts a %d-day exception window", (days) => {
    const expiresOn = days === 1 ? "2026-09-03" : "2026-10-02";
    const value = contract({
      coordinates: [coordinate({
        expected: {
          exception: {
            createdOn: "2026-09-02",
            expiresOn,
            owner: "owner",
            reason: "reason",
          },
          failureCodes: ["ASSERTION_FAILED"],
          status: "failed",
        },
      })],
    });
    expect(parseContract(source(value))).toEqual(value);
  });
});

describe("RFC 8785 canonical JSON", () => {
  it("matches the official primitive serialization example", () => {
    const input: JsonValue = {
      numbers: [Number("333333333.33333329"), 1e30, 4.50, 2e-3, 1e-27],
      string: "€$\u000f\nA'B\"\\\\\"/",
      literals: [null, true, false],
    };
    expect(canonicalizeJson(input)).toBe(
      "{\"literals\":[null,true,false],\"numbers\":[333333333.3333333,1e+30,4.5,0.002,1e-27],\"string\":\"€$\\u000f\\nA'B\\\"\\\\\\\\\\\"/\"}",
    );
    expect(CANONICAL_JSON_ALGORITHM).toBe("jcs-rfc8785");
  });

  it("uses recursive UTF-16 key ordering and preserves array order", () => {
    const orderingValue: JsonValue = {
      "€": "Euro Sign",
      "\r": "Carriage Return",
      "דּ": "Hebrew Letter Dalet With Dagesh",
      "1": "One",
      "😀": "Emoji: Grinning Face",
      "\u0080": "Control",
      "ö": "Latin Small Letter O With Diaeresis",
    };
    expect(canonicalizeJson(orderingValue)).toBe(
      '{"\\r":"Carriage Return","1":"One","":"Control","ö":"Latin Small Letter O With Diaeresis","€":"Euro Sign","😀":"Emoji: Grinning Face","דּ":"Hebrew Letter Dalet With Dagesh"}',
    );
    expect(canonicalizeJson({ nested: [{ z: 1, a: 2 }, "last", "first"] })).toBe(
      '{"nested":[{"a":2,"z":1},"last","first"]}',
    );
  });

  it("preserves Unicode without normalization", () => {
    const composed = canonicalizeJson({ value: "é" });
    const decomposed = canonicalizeJson({ value: "e\u0301" });
    expect(composed).not.toBe(decomposed);
    expect(JSON.parse(composed)).toEqual({ value: "é" });
    expect(JSON.parse(decomposed)).toEqual({ value: "e\u0301" });
  });

  it("produces stable prefixed SHA-256 digests", () => {
    expect(canonicalJsonDigest({ b: 2, a: 1 })).toBe(
      "sha256:43258cff783fe7036d8a43033f830adfc60ec037382473548ac742b888292777",
    );
    expect(canonicalJsonDigest({ a: 1, b: 2 })).toBe(
      canonicalJsonDigest({ b: 2, a: 1 }),
    );
  });

  it.each([
    ["undefined", undefined],
    ["function", () => undefined],
    ["symbol", Symbol("value")],
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
    ["negative zero", -0],
    ["lone surrogate", "\ud800"],
    ["Date/toJSON", new Date("2026-09-02T00:00:00.000Z")],
  ])("rejects the non-JSON programmatic value %s", (_label, value) => {
    expect(() => canonicalizeJson(value as never)).toThrow(CanonicalJsonError);
  });

  it("rejects cycles, sparse arrays, named properties, accessors, and symbol keys", () => {
    const cyclic: Record<string, unknown> = {};
    cyclic["self"] = cyclic;
    expect(() => canonicalizeJson(cyclic as never)).toThrow(CanonicalJsonError);

    const sparse = Array.from({ length: 1 }) as unknown[];
    delete sparse[0];
    expect(() => canonicalizeJson(sparse as never)).toThrow(CanonicalJsonError);

    const named = [] as unknown[] & { extra?: unknown };
    named.extra = true;
    expect(() => canonicalizeJson(named as never)).toThrow(CanonicalJsonError);

    const accessor = Object.defineProperty({}, "value", {
      enumerable: true,
      get: () => 1,
    });
    expect(() => canonicalizeJson(accessor as never)).toThrow(CanonicalJsonError);

    const symbolKey = { value: 1 } as Record<PropertyKey, unknown>;
    symbolKey[Symbol("secret")] = 2;
    expect(() => canonicalizeJson(symbolKey as never)).toThrow(CanonicalJsonError);
  });

  it("rejects inherited toJSON behavior before invoking the canonicalizer", () => {
    class JsonArray extends Array<unknown> {
      toJSON(): unknown {
        return { replaced: true };
      }
    }
    expect(() => canonicalizeJson(new JsonArray(1, 2) as never)).toThrow(
      CanonicalJsonError,
    );

    const originalArrayToJson = Object.getOwnPropertyDescriptor(
      Array.prototype,
      "toJSON",
    );
    Object.defineProperty(Array.prototype, "toJSON", {
      configurable: true,
      value: () => ({ replaced: true }),
    });
    try {
      expect(() => canonicalizeJson([1, 2])).toThrow(CanonicalJsonError);
    } finally {
      if (originalArrayToJson === undefined) {
        Reflect.deleteProperty(Array.prototype, "toJSON");
      } else {
        Object.defineProperty(Array.prototype, "toJSON", originalArrayToJson);
      }
    }

    const original = Object.getOwnPropertyDescriptor(Object.prototype, "toJSON");
    Object.defineProperty(Object.prototype, "toJSON", {
      configurable: true,
      value: () => ({ replaced: true }),
    });
    try {
      expect(() => canonicalizeJson({ value: 1 })).toThrow(CanonicalJsonError);
    } finally {
      if (original === undefined) {
        Reflect.deleteProperty(Object.prototype, "toJSON");
      } else {
        Object.defineProperty(Object.prototype, "toJSON", original);
      }
    }
  });

  it("canonicalizes one validated snapshot and wraps hostile proxy traps", () => {
    const inconsistent = new Proxy({ value: 1 }, {
      get: (_target, property, receiver) =>
        property === "value" ? undefined : Reflect.get(_target, property, receiver),
    });
    expect(canonicalizeJson(inconsistent)).toBe('{"value":1}');

    const throwing = new Proxy({ value: 1 }, {
      ownKeys: () => {
        throw new Error("untrusted trap");
      },
    });
    expect(() => canonicalizeJson(throwing)).toThrow(CanonicalJsonError);
  });
});

describe("contract canonicalization", () => {
  it("normalizes domain arrays before JCS and digesting", () => {
    const first = coordinate({
      expected: {
        exception: {
          createdOn: "2026-09-02",
          expiresOn: "2026-09-03",
          owner: "owner",
          reason: "reason",
        },
        failureCodes: ["ASSERTION_FAILED", "PAGE_ERROR"],
        status: "failed",
      },
    });
    const second = coordinate({
      id: "orders/public/desktop/light",
      routeId: "orders",
      routePath: "/orders",
    });
    const value = contract({ coordinates: [first, second] });
    const canonical = canonicalizeContract(value);

    expect(canonical).toBe(
      '{"configDigest":"sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","coordinates":[{"configFingerprint":"sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","expected":{"exception":{"createdOn":"2026-09-02","expiresOn":"2026-09-03","owner":"owner","reason":"reason"},"failureCodes":["ASSERTION_FAILED","PAGE_ERROR"],"status":"failed"},"id":"home/public/desktop/light","routeId":"home","routePath":"/","scenarioSource":"./uiwitness/scenarios/public.mjs","stateId":"public","theme":"light","viewport":{"height":900,"width":1440},"viewportId":"desktop"},{"configFingerprint":"sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","expected":{"status":"passed"},"id":"orders/public/desktop/light","routeId":"orders","routePath":"/orders","scenarioSource":"./uiwitness/scenarios/public.mjs","stateId":"public","theme":"light","viewport":{"height":900,"width":1440},"viewportId":"desktop"}],"schemaVersion":1}',
    );
    expect(contractDigest(value)).toBe(
      "sha256:32fae8b67d238454e44bcc75d3bb5452c1bd173d3de3956226a3cc8cf858a9e4",
    );
  });
});

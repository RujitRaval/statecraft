import { describe, expect, it } from "vitest";

import {
  CONTRACT_CONFIG_DIGEST_ALGORITHM,
  CONTRACT_FINDING_KINDS,
  CONTRACT_FINDING_PRECEDENCE,
  ConfigValidationError,
  ContractValidationError,
  ResultValidationError,
  compareContract,
  contractConfigDigest,
  contractDigest,
  contractVerdictStatus,
  type ContractConfigurationCoordinate,
  type ContractExecutionObservation,
  type ContractFailureCode,
  type ContractFinding,
  type UIWitnessContract,
} from "../src/index.js";

const fingerprintA = `sha256:${"a".repeat(64)}` as const;
const fingerprintB = `sha256:${"b".repeat(64)}` as const;

function configurationCoordinate(
  routeId: string,
  overrides: Partial<ContractConfigurationCoordinate> = {},
): ContractConfigurationCoordinate {
  return {
    configFingerprint: fingerprintA,
    id: `${routeId}/public/desktop/light`,
    routeId,
    routePath: routeId === "home" ? "/" : `/${routeId}`,
    scenarioSource: `./uiwitness/scenarios/${routeId}.mjs`,
    stateId: "public",
    theme: "light",
    viewport: { height: 900, width: 1440 },
    viewportId: "desktop",
    ...overrides,
  };
}

function contract(
  entries: readonly {
    readonly configuration: ContractConfigurationCoordinate;
    readonly expected?: UIWitnessContract["coordinates"][number]["expected"];
  }[],
): UIWitnessContract {
  const coordinates = entries
    .map(({ configuration, expected = { status: "passed" } }) => ({
      ...configuration,
      expected,
    }))
    .sort((left, right) => {
      const leftTuple = [left.routeId, left.stateId, left.viewportId, left.theme];
      const rightTuple = [right.routeId, right.stateId, right.viewportId, right.theme];
      for (let index = 0; index < leftTuple.length; index += 1) {
        if (leftTuple[index]! < rightTuple[index]!) return -1;
        if (leftTuple[index]! > rightTuple[index]!) return 1;
      }
      return 0;
    });
  return {
    configDigest: contractConfigDigest(coordinates),
    coordinates,
    schemaVersion: 1,
  };
}

function execution(
  configuration: ContractConfigurationCoordinate,
  failureCodes: readonly ContractExecutionObservation["failures"][number]["code"][] = [],
): ContractExecutionObservation {
  return {
    failures: failureCodes.map((code) => ({ code })),
    routeId: configuration.routeId,
    stateId: configuration.stateId,
    status: failureCodes.length === 0 ? "passed" : "failed",
    theme: configuration.theme,
    viewportId: configuration.viewportId,
  };
}

function knownFailure(
  failureCodes: readonly ContractFailureCode[] = ["ASSERTION_FAILED"],
  expiresOn = "2026-09-30",
): UIWitnessContract["coordinates"][number]["expected"] {
  return {
    exception: {
      createdOn: "2026-09-01",
      expiresOn,
      owner: "checkout-team",
      reason: "UIW-1842 tracks the repair",
    },
    failureCodes,
    status: "failed",
  };
}

function compare(options: {
  readonly complete?: boolean;
  readonly configuration: readonly ContractConfigurationCoordinate[];
  readonly contract: UIWitnessContract;
  readonly executions: readonly ContractExecutionObservation[];
  readonly now?: Date;
}) {
  return compareContract({
    complete: options.complete ?? true,
    configuration: options.configuration,
    contract: options.contract,
    executions: options.executions,
    now: () => options.now ?? new Date("2026-09-15T12:00:00.000Z"),
  });
}

describe("contract comparison truth table", () => {
  it("classifies an unchanged passing coordinate as matched", () => {
    const home = configurationCoordinate("home");
    const result = compare({
      configuration: [home],
      contract: contract([{ configuration: home }]),
      executions: [execution(home)],
    });

    expect(result).toMatchObject({
      complete: true,
      configDigest: contractConfigDigest([home]),
      evaluatedOn: "2026-09-15",
      verdict: "passed",
    });
    expect(result.contractDigest).toMatch(/^sha256:[a-f0-9]{64}$/u);
    expect(result.findings).toEqual([{
      actual: { status: "passed" },
      expected: { status: "passed" },
      id: home.id,
      kind: "matched",
    }]);
  });

  it("classifies a passing expectation with sorted unique actual failures as a regression", () => {
    const home = configurationCoordinate("home");
    const result = compare({
      configuration: [home],
      contract: contract([{ configuration: home }]),
      executions: [execution(home, ["PAGE_ERROR", "ASSERTION_FAILED", "PAGE_ERROR"])],
    });

    expect(result.verdict).toBe("failed");
    expect(result.findings[0]).toMatchObject({
      actual: {
        failureCodes: ["ASSERTION_FAILED", "PAGE_ERROR"],
        status: "failed",
      },
      kind: "regression",
    });
  });

  it("matches only the exact active known-failure code set", () => {
    const home = configurationCoordinate("home");
    const expected = knownFailure(["ASSERTION_FAILED", "PAGE_ERROR"]);
    const result = compare({
      configuration: [home],
      contract: contract([{ configuration: home, expected }]),
      executions: [execution(home, ["PAGE_ERROR", "ASSERTION_FAILED"])],
    });

    expect(result.verdict).toBe("passed");
    expect(result.findings[0]).toMatchObject({
      actual: { failureCodes: ["ASSERTION_FAILED", "PAGE_ERROR"] },
      expected,
      kind: "matched-known-failure",
    });
  });

  it.each([
    ["added", ["ASSERTION_FAILED"], ["ASSERTION_FAILED", "PAGE_ERROR"]],
    ["removed", ["ASSERTION_FAILED", "PAGE_ERROR"], ["ASSERTION_FAILED"]],
    ["substituted", ["ASSERTION_FAILED"], ["CONSOLE_ERROR"]],
    ["ineligible", ["ASSERTION_FAILED"], ["ASSERTION_FAILED", "NAVIGATION_FAILED"]],
  ] as const)("classifies a %s code set as a changed known failure", (
    _label,
    expectedCodes,
    actualCodes,
  ) => {
    const home = configurationCoordinate("home");
    const result = compare({
      configuration: [home],
      contract: contract([{
        configuration: home,
        expected: knownFailure(expectedCodes),
      }]),
      executions: [execution(home, actualCodes)],
    });

    expect(result.verdict).toBe("failed");
    expect(result.findings[0]?.kind).toBe("changed-known-failure");
  });

  it("classifies a passing known failure as recovered contract debt", () => {
    const home = configurationCoordinate("home");
    const result = compare({
      configuration: [home],
      contract: contract([{ configuration: home, expected: knownFailure() }]),
      executions: [execution(home)],
    });

    expect(result).toMatchObject({ verdict: "failed" });
    expect(result.findings[0]?.kind).toBe("recovered-known-failure");
  });

  it("keeps an exception active through its expiry date in UTC", () => {
    const home = configurationCoordinate("home");
    const result = compare({
      configuration: [home],
      contract: contract([{
        configuration: home,
        expected: knownFailure(["ASSERTION_FAILED"], "2026-09-30"),
      }]),
      executions: [execution(home, ["ASSERTION_FAILED"])],
      now: new Date("2026-09-30T23:59:59.999Z"),
    });

    expect(result.evaluatedOn).toBe("2026-09-30");
    expect(result.verdict).toBe("passed");
    expect(result.findings[0]?.kind).toBe("matched-known-failure");
  });

  it.each([
    [[], "recovered-known-failure"],
    [["ASSERTION_FAILED"], "matched-known-failure"],
    [["PAGE_ERROR"], "changed-known-failure"],
  ] as const)("expires an exception and retains the %s observed outcome", (
    actualCodes,
    observedKind,
  ) => {
    const home = configurationCoordinate("home");
    const result = compare({
      configuration: [home],
      contract: contract([{
        configuration: home,
        expected: knownFailure(["ASSERTION_FAILED"], "2026-09-30"),
      }]),
      executions: [execution(home, actualCodes)],
      now: new Date("2026-10-01T00:00:00.000Z"),
    });

    expect(result.evaluatedOn).toBe("2026-10-01");
    expect(result.verdict).toBe("failed");
    expect(result.findings.map((finding) => finding.kind)).toEqual([
      "expired-exception",
      observedKind,
    ]);
  });

  it("reports both an addition and contract matrix shrinkage", () => {
    const home = configurationCoordinate("home");
    const orders = configurationCoordinate("orders");
    const result = compare({
      configuration: [orders],
      contract: contract([{ configuration: home }]),
      executions: [execution(orders)],
    });

    expect(result.verdict).toBe("failed");
    expect(result.findings.map(({ id, kind }) => [id, kind])).toEqual([
      [home.id, "missing-coordinate"],
      [orders.id, "unaccepted-addition"],
    ]);
  });

  it("does not compare an expectation after its configuration fingerprint drifts", () => {
    const home = configurationCoordinate("home");
    const changed = configurationCoordinate("home", { configFingerprint: fingerprintB });
    const result = compare({
      configuration: [changed],
      contract: contract([{ configuration: home }]),
      executions: [execution(changed, ["ASSERTION_FAILED"])],
    });

    expect(result.findings).toEqual([expect.objectContaining({
      contractConfigFingerprint: fingerprintA,
      currentConfigFingerprint: fingerprintB,
      kind: "unaccepted-config-drift",
    })]);
  });

  it("retains expiry beneath higher-precedence drift for the same coordinate", () => {
    const home = configurationCoordinate("home");
    const changed = configurationCoordinate("home", { configFingerprint: fingerprintB });
    const result = compare({
      configuration: [changed],
      contract: contract([{
        configuration: home,
        expected: knownFailure(["ASSERTION_FAILED"], "2026-09-14"),
      }]),
      executions: [execution(changed)],
    });

    expect(result.findings.map((finding) => finding.kind)).toEqual([
      "unaccepted-config-drift",
      "expired-exception",
    ]);
  });
});

describe("comparison completeness, ordering, and precedence", () => {
  it("short-circuits a declared incomplete run without semantic comparison", () => {
    const home = configurationCoordinate("home");
    const result = compare({
      complete: false,
      configuration: [home],
      contract: contract([{ configuration: home }]),
      executions: [execution(home, ["ASSERTION_FAILED"])],
    });

    expect(result).toMatchObject({ complete: false, verdict: "error" });
    expect(result.findings).toEqual([{
      id: null,
      kind: "run-error",
      reasons: ["declared-incomplete"],
    }]);
  });

  it("fails closed when a declared-complete execution set is missing a coordinate", () => {
    const home = configurationCoordinate("home");
    const result = compare({
      configuration: [home],
      contract: contract([{ configuration: home }]),
      executions: [],
    });

    expect(result).toMatchObject({ complete: false, verdict: "error" });
    expect(result.findings).toEqual([{
      id: home.id,
      kind: "run-error",
      reasons: ["missing-execution"],
    }]);
  });

  it("fails closed for unexpected and duplicate execution coordinates", () => {
    const home = configurationCoordinate("home");
    const orders = configurationCoordinate("orders");
    const result = compare({
      configuration: [home],
      contract: contract([{ configuration: home }]),
      executions: [execution(home), execution(home), execution(orders)],
    });

    expect(result.findings).toEqual([
      { id: home.id, kind: "run-error", reasons: ["duplicate-execution-coordinate"] },
      { id: orders.id, kind: "run-error", reasons: ["unexpected-execution"] },
    ]);
  });

  it("consolidates duplicate and unexpected reasons for the same execution coordinate", () => {
    const home = configurationCoordinate("home");
    const orders = configurationCoordinate("orders");
    const result = compare({
      configuration: [home],
      contract: contract([{ configuration: home }]),
      executions: [execution(home), execution(orders), execution(orders)],
    });

    expect(result.findings).toEqual([{
      id: orders.id,
      kind: "run-error",
      reasons: ["duplicate-execution-coordinate", "unexpected-execution"],
    }]);
  });

  it.each([
    ["passed with failures", { failures: [{ code: "PAGE_ERROR" }], status: "passed" }],
    ["failed without failures", { failures: [], status: "failed" }],
    ["an unknown failure code", { failures: [{ code: "NOT_REAL" }], status: "failed" }],
    ["a malformed coordinate ID", { routeId: "Home Page" }],
  ])("rejects an execution observation containing %s", (_label, mutation) => {
    const home = configurationCoordinate("home");
    const invalid = { ...execution(home), ...mutation };
    expect(() => compareContract({
      complete: true,
      configuration: [home],
      contract: contract([{ configuration: home }]),
      executions: [invalid as ContractExecutionObservation],
    })).toThrowError(ResultValidationError);
  });

  it("rejects duplicate configured coordinate IDs before run comparison", () => {
    const home = configurationCoordinate("home");
    expect(() => compare({
      configuration: [home, home],
      contract: contract([{ configuration: home }]),
      executions: [execution(home)],
    })).toThrowError(ConfigValidationError);
  });

  it("reports malformed configuration at the public option path", () => {
    const home = configurationCoordinate("home");
    for (const configuration of [
      [{ ...home, routeId: "Home Page" }],
      [home, { ...home, routeId: Symbol("bad") }],
      [null],
      [],
    ]) {
      try {
        compareContract({
          complete: true,
          configuration: configuration as ContractConfigurationCoordinate[],
          contract: contract([{ configuration: home }]),
          executions: [execution(home)],
        });
        expect.fail("Expected invalid configuration to be rejected.");
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigValidationError);
        expect((error as ConfigValidationError).issues[0]?.path).toMatch(
          /^\$\.configuration/u,
        );
      }
    }
  });

  it("rejects configuration and execution inventories above 10,000 entries", () => {
    const home = configurationCoordinate("home");
    const expected = contract([{ configuration: home }]);

    expect(() => compareContract({
      complete: true,
      configuration: Array.from({ length: 10_001 }, () => home),
      contract: expected,
      executions: [execution(home)],
    })).toThrowError(ConfigValidationError);
    expect(() => compareContract({
      complete: true,
      configuration: [home],
      contract: expected,
      executions: Array.from({ length: 10_001 }, () => execution(home)),
    })).toThrowError(ResultValidationError);
  });

  it("bounds execution-observation diagnostics deterministically", () => {
    const home = configurationCoordinate("home");
    const invalid = Array.from({ length: 200 }, () => ({
      ...execution(home),
      routeId: "Home Page",
    })) as ContractExecutionObservation[];
    try {
      compareContract({
        complete: true,
        configuration: [home],
        contract: contract([{ configuration: home }]),
        executions: invalid,
      });
      expect.fail("Expected invalid observations to be rejected.");
    } catch (error) {
      expect(error).toBeInstanceOf(ResultValidationError);
      expect((error as ResultValidationError).issues).toHaveLength(100);
      expect((error as ResultValidationError).issues.at(-1)).toMatchObject({
        message: expect.stringContaining("omitted"),
        path: "$.executions",
      });
    }
  });

  it("produces identical canonical ordering for input permutations", () => {
    const home = configurationCoordinate("home");
    const orders = configurationCoordinate("orders");
    const expected = contract([
      { configuration: home },
      { configuration: orders, expected: knownFailure() },
    ]);
    const first = compare({
      configuration: [orders, home],
      contract: expected,
      executions: [execution(orders), execution(home, ["PAGE_ERROR"])],
    });
    const second = compare({
      configuration: [home, orders],
      contract: expected,
      executions: [execution(home, ["PAGE_ERROR"]), execution(orders)],
    });

    expect(first).toEqual(second);
    expect(first.findings.map(({ id, kind }) => [id, kind])).toEqual([
      [home.id, "regression"],
      [orders.id, "recovered-known-failure"],
    ]);
  });

  it("digests configuration in coordinate-tuple order rather than joined-ID order", () => {
    const short = configurationCoordinate("a");
    const extended = configurationCoordinate("a-a");

    expect(contractConfigDigest([short, extended])).toBe(
      contractConfigDigest([extended, short]),
    );
    expect(contractConfigDigest([short, extended])).toBe(
      "sha256:5fe11b671e2838c6945770c08c9b469a754543f13de4ff92c4e24bee1e6135e3",
    );
    expect(contract([
      { configuration: extended },
      { configuration: short },
    ]).coordinates.map((coordinate) => coordinate.routeId)).toEqual(["a", "a-a"]);
  });

  it("locks the configuration digest protocol to a fixed vector", () => {
    const a = configurationCoordinate("a", {
      scenarioSource: "./a.mjs",
    });
    const b = configurationCoordinate("b", {
      configFingerprint: fingerprintB,
      scenarioSource: "./b.mjs",
    });

    expect(contractConfigDigest([b, a])).toBe(
      "sha256:f59ee187df60ddbd89c43fefd43c51524dbf14f26705e4f96a9f76b95f7ed10a",
    );
  });

  it.each([
    [[{ id: "home", kind: "matched" }], "passed"],
    [[{ id: "home", kind: "matched-known-failure" }], "passed"],
    [[{ id: "home", kind: "recovered-known-failure" }], "failed"],
    [[{ id: null, kind: "run-error" }], "error"],
    [[{ id: null, kind: "run-error" }, { id: "home", kind: "regression" }], "error"],
  ] as const)("selects overall verdict precedence %#", (findings, verdict) => {
    expect(contractVerdictStatus(findings as unknown as readonly ContractFinding[])).toBe(verdict);
  });

  it("covers every pairwise overall-precedence combination", () => {
    for (const left of CONTRACT_FINDING_KINDS) {
      for (const right of CONTRACT_FINDING_KINDS) {
        const findings = [left, right].map((kind) => ({
          id: kind === "run-error" ? null : "home/public/desktop/light",
          kind,
        })) as unknown as readonly ContractFinding[];
        const expected = left === "run-error" || right === "run-error"
          ? "error"
          : [left, right].every((kind) =>
              kind === "matched" || kind === "matched-known-failure"
            )
            ? "passed"
            : "failed";
        expect(contractVerdictStatus(findings), `${left} + ${right}`).toBe(expected);
      }
    }
  });

  it("publishes one stable total finding precedence", () => {
    expect(CONTRACT_CONFIG_DIGEST_ALGORITHM).toBe("jcs-rfc8785+config-v1");
    expect(CONTRACT_FINDING_KINDS).toEqual([
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
    ]);
    expect(CONTRACT_FINDING_KINDS.map((kind) => CONTRACT_FINDING_PRECEDENCE[kind]))
      .toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("rejects a contract whose config digest does not describe its coordinates", () => {
    const home = configurationCoordinate("home");
    const invalid = {
      ...contract([{ configuration: home }]),
      configDigest: fingerprintB,
    };

    expect(() => compare({
      configuration: [home],
      contract: invalid,
      executions: [execution(home)],
    })).toThrowError(ContractValidationError);
  });

  it("uses owned input snapshots when the clock callback mutates caller data", () => {
    const home = configurationCoordinate("home");
    const expected = contract([{ configuration: home }]);
    const observed = execution(home, ["ASSERTION_FAILED"]);
    const originalDigest = contractDigest(expected);
    const originalConfigDigest = contractConfigDigest([home]);
    const result = compareContract({
      complete: true,
      configuration: [home],
      contract: expected,
      executions: [observed],
      now: () => {
        (expected.coordinates[0] as unknown as { expected: unknown }).expected = knownFailure();
        (home as unknown as { configFingerprint: string }).configFingerprint = fingerprintB;
        (observed as unknown as { failures: unknown[] }).failures = [];
        (observed as unknown as { status: string }).status = "passed";
        return new Date("2026-09-15T00:00:00.000Z");
      },
    });

    expect(result.contractDigest).toBe(originalDigest);
    expect(result.configDigest).toBe(originalConfigDigest);
    expect(result.verdict).toBe("failed");
    expect(result.findings.map((finding) => finding.kind)).toEqual(["regression"]);
  });

  it("captures and validates completeness before invoking the clock", () => {
    const home = configurationCoordinate("home");
    const options = {
      complete: false,
      configuration: [home],
      contract: contract([{ configuration: home }]),
      executions: [execution(home)],
      now: () => {
        options.complete = true;
        return new Date("2026-09-15T00:00:00.000Z");
      },
    };

    expect(compareContract(options).verdict).toBe("error");
    expect(() => compareContract({
      ...options,
      complete: "yes" as unknown as boolean,
    })).toThrowError(ResultValidationError);
  });

  it("reads the completeness signal exactly once", () => {
    const home = configurationCoordinate("home");
    let reads = 0;
    const options = {
      get complete(): boolean {
        reads += 1;
        return reads === 1 ? false : "yes" as unknown as boolean;
      },
      configuration: [home],
      contract: contract([{ configuration: home }]),
      executions: [execution(home)],
    };

    expect(compareContract(options).verdict).toBe("error");
    expect(reads).toBe(1);
  });

  it("rejects a known-failure exception created after the evaluation date", () => {
    const home = configurationCoordinate("home");
    const futureExpected = {
      ...knownFailure(["ASSERTION_FAILED"], "2099-01-31"),
      exception: {
        createdOn: "2099-01-01",
        expiresOn: "2099-01-31",
        owner: "checkout-team",
        reason: "UIW-1842 tracks the repair",
      },
    } as const;
    expect(() => compare({
      configuration: [home],
      contract: contract([{ configuration: home, expected: futureExpected }]),
      executions: [execution(home, ["ASSERTION_FAILED"])],
      now: new Date("2026-09-15T00:00:00.000Z"),
    })).toThrowError(ContractValidationError);
  });

  it("returns recursively frozen findings detached from caller-owned expectations", () => {
    const home = configurationCoordinate("home");
    const expected = knownFailure();
    const source = contract([{ configuration: home, expected }]);
    const result = compare({
      configuration: [home],
      contract: source,
      executions: [execution(home, ["ASSERTION_FAILED"])],
    });
    const finding = result.findings[0]!;
    const findingExpected = "expected" in finding ? finding.expected : null;
    const findingActual = "actual" in finding ? finding.actual : null;

    (expected as unknown as { exception: { owner: string } }).exception.owner = "mutated";
    expect(findingExpected).toMatchObject({
      exception: { owner: "checkout-team" },
      failureCodes: ["ASSERTION_FAILED"],
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.findings)).toBe(true);
    expect(Object.isFrozen(finding)).toBe(true);
    expect(Object.isFrozen(findingExpected)).toBe(true);
    expect(Object.isFrozen(
      findingExpected?.status === "failed" ? findingExpected.exception : null,
    )).toBe(true);
    expect(Object.isFrozen(
      findingExpected?.status === "failed" ? findingExpected.failureCodes : null,
    )).toBe(true);
    expect(Object.isFrozen(findingActual)).toBe(true);
  });

  it("rejects an invalid injected clock", () => {
    const home = configurationCoordinate("home");
    expect(() => compareContract({
      complete: true,
      configuration: [home],
      contract: contract([{ configuration: home }]),
      executions: [execution(home)],
      now: () => new Date(Number.NaN),
    })).toThrowError("The contract comparison clock must return a valid Date.");
  });

  it("rejects injected clock values outside the contract calendar range", () => {
    const home = configurationCoordinate("home");
    expect(() => compareContract({
      complete: true,
      configuration: [home],
      contract: contract([{ configuration: home }]),
      executions: [execution(home)],
      now: () => new Date("+010000-01-01T00:00:00.000Z"),
    })).toThrowError("The contract comparison clock must use years 0001 through 9999.");
  });
});

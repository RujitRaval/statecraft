import { describe, expect, it } from "vitest";

import {
  ContractProposalValidationError,
  applyContractProposal,
  contractConfigDigest,
  contractProposalDigest,
  contractProposalSourceDigest,
  createContractProposal,
  createContractProposalSource,
  emptyContractProposalMetadata,
  parseContractProposal,
  parseContractProposalMetadata,
  parseContractProposalSource,
  serializeContractProposal,
  serializeContractProposalMetadata,
  serializeContractProposalSource,
  withContractProposalAnnotation,
  type ContractConfigurationCoordinate,
  type ContractSourceExecution,
  type ExecutionFailureCode,
  type UIWitnessContract,
} from "../src/index.js";

const fingerprintA = `sha256:${"a".repeat(64)}` as const;
const fingerprintB = `sha256:${"b".repeat(64)}` as const;
const runDigest = `sha256:${"c".repeat(64)}` as const;

function configuration(
  routeId: string,
  fingerprint = fingerprintA,
): ContractConfigurationCoordinate {
  return {
    configFingerprint: fingerprint,
    id: `${routeId}/public/desktop/light`,
    routeId,
    routePath: routeId === "home" ? "/" : `/${routeId}`,
    scenarioSource: `./uiwitness/scenarios/${routeId}.mjs`,
    stateId: "public",
    theme: "light",
    viewport: { height: 900, width: 1440 },
    viewportId: "desktop",
  };
}

function contract(
  coordinates: readonly ContractConfigurationCoordinate[],
): UIWitnessContract {
  return {
    configDigest: contractConfigDigest(coordinates),
    coordinates: coordinates.map((coordinate) => ({
      ...coordinate,
      expected: { status: "passed" },
    })),
    schemaVersion: 1,
  };
}

function execution(
  coordinate: ContractConfigurationCoordinate,
  failureCodes: readonly ExecutionFailureCode[] = [],
): ContractSourceExecution {
  return failureCodes.length === 0
    ? { actual: { status: "passed" }, id: coordinate.id }
    : { actual: { failureCodes, status: "failed" }, id: coordinate.id };
}

describe("contract proposals", () => {
  it("creates canonical content-addressed sources and stable named changes", () => {
    const home = configuration("home");
    const settings = configuration("settings");
    const source = createContractProposalSource({
      configuration: [settings, home],
      contract: null,
      evaluatedOn: "2026-09-03",
      executions: [execution(settings, ["ASSERTION_FAILED"]), execution(home)],
      runDigest,
    });
    const proposal = createContractProposal(source, "0.26.2");

    expect(source.configDigest).toBe(contractConfigDigest([home, settings]));
    expect(contractProposalSourceDigest(source)).toMatch(/^sha256:[a-f0-9]{64}$/u);
    expect(proposal.sourceGenerationDigest).toBe(contractProposalSourceDigest(source));
    expect(proposal.changes.map(({ id }) => id)).toEqual([
      "add:home/public/desktop/light",
      "add:settings/public/desktop/light",
    ]);
    expect(contractProposalDigest(proposal)).toMatch(/^sha256:[a-f0-9]{64}$/u);
    expect(parseContractProposalSource(serializeContractProposalSource(source))).toEqual(source);
    expect(parseContractProposal(serializeContractProposal(proposal))).toEqual(proposal);
    expect(Object.isFrozen(source)).toBe(true);
    expect(Object.isFrozen(source.configuration)).toBe(true);
    expect(Object.isFrozen(source.configuration[0]!.viewport)).toBe(true);
    expect(Object.isFrozen(proposal)).toBe(true);
    expect(Object.isFrozen(proposal.changes[0]!.after)).toBe(true);
    expect(() => parseContractProposalSource(serializeContractProposalSource({
      ...source,
      configuration: [...source.configuration].reverse(),
    }))).toThrow(ContractProposalValidationError);
    expect(() => parseContractProposal(serializeContractProposal({
      ...proposal,
      changes: [...proposal.changes].reverse(),
    }))).toThrow(ContractProposalValidationError);
  });

  it("emits only lifecycle-valid add, remove, config, expectation, and exception operations", () => {
    const home = configuration("home");
    const removed = configuration("removed");
    const existing: UIWitnessContract = {
      configDigest: contractConfigDigest([home, removed]),
      coordinates: [{
        ...home,
        expected: {
          exception: {
            createdOn: "2026-08-01",
            expiresOn: "2026-08-15",
            owner: "ui-team",
            reason: "tracked repair",
          },
          failureCodes: ["ASSERTION_FAILED"],
          status: "failed",
        },
      }, { ...removed, expected: { status: "passed" } }],
      schemaVersion: 1,
    };
    const changedHome = configuration("home", fingerprintB);
    const added = configuration("settings");
    const source = createContractProposalSource({
      configuration: [changedHome, added],
      contract: existing,
      evaluatedOn: "2026-09-03",
      executions: [execution(changedHome), execution(added)],
      runDigest,
    });

    expect(createContractProposal(source, "0.26.2").changes.map(({ id }) => id)).toEqual([
      "config:home/public/desktop/light",
      "expectation:home/public/desktop/light",
      "remove:removed/public/desktop/light",
      "add:settings/public/desktop/light",
    ]);

    const renewalSource = createContractProposalSource({
      configuration: [home],
      contract: { ...existing, configDigest: contractConfigDigest([home]), coordinates: [existing.coordinates[0]!] },
      evaluatedOn: "2026-09-03",
      executions: [execution(home, ["ASSERTION_FAILED"])],
      runDigest,
    });
    expect(createContractProposal(renewalSource, "0.26.2").changes.map(({ id }) => id)).toEqual([
      "exception:home/public/desktop/light",
    ]);
  });

  it("requires explicit renewal metadata with a changed reason", () => {
    const home = configuration("home");
    const previousException = {
      createdOn: "2026-08-01",
      expiresOn: "2026-08-15",
      owner: "ui-team",
      reason: "UIW-1842 tracks the café repair",
    };
    const existing: UIWitnessContract = {
      configDigest: contractConfigDigest([home]),
      coordinates: [{
        ...home,
        expected: {
          exception: previousException,
          failureCodes: ["ASSERTION_FAILED"],
          status: "failed",
        },
      }],
      schemaVersion: 1,
    };
    const source = createContractProposalSource({
      configuration: [home],
      contract: existing,
      evaluatedOn: "2026-09-03",
      executions: [execution(home, ["ASSERTION_FAILED"])],
      runDigest,
    });
    const proposal = createContractProposal(source, "0.26.2");
    const changeId = "exception:home/public/desktop/light";

    expect(() => withContractProposalAnnotation(
      proposal,
      emptyContractProposalMetadata(proposal),
      changeId,
      { ...previousException, createdOn: "2026-09-03", expiresOn: "2026-09-17" },
      "2026-09-03",
    )).toThrow(expect.objectContaining({
      issues: expect.arrayContaining([
        expect.objectContaining({
          message: "Renewing an exception requires an updated reason.",
        }),
      ]),
    }));

    expect(() => withContractProposalAnnotation(
      proposal,
      emptyContractProposalMetadata(proposal),
      changeId,
      {
        ...previousException,
        createdOn: "2026-09-03",
        expiresOn: "2026-09-17",
        reason: "UIW-1842 tracks the cafe\u0301 repair",
      },
      "2026-09-03",
    )).toThrow(expect.objectContaining({
      issues: expect.arrayContaining([
        expect.objectContaining({
          message: "Renewing an exception requires an updated reason.",
        }),
      ]),
    }));

    const metadata = withContractProposalAnnotation(
      proposal,
      emptyContractProposalMetadata(proposal),
      changeId,
      {
        createdOn: "2026-09-03",
        expiresOn: "2026-09-17",
        owner: "ui-team",
        reason: "UIW-1842 remains open after the accessibility review",
      },
      "2026-09-03",
    );
    expect(applyContractProposal({
      acceptedOn: "2026-09-03",
      changeIds: [changeId],
      metadata,
      proposal,
      source,
    }).coordinates[0]!.expected).toMatchObject({
      exception: { reason: "UIW-1842 remains open after the accessibility review" },
      failureCodes: ["ASSERTION_FAILED"],
      status: "failed",
    });

    const directMetadata = (exception: typeof previousException) => ({
      annotations: { [changeId]: exception },
      proposalDigest: contractProposalDigest(proposal),
      schemaVersion: 1 as const,
    });
    expect(() => applyContractProposal({
      acceptedOn: "2026-09-03",
      changeIds: [changeId],
      metadata: directMetadata({
        ...previousException,
        createdOn: "2026-09-03",
        expiresOn: "2026-09-17",
      }),
      proposal,
      source,
    })).toThrow(expect.objectContaining({
      issues: expect.arrayContaining([
        expect.objectContaining({
          message: "Renewing an exception requires an updated reason.",
        }),
      ]),
    }));
    expect(() => applyContractProposal({
      acceptedOn: "2026-09-03",
      changeIds: [changeId],
      metadata: directMetadata({
        createdOn: "2026-09-03",
        expiresOn: "2026-10-03",
        owner: "ui-team",
        reason: "UIW-1842 repair is now blocked on the upstream component",
      }),
      proposal,
      source,
    })).not.toThrow();
    expect(() => applyContractProposal({
      acceptedOn: "2026-09-03",
      changeIds: [changeId],
      metadata: directMetadata({
        createdOn: "2026-09-03",
        expiresOn: "2026-10-04",
        owner: "ui-team",
        reason: "UIW-1842 repair is now blocked on the upstream component",
      }),
      proposal,
      source,
    })).toThrow(ContractProposalValidationError);
  });

  it("applies only named changes and requires constrained metadata for failures", () => {
    const home = configuration("home");
    const settings = configuration("settings");
    const source = createContractProposalSource({
      configuration: [home, settings],
      contract: contract([home]),
      evaluatedOn: "2026-09-03",
      executions: [execution(home), execution(settings, ["ASSERTION_FAILED"])],
      runDigest,
    });
    const proposal = createContractProposal(source, "0.26.2");
    const changeId = "add:settings/public/desktop/light";
    const metadata = withContractProposalAnnotation(
      proposal,
      emptyContractProposalMetadata(proposal),
      changeId,
      {
        createdOn: "2026-09-03",
        expiresOn: "2026-09-17",
        owner: "settings-team",
        reason: "UIW-2041 tracks the repair",
      },
      "2026-09-03",
    );
    const accepted = applyContractProposal({
      acceptedOn: "2026-09-03",
      changeIds: [changeId],
      metadata,
      proposal,
      source,
    });

    expect(accepted.coordinates.map(({ id }) => id)).toEqual([home.id, settings.id]);
    expect(accepted.coordinates[1]!.expected).toMatchObject({
      failureCodes: ["ASSERTION_FAILED"],
      status: "failed",
    });
    expect(parseContractProposalMetadata(serializeContractProposalMetadata(metadata))).toEqual(metadata);

    expect(() => applyContractProposal({
      acceptedOn: "2026-09-03",
      changeIds: [changeId],
      metadata: emptyContractProposalMetadata(proposal),
      proposal,
      source,
    })).toThrow(ContractProposalValidationError);
  });

  it("rejects noncanonical bytes, source mutation, duplicate selection, and unknown metadata", () => {
    const home = configuration("home");
    const source = createContractProposalSource({
      configuration: [home],
      contract: null,
      evaluatedOn: "2026-09-03",
      executions: [execution(home)],
      runDigest,
    });
    const proposal = createContractProposal(source, "0.26.2");
    const changeId = proposal.changes[0]!.id;

    expect(() => parseContractProposal(JSON.stringify(proposal, null, 2))).toThrow(
      ContractProposalValidationError,
    );
    expect(() => parseContractProposal(serializeContractProposal({
      ...proposal,
      evaluatedOn: "2026-02-30",
    }))).toThrow(ContractProposalValidationError);
    expect(() => applyContractProposal({
      acceptedOn: "2026-09-03",
      changeIds: [changeId, changeId],
      metadata: emptyContractProposalMetadata(proposal),
      proposal,
      source,
    })).toThrow(ContractProposalValidationError);
    expect(() => applyContractProposal({
      acceptedOn: "2026-09-03",
      changeIds: [changeId],
      metadata: {
        annotations: {
          "add:other/public/desktop/light": {
            createdOn: "2026-09-03",
            expiresOn: "2026-09-04",
            owner: "team",
            reason: "repair",
          },
        },
        proposalDigest: contractProposalDigest(proposal),
        schemaVersion: 1,
      },
      proposal,
      source,
    })).toThrow(ContractProposalValidationError);
    expect(() => applyContractProposal({
      acceptedOn: "2026-09-03",
      changeIds: [changeId],
      metadata: emptyContractProposalMetadata(proposal),
      proposal: { ...proposal, runDigest: fingerprintB },
      source,
    })).toThrow(ContractProposalValidationError);
  });

  it("binds annotations to eligible changes and revalidates them on the acceptance date", () => {
    const home = configuration("home");
    const source = createContractProposalSource({
      configuration: [home],
      contract: null,
      evaluatedOn: "2026-09-01",
      executions: [execution(home, ["ASSERTION_FAILED"])],
      runDigest,
    });
    const proposal = createContractProposal(source, "0.26.2");
    const changeId = proposal.changes[0]!.id;
    const metadata = withContractProposalAnnotation(
      proposal,
      emptyContractProposalMetadata(proposal),
      changeId,
      {
        createdOn: "2026-09-03",
        expiresOn: "2026-09-17",
        owner: "quality-team",
        reason: "UIW-2041 tracks repair",
      },
      "2026-09-03",
    );

    expect(() => applyContractProposal({
      acceptedOn: "2026-09-03",
      changeIds: [changeId],
      metadata,
      proposal,
      source,
    })).not.toThrow();
    expect(() => applyContractProposal({
      acceptedOn: "2026-09-18",
      changeIds: [changeId],
      metadata,
      proposal,
      source,
    })).toThrow(ContractProposalValidationError);

    const passingSource = createContractProposalSource({
      configuration: [home],
      contract: null,
      evaluatedOn: "2026-09-03",
      executions: [execution(home)],
      runDigest,
    });
    const passingProposal = createContractProposal(passingSource, "0.26.2");
    expect(() => withContractProposalAnnotation(
      passingProposal,
      emptyContractProposalMetadata(passingProposal),
      passingProposal.changes[0]!.id,
      {
        createdOn: "2026-09-03",
        expiresOn: "2026-09-04",
        owner: "quality-team",
        reason: "irrelevant metadata",
      },
      "2026-09-03",
    )).toThrow(ContractProposalValidationError);

    const ineligibleSource = createContractProposalSource({
      configuration: [home],
      contract: null,
      evaluatedOn: "2026-09-03",
      executions: [execution(home, ["NAVIGATION_FAILED"])],
      runDigest,
    });
    const ineligibleProposal = createContractProposal(ineligibleSource, "0.26.2");
    expect(() => withContractProposalAnnotation(
      ineligibleProposal,
      emptyContractProposalMetadata(ineligibleProposal),
      ineligibleProposal.changes[0]!.id,
      {
        createdOn: "2026-09-03",
        expiresOn: "2026-09-04",
        owner: "quality-team",
        reason: "Cannot be excepted",
      },
      "2026-09-03",
    )).toThrow(ContractProposalValidationError);

    expect(() => withContractProposalAnnotation(
      proposal,
      emptyContractProposalMetadata(proposal),
      changeId,
      {
        createdOn: "2026-09-03",
        expiresOn: "2026-09-04",
        owner: "quality-team\u202E",
        reason: "UIW-2041\u034F tracks repair",
      },
      "2026-09-03",
    )).toThrow(ContractProposalValidationError);

    expect(() => withContractProposalAnnotation(
      proposal,
      emptyContractProposalMetadata(proposal),
      changeId,
      {
        createdOn: "2026-09-03",
        expiresOn: "2026-09-04",
        owner: "quality-team",
        reason: "UIW-2041 tracks repair\u0007",
      },
      "2026-09-03",
    )).toThrow(ContractProposalValidationError);
  });
});

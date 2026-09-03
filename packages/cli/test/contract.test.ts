import { access, mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  contractConfigDigest,
  contractProposalDigest,
  contractProposalSourceDigest,
  createContractProposal,
  createContractProposalSource,
  emptyContractProposalMetadata,
  parseContract,
  parseContractProposalSource,
  serializeContractProposal,
  serializeContractProposalMetadata,
  serializeContractProposalSource,
  type ContractProposal,
  type ContractProposalSource,
  type UIWitnessContract,
} from "uiwitness-core";
import { afterEach, describe, expect, it } from "vitest";

import {
  acceptContractChanges,
  annotateContractChange,
  initContract,
  inspectContractChange,
} from "../src/contract.js";
import { guardConfiguration, loadGuardConfig } from "../src/guard-adapter.js";
import { GuardError } from "../src/guard-errors.js";

const projects: string[] = [];
const runDigest = `sha256:${"c".repeat(64)}` as const;

afterEach(async () => {
  const { rm } = await import("node:fs/promises");
  await Promise.all(projects.splice(0).map((project) => rm(project, { force: true, recursive: true })));
});

async function project(): Promise<{
  readonly contract: UIWitnessContract;
  readonly root: string;
  readonly source: ContractProposalSource;
}> {
  const { mkdtemp } = await import("node:fs/promises");
  const root = await realpath(await mkdtemp(join(tmpdir(), "uiwitness-contract-")));
  projects.push(root);
  await mkdir(join(root, "scenarios"));
  await writeFile(join(root, "scenarios", "home.mjs"), "export default {};\n");
  await writeFile(join(root, "uiwitness.config.mjs"), `export default {
  baseURL: "https://example.test",
  viewports: { desktop: { width: 1440, height: 900 } },
  themes: ["light"],
  routes: [{ id: "home", path: "/", states: [{ id: "public", setup: "./scenarios/home.mjs" }] }]
};\n`);
  const loaded = await loadGuardConfig(root, undefined);
  const configuration = await guardConfiguration(loaded.config, loaded.path, root);
  const contract: UIWitnessContract = {
    configDigest: contractConfigDigest(configuration),
    coordinates: configuration.map((coordinate) => ({
      ...coordinate,
      expected: { status: "passed" },
    })),
    schemaVersion: 1,
  };
  await writeFile(join(root, "uiwitness.contract.json"), `${JSON.stringify(contract, null, 2)}\n`);
  const source = createContractProposalSource({
    configuration,
    contract,
    evaluatedOn: "2026-09-03",
    executions: [{
      actual: { failureCodes: ["ASSERTION_FAILED"], status: "failed" },
      id: configuration[0]!.id,
    }],
    runDigest,
  });
  return { contract, root, source };
}

async function publish(
  root: string,
  source: ContractProposalSource,
): Promise<{ readonly candidate: string; readonly metadata: string; readonly proposal: ContractProposal }> {
  const proposal = createContractProposal(source, "0.26.2");
  const sourceDigest = contractProposalSourceDigest(source).slice(7);
  const proposalDigest = contractProposalDigest(proposal).slice(7);
  const generations = join(root, ".uiwitness", "contract-generations");
  const candidates = join(root, ".uiwitness", "contract-candidates");
  await mkdir(generations, { recursive: true });
  await mkdir(candidates, { recursive: true });
  const candidate = join(candidates, `${proposalDigest}.proposal.json`);
  const metadata = join(candidates, `${proposalDigest}.metadata.json`);
  await writeFile(join(generations, `${sourceDigest}.source.json`), serializeContractProposalSource(source));
  await writeFile(candidate, serializeContractProposal(proposal));
  await writeFile(metadata, serializeContractProposalMetadata(emptyContractProposalMetadata(proposal)));
  return { candidate, metadata, proposal };
}

describe("contract proposal CLI services", () => {
  it("inspects, annotates, and accepts one exact named change", async () => {
    const fixture = await project();
    const published = await publish(fixture.root, fixture.source);
    const changeId = "expectation:home/public/desktop/light";

    await expect(inspectContractChange({
      candidatePath: published.candidate,
      changeId,
      cwd: fixture.root,
    })).resolves.toMatchObject({ change: { id: changeId, operation: "expectation" } });

    await annotateContractChange({
      candidatePath: published.candidate,
      changeId,
      createdOn: "2026-09-03",
      cwd: fixture.root,
      expiresOn: "2026-09-17",
      owner: "checkout-team",
      reason: "UIW-2041 tracks the repair",
    });
    const accepted = await acceptContractChanges({
      candidatePath: published.candidate,
      changeIds: [changeId],
      cwd: fixture.root,
    });

    expect(accepted).toMatchObject({ accepted: [changeId], discarded: [] });
    expect(parseContract(await readFile(join(fixture.root, "uiwitness.contract.json"), "utf8"))
      .coordinates[0]!.expected).toMatchObject({
        failureCodes: ["ASSERTION_FAILED"],
        status: "failed",
      });
    await expect(access(published.candidate)).rejects.toMatchObject({ code: "ENOENT" });
    await expect(access(published.metadata)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("rejects proposal mutation and stale committed contracts", async () => {
    const fixture = await project();
    const published = await publish(fixture.root, fixture.source);
    const original = await readFile(published.candidate, "utf8");
    await writeFile(published.candidate, original.replace("0.26.2", "0.26.3"));
    await expect(inspectContractChange({
      candidatePath: published.candidate,
      changeId: published.proposal.changes[0]!.id,
      cwd: fixture.root,
    })).rejects.toBeInstanceOf(GuardError);

    const fresh = await project();
    const freshPublished = await publish(fresh.root, fresh.source);
    const changed = { ...fresh.contract, configDigest: `sha256:${"d".repeat(64)}` };
    await writeFile(join(fresh.root, "uiwitness.contract.json"), `${JSON.stringify(changed, null, 2)}\n`);
    await expect(acceptContractChanges({
      candidatePath: freshPublished.candidate,
      changeIds: [freshPublished.proposal.changes[0]!.id],
      cwd: fresh.root,
    })).rejects.toMatchObject({ code: "GUARD_CONTRACT_STALE" });

    const forged = await project();
    const forgedSource = parseContractProposalSource(
      serializeContractProposalSource({
        ...forged.source,
        configuration: forged.source.configuration.map((coordinate) => ({
          ...coordinate,
          routePath: "/forged",
        })),
      }),
    );
    const forgedPublished = await publish(forged.root, forgedSource);
    await expect(acceptContractChanges({
      candidatePath: forgedPublished.candidate,
      changeIds: [forgedPublished.proposal.changes[0]!.id],
      cwd: forged.root,
    })).rejects.toMatchObject({ code: "GUARD_CONTRACT_STALE" });
  });

  it("consumes a proposal after partial selection and records discarded IDs", async () => {
    const fixture = await project();
    const current = fixture.source.configuration[0]!;
    await writeFile(join(fixture.root, "updated.config.mjs"), `export default {
  baseURL: "https://example.test",
  viewports: { desktop: { width: 1280, height: 900 } },
  themes: ["light"],
  routes: [{ id: "home", path: "/", states: [{ id: "public", setup: "./scenarios/home.mjs" }] }]
};\n`);
    const reloaded = await loadGuardConfig(fixture.root, "updated.config.mjs");
    const actualConfiguration = await guardConfiguration(reloaded.config, reloaded.path, fixture.root);
    const source = createContractProposalSource({
      configuration: actualConfiguration,
      contract: fixture.contract,
      evaluatedOn: "2026-09-03",
      executions: [{
        actual: { failureCodes: ["ASSERTION_FAILED"], status: "failed" },
        id: current.id,
      }],
      runDigest,
    });
    const published = await publish(fixture.root, source);
    const configChange = published.proposal.changes.find(({ operation }) => operation === "config");
    expect(configChange).toBeDefined();
    const accepted = await acceptContractChanges({
      candidatePath: published.candidate,
      changeIds: [configChange!.id],
      configPath: "updated.config.mjs",
      cwd: fixture.root,
    });

    expect(accepted.discarded).toEqual(["expectation:home/public/desktop/light"]);
    const updated = parseContract(await readFile(join(fixture.root, "uiwitness.contract.json"), "utf8"));
    expect(updated.coordinates[0]).toMatchObject({
      configFingerprint: actualConfiguration[0]!.configFingerprint,
      expected: { status: "passed" },
      viewport: { width: 1280 },
    });
  });

  it("fails closed when a concurrent contract writer owns the lock", async () => {
    const fixture = await project();
    const published = await publish(fixture.root, fixture.source);
    await writeFile(join(fixture.root, ".uiwitness", "contract.lock"), "busy\n");

    await expect(acceptContractChanges({
      candidatePath: published.candidate,
      changeIds: [published.proposal.changes[0]!.id],
      cwd: fixture.root,
    })).rejects.toMatchObject({ code: "GUARD_CONTRACT_LOCKED" });
  });

  it("refuses contract initialization without clobbering an existing target", async () => {
    const fixture = await project();
    const original = await readFile(
      join(fixture.root, "uiwitness.contract.json"),
      "utf8",
    );

    await expect(initContract({ cwd: fixture.root })).rejects.toMatchObject({
      code: "GUARD_JSON_EXISTS",
    });
    await expect(readFile(
      join(fixture.root, "uiwitness.contract.json"),
      "utf8",
    )).resolves.toBe(original);
  });
});

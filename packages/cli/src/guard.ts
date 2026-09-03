import { readFile } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";

import {
  canonicalizeJson,
  compareContract,
  contractProposalDigest,
  contractProposalSourceDigest,
  createContractProposal,
  createContractProposalSource,
  emptyContractProposalMetadata,
  parseContract,
  parseContractProposalMetadata,
  serializeContractProposal,
  serializeContractProposalMetadata,
  serializeContractProposalSource,
  type ContractComparisonResult,
  type ContractConfigurationCoordinate,
  type JsonValue,
  type UIWitnessReport,
} from "uiwitness-core";

import {
  compareGuardInputs,
  contractSourceExecutions,
  guardConfiguration,
  guardMachineVerdict,
  guardRunDigest,
  loadGuardConfig,
  type GuardMachineVerdict,
} from "./guard-adapter.js";
import { GuardError } from "./guard-errors.js";
import {
  canonicalGuardWorkspace,
  containedRegularFile,
  preflightOutputPath,
  writeGuardJson,
} from "./guard-paths.js";
import { scanLoadedProject } from "./scan.js";

export { GuardError } from "./guard-errors.js";
export type { GuardErrorCode } from "./guard-errors.js";
export type { GuardMachineVerdict } from "./guard-adapter.js";

export const DEFAULT_CONTRACT_PATH = "uiwitness.contract.json" as const;
export const DEFAULT_GUARD_VERDICT_PATH =
  ".uiwitness/contract-verdict.json" as const;
export const DEFAULT_CONTRACT_CANDIDATE_DIRECTORY =
  ".uiwitness/contract-candidates" as const;
export const DEFAULT_CONTRACT_SOURCE_DIRECTORY =
  ".uiwitness/contract-generations" as const;

/** Inputs for one complete, fresh State Contract Guard run. */
export interface GuardOptions {
  /** Explicit config path beneath the guard workspace. */
  readonly configPath?: string | undefined;
  /** Explicit committed contract path beneath the guard workspace. */
  readonly contractPath?: string | undefined;
  /** Guard workspace. Unlike scan, guard never walks parent directories. */
  readonly cwd?: string | undefined;
  /** Optional no-clobber copy of the machine verdict beneath the workspace. */
  readonly jsonPath?: string | undefined;
  /** Called once before browser launch and reused for the comparison date. */
  readonly now?: (() => Date) | undefined;
}

/** Complete guard output plus the existing schema-v1 execution report. */
export interface GuardResult {
  readonly comparison: ContractComparisonResult;
  readonly configPath: string;
  readonly contractPath: string;
  readonly explicitVerdictPath?: string | undefined;
  readonly machineVerdict: GuardMachineVerdict;
  readonly metadataPath?: string | undefined;
  readonly proposalPath?: string | undefined;
  readonly report: UIWitnessReport;
  readonly verdictPath: typeof DEFAULT_GUARD_VERDICT_PATH;
}

function relativePath(root: string, path: string): string {
  const local = relative(root, path).split(sep).join("/");
  return local.startsWith("--") ? `./${local}` : local;
}

async function contractFile(
  root: string,
  contractPath: string | undefined,
): Promise<string> {
  const input = contractPath ?? DEFAULT_CONTRACT_PATH;
  try {
    return await containedRegularFile(
      root,
      input,
      "GUARD_CONTRACT_PATH_INVALID",
      "Guard contract path",
    );
  } catch (error: unknown) {
    if (
      contractPath === undefined &&
      error instanceof GuardError &&
      (error.cause as NodeJS.ErrnoException | undefined)?.code === "ENOENT"
    ) {
      throw new GuardError(
        "GUARD_CONTRACT_NOT_FOUND",
        `No UIWitness contract found at ${DEFAULT_CONTRACT_PATH}.`,
        resolve(root, DEFAULT_CONTRACT_PATH),
      );
    }
    throw error;
  }
}

function evaluationInstant(now: (() => Date) | undefined): Date {
  const value = (now ?? (() => new Date()))();
  if (!(value instanceof Date) || !Number.isFinite(value.valueOf())) {
    throw new RangeError("The guard clock must return a valid Date.");
  }
  return new Date(value.valueOf());
}

function prevalidateComparison(
  contract: ReturnType<typeof parseContract>,
  configuration: readonly ContractConfigurationCoordinate[],
  evaluatedAt: Date,
): void {
  compareContract({
    complete: false,
    configuration,
    contract,
    executions: [],
    now: () => new Date(evaluatedAt.valueOf()),
  });
}

function serializeMachineVerdict(verdict: GuardMachineVerdict): string {
  return `${canonicalizeJson(verdict as unknown as JsonValue)}\n`;
}

async function toolVersion(): Promise<string> {
  const manifest = JSON.parse(
    await readFile(new URL("../package.json", import.meta.url), "utf8"),
  ) as { readonly version?: unknown };
  if (typeof manifest.version !== "string" || manifest.version.length === 0) {
    throw new GuardError("GUARD_PROPOSAL_INVALID", "UIWitness package version is unavailable.");
  }
  return manifest.version;
}

async function writeImmutableArtifact(
  root: string,
  path: string,
  contents: string,
  label: string,
): Promise<void> {
  try {
    await writeGuardJson(root, path, contents, true);
  } catch (error: unknown) {
    if (!(error instanceof GuardError) || error.code !== "GUARD_JSON_EXISTS") {
      throw error;
    }
    const safePath = await containedRegularFile(
      root,
      path,
      "GUARD_PROPOSAL_INVALID",
      label,
    );
    if (await readFile(safePath, "utf8") !== contents) {
      throw new GuardError(
        "GUARD_PROPOSAL_INVALID",
        `${label} already exists with different contents.`,
        safePath,
      );
    }
  }
}

async function ensureProposalMetadata(
  root: string,
  path: string,
  contents: string,
  proposalDigest: ReturnType<typeof contractProposalDigest>,
): Promise<void> {
  try {
    await writeGuardJson(root, path, contents, true);
  } catch (error: unknown) {
    if (!(error instanceof GuardError) || error.code !== "GUARD_JSON_EXISTS") {
      throw error;
    }
    const safePath = await containedRegularFile(
      root,
      path,
      "GUARD_PROPOSAL_INVALID",
      "Contract proposal metadata",
    );
    let metadata;
    try {
      metadata = parseContractProposalMetadata(await readFile(safePath, "utf8"));
    } catch (cause: unknown) {
      throw new GuardError(
        "GUARD_PROPOSAL_INVALID",
        "Existing contract proposal metadata is invalid or targets another proposal.",
        safePath,
        { cause },
      );
    }
    if (metadata.proposalDigest !== proposalDigest) {
      throw new GuardError(
        "GUARD_PROPOSAL_INVALID",
        "Existing contract proposal metadata targets another proposal.",
        safePath,
        { cause: error },
      );
    }
  }
}

export async function publishContractProposal(input: {
  readonly configuration: readonly ContractConfigurationCoordinate[];
  readonly contract: ReturnType<typeof parseContract> | null;
  readonly evaluatedOn: string;
  readonly report: UIWitnessReport;
  readonly root: string;
  readonly runDigest: ReturnType<typeof guardRunDigest>;
}): Promise<{ readonly metadataPath: string; readonly proposalPath: string }> {
  const source = createContractProposalSource({
    configuration: input.configuration,
    contract: input.contract,
    evaluatedOn: input.evaluatedOn,
    executions: contractSourceExecutions(input.report),
    runDigest: input.runDigest,
  });
  const proposal = createContractProposal(source, await toolVersion());
  if (proposal.changes.length === 0) {
    throw new GuardError(
      "GUARD_PROPOSAL_INVALID",
      "A contract proposal cannot be published without named changes.",
    );
  }
  const sourceDigest = contractProposalSourceDigest(source).slice("sha256:".length);
  const proposalDigest = contractProposalDigest(proposal).slice("sha256:".length);
  const sourcePath = resolve(
    input.root,
    DEFAULT_CONTRACT_SOURCE_DIRECTORY,
    `${sourceDigest}.source.json`,
  );
  const proposalPath = resolve(
    input.root,
    DEFAULT_CONTRACT_CANDIDATE_DIRECTORY,
    `${proposalDigest}.proposal.json`,
  );
  const metadataPath = resolve(
    input.root,
    DEFAULT_CONTRACT_CANDIDATE_DIRECTORY,
    `${proposalDigest}.metadata.json`,
  );
  await writeImmutableArtifact(
    input.root,
    sourcePath,
    serializeContractProposalSource(source),
    "Contract proposal source",
  );
  await writeImmutableArtifact(
    input.root,
    proposalPath,
    serializeContractProposal(proposal),
    "Contract proposal",
  );
  await ensureProposalMetadata(
    input.root,
    metadataPath,
    serializeContractProposalMetadata(emptyContractProposalMetadata(proposal)),
    contractProposalDigest(proposal),
  );
  return {
    metadataPath: relativePath(input.root, metadataPath),
    proposalPath: relativePath(input.root, proposalPath),
  };
}

/**
 * Executes the complete configured matrix once, compares only that fresh
 * in-memory report, and publishes a deterministic machine-verdict sidecar.
 */
export async function guardProject(
  options: GuardOptions = {},
): Promise<GuardResult> {
  const root = await canonicalGuardWorkspace(options.cwd);
  const loaded = await loadGuardConfig(root, options.configPath);
  const configuration = await guardConfiguration(
    loaded.config,
    loaded.path,
    root,
  );
  const selectedContractPath = await contractFile(root, options.contractPath);
  const contract = parseContract(await readFile(selectedContractPath, "utf8"));
  const defaultVerdictPath = resolve(root, DEFAULT_GUARD_VERDICT_PATH);
  const explicitVerdictPath = options.jsonPath === undefined
    ? undefined
    : await preflightOutputPath(root, options.jsonPath, true);
  await preflightOutputPath(root, defaultVerdictPath, false);

  const evaluatedAt = evaluationInstant(options.now);
  prevalidateComparison(contract, configuration, evaluatedAt);

  const scan = await scanLoadedProject(loaded, { projectDirectory: root });
  const comparison = compareGuardInputs(
    contract,
    configuration,
    scan.report,
    evaluatedAt,
  );
  const runDigest = guardRunDigest(configuration, scan.report);
  const proposal = comparison.complete && comparison.verdict !== "passed"
    ? await publishContractProposal({
        configuration,
        contract,
        evaluatedOn: comparison.evaluatedOn,
        report: scan.report,
        root,
        runDigest,
      })
    : undefined;
  const machineVerdict = guardMachineVerdict(
    comparison,
    runDigest,
    options.configPath === undefined
      ? undefined
      : relativePath(root, loaded.path),
    proposal?.proposalPath,
  );
  const serialized = serializeMachineVerdict(machineVerdict);

  if (explicitVerdictPath === defaultVerdictPath) {
    await writeGuardJson(root, defaultVerdictPath, serialized, true);
  } else {
    await writeGuardJson(root, defaultVerdictPath, serialized, false);
    if (explicitVerdictPath !== undefined) {
      await writeGuardJson(root, explicitVerdictPath, serialized, true);
    }
  }

  return Object.freeze({
    comparison,
    configPath: loaded.path,
    contractPath: selectedContractPath,
    ...(explicitVerdictPath === undefined
      ? {}
      : { explicitVerdictPath: relativePath(root, explicitVerdictPath) }),
    machineVerdict,
    ...(proposal === undefined ? {} : proposal),
    report: scan.report,
    verdictPath: DEFAULT_GUARD_VERDICT_PATH,
  });
}

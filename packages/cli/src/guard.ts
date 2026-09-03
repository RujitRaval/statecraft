import { readFile } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";

import {
  canonicalizeJson,
  compareContract,
  parseContract,
  type ContractComparisonResult,
  type ContractConfigurationCoordinate,
  type JsonValue,
  type UIWitnessReport,
} from "uiwitness-core";

import {
  compareGuardInputs,
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
  const machineVerdict = guardMachineVerdict(
    comparison,
    guardRunDigest(configuration, scan.report),
    options.configPath === undefined
      ? undefined
      : relativePath(root, loaded.path),
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
    report: scan.report,
    verdictPath: DEFAULT_GUARD_VERDICT_PATH,
  });
}

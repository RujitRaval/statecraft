import { createHash, randomUUID } from "node:crypto";
import {
  constants as fsConstants,
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  open,
  readdir,
  realpath,
  rename,
  rm,
  stat,
} from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";

import {
  REPORT_SCHEMA_VERSION,
  calculateCoverage,
  parseExecutionResult,
  parseReport,
  screenshotArtifactPath,
  serializeReport,
  type ExecutionDiagnostics,
  type ExecutionFailure,
  type ExecutionResult,
  type MatrixCell,
  type UIWitnessReport,
} from "uiwitness-core";
import { REPORT_HTML_PATH, renderReportHtml } from "uiwitness-report";

import {
  diagnosticErrorMessage,
  runCapturedScenarioCells,
  ScenarioCaptureError,
  type CapturedScenarioCell,
  type RunCapturedScenarioCellsOptions,
  type ScenarioCaptureEvidence,
} from "./capture.js";
import type { CellExecutionOutcome } from "./lifecycle.js";
import { DocumentNavigationError } from "./readiness.js";

const evidenceDirectoryName = ".uiwitness";
const artifactsDirectoryName = "artifacts";
const reportDirectoryName = "report";
const reportFileName = "uiwitness.json";
const reportHtmlFileName = "index.html";
const reportProjectPath = ".uiwitness/report/uiwitness.json" as const;
const lockDirectoryName = ".runner-persistence-lock";
const lockOwnerFileName = "owner.json";
const publishingMarkerFileName = "publishing";
const recoveryMarkerFileName = "recovery";
const lockCandidatePrefix = ".runner-lock-candidate-";
const stagingDirectoryPrefix = ".runner-persistence-stage-";
const privateDirectoryMode = 0o700;
const privateFileMode = 0o600;

/** Filesystem and capture settings for one complete programmatic runner pass. */
export interface RunPersistedScenarioCellsOptions
  extends RunCapturedScenarioCellsOptions {
  /** Optional deterministic report timestamp. Defaults to the completion time. */
  readonly generatedAt?: Date | undefined;
  /** Existing project directory that owns the generated `.uiwitness/` tree. */
  readonly projectDirectory?: string | undefined;
}

/** The validated report and its stable project-relative JSON and HTML locations. */
export interface PersistedScenarioRun {
  readonly htmlReportPath: typeof REPORT_HTML_PATH;
  readonly report: UIWitnessReport;
  readonly reportPath: typeof reportProjectPath;
}

interface ExecutionArtifact {
  readonly result: ExecutionResult;
  readonly screenshot: Uint8Array | null;
}

interface PublicationOperations {
  readonly remove: typeof rm;
  readonly rename: typeof rename;
}

interface PublicationPaths {
  readonly existingArtifacts: string;
  readonly existingHtml: string;
  readonly existingReport: string;
  readonly previousArtifacts: string;
  readonly previousHtml: string;
  readonly previousReport: string;
}

interface PublicationState {
  readonly movedPreviousArtifacts: boolean;
  readonly movedPreviousHtml: boolean;
  readonly movedPreviousReport: boolean;
  readonly publishedArtifacts: boolean;
  readonly publishedHtml: boolean;
  readonly publishedReport: boolean;
}

interface PersistenceLock {
  readonly directory: string;
  preserve: boolean;
  readonly reportDirectory: string;
  readonly evidenceRoot: string;
  readonly token: string;
}

type PersistenceLockPhase = "capture" | "publishing" | "recovery";

interface PersistenceLockOwner {
  readonly pid: number;
  readonly schemaVersion: 1;
  readonly token: string;
}

interface PersistenceLockState {
  readonly owner: PersistenceLockOwner | null;
  readonly phase: PersistenceLockPhase;
}

const publicationOperations: PublicationOperations = Object.freeze({
  remove: rm,
  rename,
});

const emptyDiagnostics: ExecutionDiagnostics = Object.freeze({
  consoleErrors: Object.freeze([]),
  failedRequests: Object.freeze([]),
  navigationStatus: null,
  pageErrors: Object.freeze([]),
});

function requestedUrl(cell: MatrixCell, baseURL: string): string {
  return new URL(cell.route.path, baseURL).href;
}

function resultInput(
  cell: MatrixCell,
  baseURL: string,
  status: "failed" | "passed",
  evidence: ScenarioCaptureEvidence | CapturedScenarioCell | null,
  failures: readonly ExecutionFailure[],
): ExecutionResult {
  const screenshotPath =
    evidence?.screenshot === null || evidence === null
      ? null
      : screenshotArtifactPath(cell);
  return parseExecutionResult({
    diagnostics: evidence?.diagnostics ?? emptyDiagnostics,
    durationMs: evidence?.durationMs ?? 0,
    failures,
    routeId: cell.route.id,
    routePath: cell.route.path,
    scenarioSource: cell.state.setup,
    screenshotPath,
    stateId: cell.state.id,
    status,
    theme: cell.theme,
    url: evidence?.navigation?.url ?? requestedUrl(cell, baseURL),
    viewport: cell.viewport,
    viewportId: cell.viewportId,
  });
}

/** @internal Translates one settled capture into its core result and PNG bytes. */
export function executionArtifactForOutcome(
  outcome: CellExecutionOutcome<CapturedScenarioCell>,
  baseURL: string,
): ExecutionArtifact {
  if (outcome.status === "fulfilled") {
    return Object.freeze({
      result: resultInput(outcome.cell, baseURL, "passed", outcome.value, []),
      screenshot: outcome.value.screenshot,
    });
  }

  if (outcome.reason instanceof ScenarioCaptureError) {
    return Object.freeze({
      result: resultInput(
        outcome.cell,
        baseURL,
        "failed",
        outcome.reason.evidence,
        outcome.reason.failures,
      ),
      screenshot: outcome.reason.evidence.screenshot,
    });
  }

  if (outcome.reason instanceof DocumentNavigationError) {
    return Object.freeze({
      result: resultInput(outcome.cell, baseURL, "failed", null, [
        Object.freeze({
          code: "NAVIGATION_FAILED",
          message: diagnosticErrorMessage(outcome.reason),
        }),
      ]),
      screenshot: null,
    });
  }

  return Object.freeze({
    result: resultInput(outcome.cell, baseURL, "failed", null, [
      Object.freeze({
        code: "INTERNAL_ERROR",
        message: diagnosticErrorMessage(outcome.reason),
      }),
    ]),
    screenshot: null,
  });
}

function reportFor(
  cells: readonly MatrixCell[],
  artifacts: readonly ExecutionArtifact[],
  baseURL: string,
  generatedAt: string,
): UIWitnessReport {
  const executions = artifacts.map(({ result }) => result);
  const passed = executions.filter(({ status }) => status === "passed").length;
  return parseReport({
    executions,
    generatedAt,
    project: { baseURL },
    schemaVersion: REPORT_SCHEMA_VERSION,
    summary: {
      coverage: calculateCoverage(
        cells,
        executions.map((execution) => ({
          passed: execution.status === "passed",
          routeId: execution.routeId,
          stateId: execution.stateId,
          theme: execution.theme,
          viewportId: execution.viewportId,
        })),
      ),
      durationMs: executions.reduce(
        (total, execution) => total + execution.durationMs,
        0,
      ),
      executions: executions.length,
      failed: executions.length - passed,
      passed,
      routes: new Set(executions.map(({ routeId }) => routeId)).size,
      states: new Set(
        executions.map(({ routeId, stateId }) =>
          JSON.stringify([routeId, stateId]),
        ),
      ).size,
    },
  });
}

function reportTimestamp(value: Date | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  return new Date(value.getTime()).toISOString();
}

function validatePersistenceBoundary(
  cells: readonly MatrixCell[],
  baseURL: string,
  generatedAt: string | undefined,
): void {
  const artifacts = cells.map((cell) =>
    Object.freeze({
      result: parseExecutionResult({
      diagnostics: emptyDiagnostics,
      durationMs: 0,
      failures: [],
      routeId: cell.route.id,
      routePath: cell.route.path,
      scenarioSource: cell.state.setup,
      screenshotPath: screenshotArtifactPath(cell),
      stateId: cell.state.id,
      status: "passed",
      theme: cell.theme,
      url: requestedUrl(cell, baseURL),
      viewport: cell.viewport,
      viewportId: cell.viewportId,
      }),
      screenshot: null,
    }),
  );
  reportFor(
    cells,
    artifacts,
    baseURL,
    generatedAt ?? "1970-01-01T00:00:00.000Z",
  );
}

async function projectRoot(directory: string | undefined): Promise<string> {
  const candidate = resolve(directory ?? process.cwd());
  const metadata = await stat(candidate);
  if (!metadata.isDirectory()) {
    throw new TypeError("projectDirectory must refer to an existing directory.");
  }
  return realpath(candidate);
}

async function ensurePrivateDirectory(
  parent: string,
  segment: string,
): Promise<string> {
  const directory = join(parent, segment);
  await mkdir(directory, { mode: privateDirectoryMode }).catch(
    (error: NodeJS.ErrnoException) => {
      if (error.code !== "EEXIST") {
        throw error;
      }
    },
  );
  const metadata = await lstat(directory);
  if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
    throw new TypeError(
      `${relative(parent, directory) || segment} must be a real directory, not a symbolic link.`,
    );
  }
  if (process.platform !== "win32") {
    await chmod(directory, privateDirectoryMode);
  }
  return directory;
}

async function ensurePrivateTree(
  root: string,
  segments: readonly string[],
): Promise<string> {
  let directory = root;
  for (const segment of segments) {
    directory = await ensurePrivateDirectory(directory, segment);
  }
  return directory;
}

function safeRelativeSegments(projectPath: string): readonly string[] {
  if (
    isAbsolute(projectPath) ||
    !projectPath.startsWith(`${evidenceDirectoryName}/`)
  ) {
    throw new TypeError("Artifact paths must stay inside .uiwitness/.");
  }
  const segments = projectPath.split("/");
  if (segments.some((segment) => segment.length === 0 || segment === "..")) {
    throw new TypeError("Artifact paths must not contain empty or parent segments.");
  }
  return segments;
}

function assertContained(root: string, destination: string): void {
  const relativePath = relative(root, destination);
  if (
    relativePath.length === 0 ||
    relativePath === ".." ||
    relativePath.startsWith(`..${sep}`) ||
    isAbsolute(relativePath)
  ) {
    throw new TypeError("Persistence destinations must stay inside .uiwitness/.");
  }
}

async function writePrivateFile(
  destination: string,
  contents: string | Uint8Array,
): Promise<void> {
  const handle = await open(
    destination,
    fsConstants.O_CREAT |
      fsConstants.O_EXCL |
      fsConstants.O_WRONLY |
      fsConstants.O_NOFOLLOW,
    privateFileMode,
  );
  try {
    await handle.writeFile(contents);
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function existingType(
  path: string,
): Promise<"directory" | "file" | "missing" | "unsafe"> {
  try {
    const metadata = await lstat(path);
    if (metadata.isSymbolicLink()) {
      return "unsafe";
    }
    if (metadata.isDirectory()) {
      return "directory";
    }
    return metadata.isFile() ? "file" : "unsafe";
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return "missing";
    }
    throw error;
  }
}

/** @internal Restores the previous output while keeping its report hidden last. */
export async function recoverPublication(
  paths: PublicationPaths,
  state: PublicationState,
  operations: PublicationOperations = publicationOperations,
): Promise<readonly unknown[]> {
  const errors: unknown[] = [];
  const attempt = async (operation: () => Promise<void>): Promise<boolean> => {
    try {
      await operation();
      return true;
    } catch (error: unknown) {
      errors.push(error);
      return false;
    }
  };

  if (state.publishedHtml) {
    const htmlRemoved = await attempt(() =>
      operations.remove(paths.existingHtml, { force: true }),
    );
    if (!htmlRemoved) {
      return Object.freeze(errors);
    }
  }
  if (state.publishedReport) {
    const reportRemoved = await attempt(() =>
      operations.remove(paths.existingReport, { force: true }),
    );
    if (!reportRemoved) {
      return Object.freeze(errors);
    }
  }
  if (state.publishedArtifacts) {
    const artifactsRemoved = await attempt(() =>
      operations.remove(paths.existingArtifacts, {
        force: true,
        recursive: true,
      }),
    );
    if (!artifactsRemoved) {
      return Object.freeze(errors);
    }
  }
  if (state.movedPreviousArtifacts) {
    const artifactsRestored = await attempt(() =>
      operations.rename(paths.previousArtifacts, paths.existingArtifacts),
    );
    if (!artifactsRestored) {
      return Object.freeze(errors);
    }
  }
  if (state.movedPreviousReport) {
    const reportRestored = await attempt(() =>
      operations.rename(paths.previousReport, paths.existingReport),
    );
    if (!reportRestored) {
      return Object.freeze(errors);
    }
  }
  if (state.movedPreviousHtml) {
    await attempt(() =>
      operations.rename(paths.previousHtml, paths.existingHtml),
    );
  }
  return Object.freeze(errors);
}

function lockOwner(lock: PersistenceLock): PersistenceLockOwner {
  return {
    pid: process.pid,
    schemaVersion: 1,
    token: lock.token,
  };
}

function serializeLockOwner(owner: PersistenceLockOwner): string {
  return `${JSON.stringify(owner)}\n`;
}

function parseLockOwner(value: string): PersistenceLockOwner | null {
  try {
    const input: unknown = JSON.parse(value);
    if (typeof input !== "object" || input === null) {
      return null;
    }
    const record = input as Record<string, unknown>;
    if (
      record["schemaVersion"] !== 1 ||
      typeof record["pid"] !== "number" ||
      !Number.isSafeInteger(record["pid"]) ||
      record["pid"] <= 0 ||
      typeof record["token"] !== "string" ||
      record["token"].length === 0
    ) {
      return null;
    }
    return record as unknown as PersistenceLockOwner;
  } catch {
    return null;
  }
}

async function markerExists(path: string): Promise<boolean> {
  try {
    const metadata = await lstat(path);
    if (metadata.isSymbolicLink() || !metadata.isFile()) {
      throw new Error("Result-persistence lock markers must be regular files.");
    }
    return true;
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

async function readLockState(directory: string): Promise<PersistenceLockState> {
  const owner = await readLockOwner(directory);
  const recovery = await markerExists(join(directory, recoveryMarkerFileName));
  const publishing = await markerExists(
    join(directory, publishingMarkerFileName),
  );
  return {
    owner,
    phase: recovery ? "recovery" : publishing ? "publishing" : "capture",
  };
}

async function readLockOwner(directory: string): Promise<PersistenceLockOwner | null> {
  const path = join(directory, lockOwnerFileName);
  try {
    const handle = await open(
      path,
      fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW,
    );
    try {
      if ((await handle.stat()).size > 4_096) {
        return null;
      }
      return parseLockOwner(await handle.readFile("utf8"));
    } finally {
      await handle.close();
    }
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

function processIsAlive(pid: number): boolean {
  if (pid === process.pid) {
    return true;
  }
  try {
    process.kill(pid, 0);
    return true;
  } catch (error: unknown) {
    return (error as NodeJS.ErrnoException).code !== "ESRCH";
  }
}

/** @internal Derives the stable stale-owner claim used by recovery tests. */
export function takeoverClaimPath(
  directory: string,
  ownerToken: string,
): string {
  const digest = createHash("sha256").update(ownerToken, "utf8").digest("hex");
  return `${directory}.claimed-${digest}`;
}

async function updateLockPhase(
  lock: PersistenceLock,
  phase: PersistenceLockPhase,
): Promise<void> {
  if (phase === "capture") {
    throw new TypeError("Persistence locks cannot return to the capture phase.");
  }
  const marker = join(
    lock.directory,
    phase === "publishing"
      ? publishingMarkerFileName
      : recoveryMarkerFileName,
  );
  await writePrivateFile(marker, `${phase}\n`);
}

/** @internal Releases a lock only when its durable owner token still matches. */
export async function releasePersistenceLock(
  lock: PersistenceLock,
): Promise<void> {
  const { owner } = await readLockState(lock.directory);
  if (owner?.token !== lock.token) {
    throw new Error("Result-persistence lock ownership changed before cleanup.");
  }
  await rm(lock.directory, { force: true, recursive: true });
}

async function removeAbandonedStaging(evidenceRoot: string): Promise<void> {
  for (const entry of await readdir(evidenceRoot)) {
    if (!entry.startsWith(stagingDirectoryPrefix)) {
      continue;
    }
    const path = join(evidenceRoot, entry);
    const metadata = await lstat(path);
    if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
      throw new Error("Abandoned persistence staging must be a real directory.");
    }
    await rm(path, { force: true, recursive: true });
  }
}

/** @internal Acquires the owned run lock used by persistence integration tests. */
export async function acquirePersistenceLock(
  root: string,
): Promise<PersistenceLock> {
  const evidenceRoot = await ensurePrivateTree(root, [
    evidenceDirectoryName,
  ]);
  const reportDirectory = await ensurePrivateTree(evidenceRoot, [
    reportDirectoryName,
  ]);
  const directory = join(evidenceRoot, lockDirectoryName);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const candidate = await mkdtemp(join(evidenceRoot, lockCandidatePrefix));
    const token = randomUUID();
    const lock: PersistenceLock = {
      directory,
      preserve: false,
      reportDirectory,
      evidenceRoot,
      token,
    };
    try {
      await writePrivateFile(
        join(candidate, lockOwnerFileName),
        serializeLockOwner(lockOwner(lock)),
      );
      await rename(candidate, directory);
      return lock;
    } catch (error: unknown) {
      if (
        !["EEXIST", "ENOTEMPTY"].includes(
          (error as NodeJS.ErrnoException).code ?? "",
        )
      ) {
        await rm(candidate, { force: true, recursive: true });
        throw error;
      }

      let metadata;
      try {
        metadata = await lstat(directory);
      } catch (metadataError: unknown) {
        await rm(candidate, { force: true, recursive: true });
        if ((metadataError as NodeJS.ErrnoException).code === "ENOENT") {
          continue;
        }
        throw metadataError;
      }
      if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
        await rm(candidate, { force: true, recursive: true });
        throw new Error(
          ".uiwitness result-persistence lock must be a real directory.",
          { cause: error },
        );
      }
      const state = await readLockState(directory);
      if (state.owner !== null && processIsAlive(state.owner.pid)) {
        await rm(candidate, { force: true, recursive: true });
        throw new Error("Another result-persistence run is active.", {
          cause: error,
        });
      }
      if (state.owner !== null && state.phase === "capture") {
        const staleDirectory = takeoverClaimPath(directory, state.owner.token);
        try {
          await rename(directory, staleDirectory);
        } catch (staleError: unknown) {
          await rm(candidate, { force: true, recursive: true });
          if ((staleError as NodeJS.ErrnoException).code === "ENOENT") {
            continue;
          }
          if (
            ["EEXIST", "ENOTEMPTY"].includes(
              (staleError as NodeJS.ErrnoException).code ?? "",
            )
          ) {
            continue;
          }
          throw staleError;
        }
        try {
          await rename(candidate, directory);
        } catch (replacementError: unknown) {
          await rm(candidate, { force: true, recursive: true });
          if (
            ["EEXIST", "ENOTEMPTY"].includes(
              (replacementError as NodeJS.ErrnoException).code ?? "",
            )
          ) {
            continue;
          }
          throw replacementError;
        }
        try {
          await removeAbandonedStaging(evidenceRoot);
        } catch (cleanupError: unknown) {
          try {
            await releasePersistenceLock(lock);
          } catch (releaseError: unknown) {
            throw new AggregateError(
              [cleanupError],
              "Abandoned persistence cleanup and replacement-lock release both failed.",
              { cause: releaseError },
            );
          }
          throw cleanupError;
        }
        return lock;
      }
      await rm(candidate, { force: true, recursive: true });
      throw new Error(
        ".uiwitness contains recovery state from an interrupted result-persistence run.",
        { cause: error },
      );
    }
  }
  throw new Error("Could not acquire the result-persistence lock safely.");
}

/** @internal Publishes a validated report through an acquired lock. */
export async function persistReport(
  root: string,
  lock: PersistenceLock,
  report: UIWitnessReport,
  artifacts: readonly ExecutionArtifact[],
  operations: PublicationOperations = publicationOperations,
): Promise<void> {
  const { directory: lockDirectory, evidenceRoot, reportDirectory } = lock;

  let stagingRoot: string | undefined;
  let preserveRecoveryState = false;
  let persistenceError: unknown;
  try {
    const existingArtifacts = join(evidenceRoot, artifactsDirectoryName);
    const existingReport = join(reportDirectory, reportFileName);
    const existingHtml = join(reportDirectory, reportHtmlFileName);
    const artifactsType = await existingType(existingArtifacts);
    const reportType = await existingType(existingReport);
    const htmlType = await existingType(existingHtml);
    if (artifactsType !== "missing" && artifactsType !== "directory") {
      throw new TypeError(
        ".uiwitness/artifacts must be a real directory, not a symbolic link.",
      );
    }
    if (reportType !== "missing" && reportType !== "file") {
      throw new TypeError(
        ".uiwitness/report/uiwitness.json must be a regular file, not a symbolic link.",
      );
    }
    if (htmlType !== "missing" && htmlType !== "file") {
      throw new TypeError(
        ".uiwitness/report/index.html must be a regular file, not a symbolic link.",
      );
    }

    stagingRoot = await mkdtemp(join(evidenceRoot, stagingDirectoryPrefix));
    const stagedArtifacts = await ensurePrivateTree(stagingRoot, [
      artifactsDirectoryName,
    ]);
    for (const artifact of artifacts) {
      if (
        artifact.screenshot === null ||
        artifact.result.screenshotPath === null
      ) {
        continue;
      }
      const segments = safeRelativeSegments(artifact.result.screenshotPath);
      if (
        segments[0] !== evidenceDirectoryName ||
        segments[1] !== artifactsDirectoryName
      ) {
        throw new TypeError(
          "Screenshot paths must stay inside .uiwitness/artifacts/.",
        );
      }
      const fileSegments = segments.slice(2);
      const fileName = fileSegments.at(-1);
      if (fileName === undefined) {
        throw new TypeError("Screenshot artifact paths must include a filename.");
      }
      const directory = await ensurePrivateTree(
        stagedArtifacts,
        fileSegments.slice(0, -1),
      );
      const destination = join(directory, fileName);
      assertContained(stagingRoot, destination);
      await writePrivateFile(destination, artifact.screenshot);
    }

    const stagedReport = join(stagingRoot, reportFileName);
    assertContained(stagingRoot, stagedReport);
    await writePrivateFile(stagedReport, serializeReport(report));
    const stagedHtml = join(stagingRoot, reportHtmlFileName);
    assertContained(stagingRoot, stagedHtml);
    await writePrivateFile(stagedHtml, renderReportHtml(report));
    await updateLockPhase(lock, "publishing");

    const previousArtifacts = join(stagingRoot, "previous-artifacts");
    const previousReport = join(stagingRoot, "previous-uiwitness.json");
    const previousHtml = join(stagingRoot, "previous-index.html");
    let movedPreviousArtifacts = false;
    let movedPreviousReport = false;
    let movedPreviousHtml = false;
    let publishedArtifacts = false;
    let publishedReport = false;
    let publishedHtml = false;
    try {
      if (reportType === "file") {
        await operations.rename(existingReport, previousReport);
        movedPreviousReport = true;
      }
      if (htmlType === "file") {
        await operations.rename(existingHtml, previousHtml);
        movedPreviousHtml = true;
      }
      if (artifactsType === "directory") {
        await operations.rename(existingArtifacts, previousArtifacts);
        movedPreviousArtifacts = true;
      }
      await operations.rename(stagedArtifacts, existingArtifacts);
      publishedArtifacts = true;
      await operations.rename(stagedReport, existingReport);
      publishedReport = true;
      await operations.rename(stagedHtml, existingHtml);
      publishedHtml = true;
    } catch (error: unknown) {
      const recoveryErrors = [
        ...(await recoverPublication(
          {
            existingArtifacts,
            existingHtml,
            existingReport,
            previousArtifacts,
            previousHtml,
            previousReport,
          },
          {
            movedPreviousArtifacts,
            movedPreviousHtml,
            movedPreviousReport,
            publishedArtifacts,
            publishedHtml,
            publishedReport,
          },
          operations,
        )),
      ];
      if (recoveryErrors.length > 0) {
        preserveRecoveryState = true;
        lock.preserve = true;
        try {
          await updateLockPhase(lock, "recovery");
        } catch (phaseError: unknown) {
          recoveryErrors.push(phaseError);
        }
        throw new AggregateError(
          recoveryErrors,
          `Result publication failed and automatic recovery was incomplete. Recovery data remains at ${relative(root, stagingRoot)}; preserve ${relative(root, lockDirectory)} until the previous output is recovered.`,
          { cause: error },
        );
      }
      throw error;
    }
  } catch (error: unknown) {
    persistenceError = error;
  }

  const cleanupErrors: unknown[] = [];
  if (!preserveRecoveryState) {
    if (stagingRoot !== undefined) {
      try {
        await operations.remove(stagingRoot, { force: true, recursive: true });
      } catch (error: unknown) {
        cleanupErrors.push(error);
        lock.preserve = true;
        try {
          await updateLockPhase(lock, "recovery");
        } catch (phaseError: unknown) {
          cleanupErrors.push(phaseError);
        }
      }
    }
  }

  if (persistenceError !== undefined) {
    if (cleanupErrors.length > 0) {
      throw new AggregateError(
        [persistenceError, ...cleanupErrors],
        "Result persistence and cleanup both failed.",
      );
    }
    throw persistenceError;
  }
  if (cleanupErrors.length > 0) {
    throw new AggregateError(cleanupErrors, "Result persistence cleanup failed.");
  }
}

/**
 * Runs the complete browser lifecycle and transactionally publishes deterministic
 * PNGs, schema-v1 JSON, and the offline HTML report under one owned run lock.
 */
export async function runPersistedScenarioCells(
  cells: readonly MatrixCell[],
  options: RunPersistedScenarioCellsOptions,
): Promise<PersistedScenarioRun> {
  const root = await projectRoot(options.projectDirectory);
  const configuredTimestamp = reportTimestamp(options.generatedAt);
  validatePersistenceBoundary(cells, options.baseURL, configuredTimestamp);
  const lock = await acquirePersistenceLock(root);
  let run: PersistedScenarioRun | undefined;
  let runError: unknown;
  try {
    const outcomes = await runCapturedScenarioCells(cells, options);
    const artifacts = outcomes.map((outcome) =>
      executionArtifactForOutcome(outcome, options.baseURL),
    );
    const report = reportFor(
      cells,
      artifacts,
      options.baseURL,
      configuredTimestamp ?? new Date().toISOString(),
    );
    await persistReport(root, lock, report, artifacts);
    run = Object.freeze({
      htmlReportPath: REPORT_HTML_PATH,
      report,
      reportPath: reportProjectPath,
    });
  } catch (error: unknown) {
    runError = error;
  }

  let lockCleanupError: unknown;
  if (!lock.preserve) {
    try {
      await releasePersistenceLock(lock);
    } catch (error: unknown) {
      lockCleanupError = error;
    }
  }
  if (runError !== undefined && lockCleanupError !== undefined) {
    throw new AggregateError(
      [runError, lockCleanupError],
      "Result persistence and lock cleanup both failed.",
    );
  }
  if (runError !== undefined) {
    throw runError;
  }
  if (lockCleanupError !== undefined) {
    throw lockCleanupError;
  }
  if (run === undefined) {
    throw new Error("Result persistence completed without a report.");
  }
  return run;
}

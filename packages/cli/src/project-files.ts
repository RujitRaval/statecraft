import { constants } from "node:fs";
import {
  access,
  lstat,
  mkdir,
  open,
  realpath,
  stat,
} from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

import { DEFAULT_CONFIG_FILENAMES } from "./config.js";

export const GENERATED_CONFIG_FILENAME = "uiwitness.config.mts";

export type ProjectFileErrorCode =
  | "PROJECT_FILE_CONFLICT"
  | "PROJECT_FILE_ROOT_INVALID"
  | "PROJECT_FILE_WRITE_FAILED";

export class ProjectFileError extends Error {
  readonly code: ProjectFileErrorCode;
  readonly paths: readonly string[];

  constructor(
    code: ProjectFileErrorCode,
    message: string,
    paths: readonly string[],
    options: ErrorOptions = {},
  ) {
    super(message, options);
    this.name = "ProjectFileError";
    this.code = code;
    this.paths = Object.freeze([...paths]);
  }
}

export interface ConfigPublicationPlan {
  readonly configPath: string;
  readonly directories: readonly string[];
  readonly projectRoot: string;
  readonly scenarioPath: string;
}

export interface ConfigPublicationContents {
  readonly config: string;
  readonly scenario: string;
}

function isMissing(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

function isAlreadyExisting(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "EEXIST"
  );
}

async function canonicalProjectRoot(
  cwd: string | undefined,
): Promise<string> {
  const requestedRoot = resolve(cwd ?? process.cwd());
  try {
    const metadata = await stat(requestedRoot);
    if (!metadata.isDirectory()) {
      throw new TypeError("not a directory");
    }
    await access(
      requestedRoot,
      constants.R_OK | constants.W_OK | constants.X_OK,
    );
    return await realpath(requestedRoot);
  } catch (cause: unknown) {
    throw new ProjectFileError(
      "PROJECT_FILE_ROOT_INVALID",
      "The selected project root does not exist or cannot be used.",
      [requestedRoot],
      { cause },
    );
  }
}

async function inspectExistingPath(path: string): Promise<boolean> {
  try {
    await lstat(path);
    return true;
  } catch (error: unknown) {
    if (isMissing(error)) {
      return false;
    }
    throw new ProjectFileError(
      "PROJECT_FILE_WRITE_FAILED",
      "A generated project path could not be inspected.",
      [path],
      { cause: error },
    );
  }
}

async function publicationConflicts(
  plan: ConfigPublicationPlan,
): Promise<readonly string[]> {
  const conflicts: string[] = [];
  for (const filename of DEFAULT_CONFIG_FILENAMES) {
    const path = join(plan.projectRoot, filename);
    if (await inspectExistingPath(path)) {
      conflicts.push(path);
    }
  }

  let blockedBoundary = false;
  for (const path of plan.directories) {
    if (blockedBoundary) {
      continue;
    }
    try {
      const metadata = await lstat(path);
      if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
        conflicts.push(path);
        blockedBoundary = true;
      }
    } catch (error: unknown) {
      if (!isMissing(error)) {
        throw new ProjectFileError(
          "PROJECT_FILE_WRITE_FAILED",
          "A generated project directory could not be inspected.",
          [path],
          { cause: error },
        );
      }
    }
  }
  if (!blockedBoundary && (await inspectExistingPath(plan.scenarioPath))) {
    conflicts.push(plan.scenarioPath);
  }
  return Object.freeze(conflicts);
}

function scenarioDirectories(
  projectRoot: string,
  scenarioPath: string,
): readonly string[] {
  const directories: string[] = [];
  let current = dirname(scenarioPath);
  while (current !== projectRoot) {
    directories.push(current);
    const parent = dirname(current);
    if (parent === current) {
      throw new ProjectFileError(
        "PROJECT_FILE_WRITE_FAILED",
        "The generated scenario path escapes the selected project root.",
        [scenarioPath],
      );
    }
    current = parent;
  }
  return Object.freeze(directories.reverse());
}

export async function planConfigPublication(
  cwd: string | undefined,
  scenarioRelativePath: string,
): Promise<ConfigPublicationPlan> {
  if (isAbsolute(scenarioRelativePath)) {
    throw new ProjectFileError(
      "PROJECT_FILE_WRITE_FAILED",
      "The generated scenario path must be project-relative.",
      [scenarioRelativePath],
    );
  }
  const projectRoot = await canonicalProjectRoot(cwd);
  const scenarioPath = resolve(projectRoot, scenarioRelativePath);
  const localScenarioPath = relative(projectRoot, scenarioPath);
  if (
    localScenarioPath.length === 0 ||
    localScenarioPath === ".." ||
    localScenarioPath.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`)
  ) {
    throw new ProjectFileError(
      "PROJECT_FILE_WRITE_FAILED",
      "The generated scenario path escapes the selected project root.",
      [scenarioPath],
    );
  }
  const plan = Object.freeze({
    configPath: join(projectRoot, GENERATED_CONFIG_FILENAME),
    directories: scenarioDirectories(projectRoot, scenarioPath),
    projectRoot,
    scenarioPath,
  });
  const conflicts = await publicationConflicts(plan);
  if (conflicts.length > 0) {
    throw new ProjectFileError(
      "PROJECT_FILE_CONFLICT",
      "Generated UIWitness files conflict with existing paths.",
      conflicts,
    );
  }
  return plan;
}

async function createRealDirectory(path: string): Promise<void> {
  try {
    await mkdir(path, { mode: 0o755 });
  } catch (error: unknown) {
    if (!isAlreadyExisting(error)) {
      throw error;
    }
    const metadata = await lstat(path);
    if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
      throw new ProjectFileError(
        "PROJECT_FILE_CONFLICT",
        "A generated directory boundary changed during publication.",
        [path],
        { cause: error },
      );
    }
  }
}

async function createFileExclusive(
  path: string,
  contents: string,
): Promise<void> {
  const handle = await open(path, "wx", 0o644);
  try {
    await handle.writeFile(contents, "utf8");
  } finally {
    await handle.close();
  }
}

export async function publishConfigLast(
  plan: ConfigPublicationPlan,
  contents: ConfigPublicationContents,
): Promise<void> {
  const conflicts = await publicationConflicts(plan);
  if (conflicts.length > 0) {
    throw new ProjectFileError(
      "PROJECT_FILE_CONFLICT",
      "Generated UIWitness files changed after preflight.",
      conflicts,
    );
  }

  let currentTarget = plan.scenarioPath;
  try {
    for (const directory of plan.directories) {
      currentTarget = directory;
      await createRealDirectory(directory);
    }
    currentTarget = plan.scenarioPath;
    await createFileExclusive(plan.scenarioPath, contents.scenario);
    currentTarget = plan.configPath;
    await createFileExclusive(plan.configPath, contents.config);
  } catch (cause: unknown) {
    if (cause instanceof ProjectFileError) {
      throw cause;
    }
    if (isAlreadyExisting(cause)) {
      throw new ProjectFileError(
        "PROJECT_FILE_CONFLICT",
        "A generated target changed during publication; no existing file was overwritten.",
        [currentTarget],
        { cause },
      );
    }
    throw new ProjectFileError(
      "PROJECT_FILE_WRITE_FAILED",
      "UIWitness could not create every generated project file.",
      [plan.configPath, plan.scenarioPath],
      { cause },
    );
  }

  const lateConflicts: string[] = [];
  for (const filename of DEFAULT_CONFIG_FILENAMES) {
    if (filename === GENERATED_CONFIG_FILENAME) {
      continue;
    }
    const path = join(plan.projectRoot, filename);
    if (await inspectExistingPath(path)) {
      lateConflicts.push(path);
    }
  }
  if (lateConflicts.length > 0) {
    throw new ProjectFileError(
      "PROJECT_FILE_CONFLICT",
      "Configuration paths were created concurrently; generated files were preserved for inspection.",
      lateConflicts,
    );
  }
}

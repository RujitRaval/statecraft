import { constants } from "node:fs";
import {
  access,
  lstat,
  mkdir,
  open,
  realpath,
  stat,
} from "node:fs/promises";
import { join, resolve } from "node:path";

import { DEFAULT_CONFIG_FILENAMES } from "./config.js";

const CONFIG_FILENAME = "statecraft.config.ts";
const SCENARIO_DIRECTORY = join("statecraft", "scenarios", "home");
const SCENARIO_FILENAME = join(SCENARIO_DIRECTORY, "success.ts");

const CONFIG_TEMPLATE = `import { defineConfig } from "@statecraft/cli";

export default defineConfig({
  baseURL: "http://localhost:3000",
  viewports: {
    mobile: { width: 390, height: 844 },
    desktop: { width: 1440, height: 1000 },
  },
  themes: ["light", "dark"],
  routes: [
    {
      id: "home",
      path: "/",
      states: [
        {
          id: "success",
          setup: "./statecraft/scenarios/home/success.ts",
        },
      ],
    },
  ],
});
`;

const SCENARIO_TEMPLATE = `const scenario = {
  // Add beforeNavigate, afterNavigate, or assert hooks when this state needs them.
};

export default scenario;
`;

/** Stable categories for expected project-initialization failures. */
export type InitErrorCode =
  | "INIT_CONFLICT"
  | "INIT_ROOT_INVALID"
  | "INIT_WRITE_FAILED";

interface InitErrorOptions extends ErrorOptions {
  readonly paths?: readonly string[] | undefined;
}

/** A classifiable failure while creating starter Statecraft files. */
export class InitError extends Error {
  readonly code: InitErrorCode;
  readonly paths: readonly string[];

  constructor(
    code: InitErrorCode,
    message: string,
    options: InitErrorOptions = {},
  ) {
    super(message, options);
    this.name = "InitError";
    this.code = code;
    this.paths = Object.freeze([...(options.paths ?? [])]);
  }
}

/** Inputs for creating the starter Statecraft project files. */
export interface InitOptions {
  /** Project directory to initialize. Defaults to the current directory. */
  readonly cwd?: string | undefined;
}

/** Files created by a successful initialization. */
export interface InitResult {
  readonly configPath: string;
  readonly files: readonly string[];
  readonly projectRoot: string;
  readonly scenarioPath: string;
}

function isMissing(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

async function canonicalProjectRoot(cwd: string | undefined): Promise<string> {
  const projectRoot = resolve(cwd ?? process.cwd());

  try {
    const metadata = await stat(projectRoot);
    if (!metadata.isDirectory()) {
      throw new InitError(
        "INIT_ROOT_INVALID",
        `Initialization root is not a directory: ${projectRoot}`,
        { paths: [projectRoot] },
      );
    }
    await access(projectRoot, constants.R_OK | constants.W_OK | constants.X_OK);
    return await realpath(projectRoot);
  } catch (error: unknown) {
    if (error instanceof InitError) {
      throw error;
    }
    throw new InitError(
      "INIT_ROOT_INVALID",
      `Initialization root does not exist or cannot be used: ${projectRoot}`,
      { cause: error, paths: [projectRoot] },
    );
  }
}

async function existingPath(path: string): Promise<boolean> {
  try {
    await lstat(path);
    return true;
  } catch (error: unknown) {
    if (isMissing(error)) {
      return false;
    }
    throw error;
  }
}

async function preflightDirectories(paths: readonly string[]): Promise<void> {
  for (const path of paths) {
    try {
      const metadata = await lstat(path);
      if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
        throw new InitError(
          "INIT_CONFLICT",
          `Initialization path must be a real directory: ${path}`,
          { paths: [path] },
        );
      }
    } catch (error: unknown) {
      if (error instanceof InitError) {
        throw error;
      }
      if (!isMissing(error)) {
        throw new InitError(
          "INIT_WRITE_FAILED",
          `Initialization path cannot be inspected: ${path}`,
          { cause: error, paths: [path] },
        );
      }
    }
  }
}

async function createDirectory(
  path: string,
): Promise<void> {
  try {
    await mkdir(path, { mode: 0o755 });
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
      throw error;
    }
    const metadata = await lstat(path);
    if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
      throw error;
    }
  }
}

async function createFile(
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

/**
 * Creates a minimal config and scenario without replacing any existing target.
 * The config is published last so a failed run does not expose an entry config
 * that points at a scenario this invocation did not finish creating.
 */
export async function initProject(
  options: InitOptions = {},
): Promise<InitResult> {
  const projectRoot = await canonicalProjectRoot(options.cwd);
  const configPath = join(projectRoot, CONFIG_FILENAME);
  const scenarioPath = join(projectRoot, SCENARIO_FILENAME);
  const directories = [
    join(projectRoot, "statecraft"),
    join(projectRoot, "statecraft", "scenarios"),
    join(projectRoot, SCENARIO_DIRECTORY),
  ];

  await preflightDirectories(directories);

  const conflicts: string[] = [];
  const candidatePaths = [
    ...DEFAULT_CONFIG_FILENAMES.map((filename) => join(projectRoot, filename)),
    scenarioPath,
  ];
  for (const path of candidatePaths) {
    try {
      if (await existingPath(path)) {
        conflicts.push(path);
      }
    } catch (error: unknown) {
      throw new InitError(
        "INIT_WRITE_FAILED",
        `Initialization target cannot be inspected: ${path}`,
        { cause: error, paths: [path] },
      );
    }
  }
  if (conflicts.length > 0) {
    throw new InitError(
      "INIT_CONFLICT",
      `Statecraft initialization conflicts with existing paths:\n${conflicts
        .map((path) => `  ${path}`)
        .join("\n")}`,
      { paths: conflicts },
    );
  }

  try {
    for (const directory of directories) {
      await createDirectory(directory);
    }
    await createFile(scenarioPath, SCENARIO_TEMPLATE);
    await createFile(configPath, CONFIG_TEMPLATE);
  } catch (cause: unknown) {
    if ((cause as NodeJS.ErrnoException).code === "EEXIST") {
      throw new InitError(
        "INIT_CONFLICT",
        "Statecraft initialization stopped because a target changed during creation. No existing file was overwritten.",
        { cause, paths: [configPath, scenarioPath] },
      );
    }
    throw new InitError(
      "INIT_WRITE_FAILED",
      "Statecraft could not create every starter file. Existing paths were preserved; inspect the reported targets before retrying.",
      { cause, paths: [configPath, scenarioPath] },
    );
  }

  const lateConfigConflicts: string[] = [];
  for (const filename of DEFAULT_CONFIG_FILENAMES) {
    if (filename === CONFIG_FILENAME) {
      continue;
    }
    const path = join(projectRoot, filename);
    try {
      if (await existingPath(path)) {
        lateConfigConflicts.push(path);
      }
    } catch (error: unknown) {
      throw new InitError(
        "INIT_WRITE_FAILED",
        `Initialization target cannot be rechecked: ${path}`,
        { cause: error, paths: [path] },
      );
    }
  }
  if (lateConfigConflicts.length > 0) {
    throw new InitError(
      "INIT_CONFLICT",
      `Statecraft initialization detected configuration paths created concurrently:\n${lateConfigConflicts
        .map((path) => `  ${path}`)
        .join("\n")}\nThe generated starter files were preserved for inspection.`,
      { paths: lateConfigConflicts },
    );
  }

  return Object.freeze({
    configPath,
    files: Object.freeze([configPath, scenarioPath]),
    projectRoot,
    scenarioPath,
  });
}

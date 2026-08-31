import { join } from "node:path";

import {
  planConfigPublication,
  ProjectFileError,
  publishConfigLast,
} from "./project-files.js";

const SCENARIO_DIRECTORY = join("uiwitness", "scenarios", "home");
const SCENARIO_FILENAME = join(SCENARIO_DIRECTORY, "success.mts");

const CONFIG_TEMPLATE = `import { defineConfig } from "uiwitness";

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
          setup: "./uiwitness/scenarios/home/success.mts",
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

/** A classifiable failure while creating starter UIWitness files. */
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

/** Inputs for creating the starter UIWitness project files. */
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

function initializationError(error: unknown): InitError {
  if (!(error instanceof ProjectFileError)) {
    return new InitError(
      "INIT_WRITE_FAILED",
      "UIWitness could not create every starter file. Existing paths were preserved; inspect the reported targets before retrying.",
      { cause: error },
    );
  }
  if (error.code === "PROJECT_FILE_ROOT_INVALID") {
    return new InitError(
      "INIT_ROOT_INVALID",
      `Initialization root does not exist or cannot be used: ${error.paths[0] ?? "unknown"}`,
      { cause: error, paths: error.paths },
    );
  }
  if (error.code === "PROJECT_FILE_CONFLICT") {
    return new InitError(
      "INIT_CONFLICT",
      `UIWitness initialization conflicts with existing paths:\n${error.paths
        .map((path) => `  ${path}`)
        .join("\n")}\nNo existing file was overwritten.`,
      { cause: error, paths: error.paths },
    );
  }
  return new InitError(
    "INIT_WRITE_FAILED",
    "UIWitness could not create every starter file. Existing paths were preserved; inspect the reported targets before retrying.",
    { cause: error, paths: error.paths },
  );
}

/**
 * Creates a minimal config and scenario without replacing any existing target.
 * The config is published last so a failed run does not expose an entry config
 * that points at a scenario this invocation did not finish creating.
 */
export async function initProject(
  options: InitOptions = {},
): Promise<InitResult> {
  let plan;
  try {
    plan = await planConfigPublication(options.cwd, SCENARIO_FILENAME);
    await publishConfigLast(plan, {
      config: CONFIG_TEMPLATE,
      scenario: SCENARIO_TEMPLATE,
    });
  } catch (error: unknown) {
    throw initializationError(error);
  }

  return Object.freeze({
    configPath: plan.configPath,
    files: Object.freeze([plan.configPath, plan.scenarioPath]),
    projectRoot: plan.projectRoot,
    scenarioPath: plan.scenarioPath,
  });
}

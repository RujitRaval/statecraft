import { relative } from "node:path";

import { InitError, initProject } from "./init.js";

const HELP = `Statecraft

Usage:
  statecraft init
  statecraft --help

Commands:
  init  Create a starter config and scenario without overwriting files
`;

/** Stable process outcomes exposed by the current command foundation. */
export type CliExitCode = 0 | 1 | 2;

/** Injectable command environment for embedding and deterministic tests. */
export interface RunCliOptions {
  readonly args?: readonly string[] | undefined;
  readonly cwd?: string | undefined;
  readonly stderr?: ((message: string) => void) | undefined;
  readonly stdout?: ((message: string) => void) | undefined;
}

function displayPath(projectRoot: string, path: string): string {
  const localPath = relative(projectRoot, path);
  return localPath.length === 0 ? "." : localPath;
}

/** Parses and executes the currently supported Statecraft command. */
export async function runCli(options: RunCliOptions = {}): Promise<CliExitCode> {
  const args = [...(options.args ?? [])];
  const stdout =
    options.stdout ?? ((message: string) => process.stdout.write(message));
  const stderr =
    options.stderr ?? ((message: string) => process.stderr.write(message));

  if (
    args.length === 1 &&
    (args[0] === "--help" || args[0] === "-h" || args[0] === "help")
  ) {
    stdout(HELP);
    return 0;
  }

  if (args.length === 0) {
    stderr(`Missing command.\n\n${HELP}`);
    return 2;
  }

  if (args[0] !== "init") {
    stderr(`Unknown command: ${args[0]}\n\n${HELP}`);
    return 2;
  }

  if (args.length > 1) {
    stderr(
      `The init command does not accept arguments: ${args.slice(1).join(" ")}\n`,
    );
    return 2;
  }

  try {
    const result = await initProject({ cwd: options.cwd });
    const configPath = displayPath(result.projectRoot, result.configPath);
    const scenarioPath = displayPath(result.projectRoot, result.scenarioPath);
    stdout(`Statecraft initialized.\n\nCreated:\n  ${configPath}\n  ${scenarioPath}\n\nNext:\n  1. Update ${configPath} for your app.\n  2. Add scenario hooks in ${scenarioPath}.\n  3. Run statecraft scan.\n`);
    return 0;
  } catch (error: unknown) {
    if (error instanceof InitError) {
      stderr(`${error.message}\n`);
    } else {
      stderr("Statecraft initialization failed unexpectedly.\n");
    }
    return 2;
  }
}

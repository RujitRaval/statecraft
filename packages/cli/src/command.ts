import { relative } from "node:path";

import { ConfigValidationError } from "@statecraft/core";

import {
  ConfigDiscoveryError,
  ConfigLoadError,
} from "./config.js";
import { InitError, initProject } from "./init.js";
import { OpenReportError, openReport } from "./open.js";
import { ScanError, scanProject, type ScanResult } from "./scan.js";

const HELP = `Statecraft

Usage:
  statecraft init
  statecraft scan [--config <path>] [--route <id>] [--headed]
  statecraft open
  statecraft --help

Commands:
  init  Create a starter config and scenario without overwriting files
  scan  Execute configured UI states and persist screenshots plus JSON
  open  Open the latest generated offline HTML report
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

interface ParsedScanArguments {
  readonly configPath?: string | undefined;
  readonly headed: boolean;
  readonly routeId?: string | undefined;
}

function terminalText(value: string): string {
  let safe = "";
  for (const character of value) {
    const codePoint = character.codePointAt(0)!;
    if (
      codePoint <= 0x1f ||
      (codePoint >= 0x7f && codePoint <= 0x9f)
    ) {
      if (character === "\n") {
        safe += "\\n";
      } else if (character === "\r") {
        safe += "\\r";
      } else if (character === "\t") {
        safe += "\\t";
      } else {
        safe += `\\u{${codePoint.toString(16).padStart(4, "0")}}`;
      }
    } else {
      safe += character;
    }
  }
  return safe;
}

function parseScanArguments(
  args: readonly string[],
): ParsedScanArguments | string {
  let configPath: string | undefined;
  let headed = false;
  let routeId: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]!;
    if (argument === "--headed") {
      if (headed) {
        return "The --headed option can be specified only once.";
      }
      headed = true;
      continue;
    }
    if (argument === "--config" || argument === "--route") {
      const value = args[index + 1];
      if (value === undefined || value.startsWith("--")) {
        return `The ${argument} option requires a value.`;
      }
      if (argument === "--config") {
        if (configPath !== undefined) {
          return "The --config option can be specified only once.";
        }
        configPath = value;
      } else {
        if (routeId !== undefined) {
          return "The --route option can be specified only once.";
        }
        routeId = value;
      }
      index += 1;
      continue;
    }
    return `Unknown scan option: ${argument}`;
  }

  return Object.freeze({ configPath, headed, routeId });
}

function routeTitle(routeId: string): string {
  return routeId
    .split("-")
    .map((segment) => `${segment[0]!.toUpperCase()}${segment.slice(1)}`)
    .join(" ");
}

/** Formats one completed scan without reading filenames for metadata. */
export function formatScanSummary(result: ScanResult): string {
  const lines = ["Statecraft", ""];
  let previousRouteId: string | undefined;

  for (const execution of result.report.executions) {
    if (execution.routeId !== previousRouteId) {
      if (previousRouteId !== undefined) {
        lines.push("");
      }
      lines.push(routeTitle(execution.routeId));
      previousRouteId = execution.routeId;
    }
    const marker = execution.status === "passed" ? "✓" : "✗";
    lines.push(
      `  ${marker} ${execution.stateId} · ${execution.viewportId} · ${execution.theme}`,
    );
    for (const failure of execution.failures) {
      lines.push(`      ${failure.code}: ${terminalText(failure.message)}`);
    }
  }

  const { executions, failed } = result.report.summary;
  lines.push(
    "",
    `Coverage: ${result.report.summary.coverage.execution.percentage}%`,
    `Report: ${result.reportPath}`,
    failed === 0
      ? `All ${executions} execution${executions === 1 ? "" : "s"} passed.`
      : `${failed} of ${executions} execution${executions === 1 ? "" : "s"} failed.`,
  );
  return `${lines.join("\n")}\n`;
}

function expectedScanError(error: unknown): string | undefined {
  if (
    error instanceof ConfigDiscoveryError ||
    error instanceof ConfigLoadError ||
    error instanceof ScanError
  ) {
    return terminalText(error.message);
  }
  if (error instanceof ConfigValidationError) {
    return [
      error.message,
      ...error.issues.map(
        (issue) =>
          `  ${terminalText(issue.path)}: ${terminalText(issue.message)} (${issue.code})`,
      ),
    ].join("\n");
  }
  return undefined;
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

  if (args[0] !== "init" && args[0] !== "scan" && args[0] !== "open") {
    stderr(`Unknown command: ${terminalText(args[0]!)}\n\n${HELP}`);
    return 2;
  }

  if (args[0] === "scan") {
    const parsed = parseScanArguments(args.slice(1));
    if (typeof parsed === "string") {
      stderr(`${terminalText(parsed)}\n\n${HELP}`);
      return 2;
    }
    try {
      const result = await scanProject({ cwd: options.cwd, ...parsed });
      stdout(formatScanSummary(result));
      return result.report.summary.failed === 0 ? 0 : 1;
    } catch (error: unknown) {
      stderr(`${expectedScanError(error) ?? "Statecraft scan failed unexpectedly."}\n`);
      return 2;
    }
  }

  if (args[0] === "open") {
    if (args.length > 1) {
      stderr(
        `The open command does not accept arguments: ${args
          .slice(1)
          .map(terminalText)
          .join(" ")}\n`,
      );
      return 2;
    }
    try {
      const result = await openReport({ cwd: options.cwd });
      stdout(`Opened ${result.reportRelativePath}.\n`);
      return 0;
    } catch (error: unknown) {
      stderr(
        `${
          error instanceof OpenReportError
            ? terminalText(error.message)
            : "Statecraft could not open the latest report unexpectedly."
        }\n`,
      );
      return 2;
    }
  }

  if (args.length > 1) {
    stderr(
      `The init command does not accept arguments: ${args
        .slice(1)
        .map(terminalText)
        .join(" ")}\n`,
    );
    return 2;
  }

  try {
    const result = await initProject({ cwd: options.cwd });
    const configPath = displayPath(result.projectRoot, result.configPath);
    const scenarioPath = displayPath(result.projectRoot, result.scenarioPath);
    stdout(`Statecraft initialized.\n\nCreated:\n  ${configPath}\n  ${scenarioPath}\n\nNext:\n  1. Update ${configPath} for your app.\n  2. Add scenario hooks in ${scenarioPath}.\n  3. Commit both starter files to version control.\n`);
    return 0;
  } catch (error: unknown) {
    if (error instanceof InitError) {
      const targets =
        error.code === "INIT_WRITE_FAILED" && error.paths.length > 0
          ? `\n\nTargets:\n${error.paths
              .map((path) => `  ${terminalText(path)}`)
              .join("\n")}`
          : "";
      stderr(`${terminalText(error.message)}${targets}\n`);
    } else {
      stderr("Statecraft initialization failed unexpectedly.\n");
    }
    return 2;
  }
}

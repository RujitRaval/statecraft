import { relative } from "node:path";

import { ConfigValidationError } from "uiwitness-core";

import {
  CheckError,
  checkPublicSite,
  type CheckResult,
} from "./check.js";
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
  statecraft check <url> [--max-pages <1-20>] [--headed] [--write-config]
  statecraft scan [--config <path>] [--route <id>] [--headed]
  statecraft open
  statecraft --help

Commands:
  init  Create a starter config and scenario without overwriting files
  check Discover and inspect a public site without configuration
  scan  Execute configured UI states and persist screenshots, JSON, and HTML
  open  Open the latest generated offline HTML report

Safety:
  Check only websites you own or are authorized to test.
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

interface ParsedCheckArguments {
  readonly headed: boolean;
  readonly maxPages?: number | undefined;
  readonly url: string;
  readonly writeConfig: boolean;
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

function parseCheckArguments(
  args: readonly string[],
): ParsedCheckArguments | string {
  let headed = false;
  let maxPages: number | undefined;
  let url: string | undefined;
  let writeConfig = false;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]!;
    if (argument === "--headed") {
      if (headed) {
        return "The --headed option can be specified only once.";
      }
      headed = true;
      continue;
    }
    if (argument === "--max-pages") {
      if (maxPages !== undefined) {
        return "The --max-pages option can be specified only once.";
      }
      const value = args[index + 1];
      if (value === undefined || value.startsWith("--")) {
        return "The --max-pages option requires a value.";
      }
      if (!/^(?:[1-9]|1[0-9]|20)$/u.test(value)) {
        return "The --max-pages option must be an integer between 1 and 20.";
      }
      maxPages = Number(value);
      index += 1;
      continue;
    }
    if (argument === "--write-config") {
      if (writeConfig) {
        return "The --write-config option can be specified only once.";
      }
      writeConfig = true;
      continue;
    }
    if (argument.startsWith("--")) {
      return `Unknown check option: ${argument}`;
    }
    if (url !== undefined) {
      return "The check command accepts exactly one URL.";
    }
    url = argument;
  }

  if (url === undefined) {
    return "The check command requires a public website URL.";
  }
  try {
    const parsedURL = new URL(url);
    if (
      (parsedURL.protocol !== "http:" && parsedURL.protocol !== "https:") ||
      parsedURL.username.length > 0 ||
      parsedURL.password.length > 0
    ) {
      return "The check URL must be absolute HTTP(S) without credentials.";
    }
  } catch {
    return "The check URL must be a valid absolute HTTP(S) URL.";
  }

  return Object.freeze({ headed, maxPages, url, writeConfig });
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
    `Report: ${result.htmlReportPath}`,
    failed === 0
      ? `All ${executions} execution${executions === 1 ? "" : "s"} passed.`
      : `${failed} of ${executions} execution${executions === 1 ? "" : "s"} failed.`,
  );
  return `${lines.join("\n")}\n`;
}

function quantity(
  count: number,
  singular: string,
  plural = `${singular}s`,
): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** Formats one completed public-site Quick Check without exposing diagnostics. */
export function formatCheckSummary(result: CheckResult): string {
  const executions = result.report.executions;
  const routePaths = [
    ...new Set(executions.map((execution) => execution.routePath)),
  ];
  const issueCount = executions.reduce(
    (total, execution) => total + execution.failures.length,
    0,
  );
  const lines = [
    "Statecraft Quick Check",
    "",
    `Site: ${terminalText(result.discovery.baseURL)}`,
    `Pages: ${result.discovery.routes.length} discovered · ${routePaths.length} scanned · ${result.discovery.skippedPages} skipped`,
    `Discovery: ${quantity(result.discovery.attemptedPages, "page")} attempted · ${quantity(result.discovery.truncatedAnchorPages, "anchor page")} truncated`,
  ];

  for (const routePath of routePaths) {
    const routeExecutions = executions.filter(
      (execution) => execution.routePath === routePath,
    );
    const failed = routeExecutions.filter(
      (execution) => execution.status === "failed",
    );
    const routeIssues = failed.reduce(
      (total, execution) => total + execution.failures.length,
      0,
    );
    lines.push("", terminalText(routePath));
    if (failed.length === 0) {
      lines.push(`  ✓ All ${quantity(routeExecutions.length, "check")} passed.`);
      continue;
    }
    lines.push(
      `  ✗ ${failed.length} of ${quantity(routeExecutions.length, "check")} failed · ${quantity(routeIssues, "issue")}`,
    );
    for (const execution of failed) {
      for (const failure of execution.failures) {
        lines.push(
          `      ${terminalText(execution.viewportId)} · ${terminalText(execution.theme)} · ${terminalText(failure.code)}: ${terminalText(failure.message)}`,
        );
      }
    }
  }

  const { executions: executionCount, failed } = result.report.summary;
  lines.push(
    "",
    `Coverage: ${result.report.summary.coverage.execution.percentage}%`,
    `Issues: ${quantity(issueCount, "issue")} across ${quantity(executionCount, "check")}.`,
    `Report: ${result.htmlReportPath}`,
    failed === 0
      ? `All ${quantity(executionCount, "check")} passed.`
      : `${failed} of ${quantity(executionCount, "check")} failed.`,
  );
  if (result.setup === undefined) {
    lines.push(
      "",
      `Next: Open the report, then save this surface with \`npx statecraft check ${terminalText(result.discovery.baseURL)} --write-config\`.`,
    );
  } else {
    lines.push(
      "",
      "Saved the discovered public surface.",
      "Created:",
      `  ${displayPath(result.setup.projectRoot, result.setup.configPath)}`,
      `  ${displayPath(result.setup.projectRoot, result.setup.scenarioPath)}`,
      "",
      "Next: add real product states, then run `npx statecraft scan`.",
    );
  }
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

  if (
    args[0] !== "init" &&
    args[0] !== "check" &&
    args[0] !== "scan" &&
    args[0] !== "open"
  ) {
    stderr(`Unknown command: ${terminalText(args[0]!)}\n\n${HELP}`);
    return 2;
  }

  if (args[0] === "check") {
    const parsed = parseCheckArguments(args.slice(1));
    if (typeof parsed === "string") {
      stderr(`${terminalText(parsed)}\n\n${HELP}`);
      return 2;
    }
    try {
      const result = await checkPublicSite({ cwd: options.cwd, ...parsed });
      stdout(formatCheckSummary(result));
      return result.report.summary.failed === 0 ? 0 : 1;
    } catch (error: unknown) {
      if (error instanceof CheckError) {
        const targets =
          error.code === "CHECK_SETUP_WRITE_FAILED" && error.paths.length > 0
            ? `\n\nTargets:\n${error.paths
                .map((path) => `  ${terminalText(path)}`)
                .join("\n")}`
            : "";
        stderr(`${terminalText(error.message)}${targets}\n`);
      } else {
        stderr("Statecraft check failed unexpectedly.\n");
      }
      return 2;
    }
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

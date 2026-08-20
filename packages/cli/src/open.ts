import { constants } from "node:fs";
import { access, lstat, realpath, stat } from "node:fs/promises";
import { join, resolve } from "node:path";

import { launchReport } from "./launcher.js";

const REPORT_RELATIVE_PATH = ".statecraft/report/index.html" as const;
const REPORT_SEGMENTS = [".statecraft", "report", "index.html"] as const;

/** Stable categories for expected latest-report opening failures. */
export type OpenReportErrorCode =
  | "OPEN_REPORT_LAUNCH_FAILED"
  | "OPEN_REPORT_NOT_FOUND"
  | "OPEN_REPORT_PATH_INVALID"
  | "OPEN_REPORT_ROOT_INVALID";

/** A classifiable failure while locating or launching the latest HTML report. */
export class OpenReportError extends Error {
  readonly code: OpenReportErrorCode;
  readonly reportPath: string;

  constructor(
    code: OpenReportErrorCode,
    message: string,
    reportPath: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "OpenReportError";
    this.code = code;
    this.reportPath = reportPath;
  }
}

/** Inputs for opening the latest offline report. */
export interface OpenReportOptions {
  /** Project directory whose latest report should be opened. */
  readonly cwd?: string | undefined;
}

/** The report accepted by the operating-system launcher. */
export interface OpenReportResult {
  readonly projectRoot: string;
  readonly reportPath: string;
  readonly reportRelativePath: typeof REPORT_RELATIVE_PATH;
}

type ReportLauncher = (reportPath: string) => Promise<void>;

function isMissing(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

async function canonicalProjectRoot(cwd: string | undefined): Promise<string> {
  const requestedRoot = resolve(cwd ?? process.cwd());

  try {
    const metadata = await stat(requestedRoot);
    if (!metadata.isDirectory()) {
      throw new OpenReportError(
        "OPEN_REPORT_ROOT_INVALID",
        `Report root is not a directory: ${requestedRoot}`,
        join(requestedRoot, ...REPORT_SEGMENTS),
      );
    }
    await access(requestedRoot, constants.R_OK | constants.X_OK);
    return await realpath(requestedRoot);
  } catch (error: unknown) {
    if (error instanceof OpenReportError) {
      throw error;
    }
    throw new OpenReportError(
      "OPEN_REPORT_ROOT_INVALID",
      `Report root does not exist or cannot be used: ${requestedRoot}`,
      join(requestedRoot, ...REPORT_SEGMENTS),
      { cause: error },
    );
  }
}

async function validateReportPath(projectRoot: string): Promise<string> {
  const reportPath = join(projectRoot, ...REPORT_SEGMENTS);
  const boundaries = [
    { directory: true, path: join(projectRoot, REPORT_SEGMENTS[0]) },
    {
      directory: true,
      path: join(projectRoot, REPORT_SEGMENTS[0], REPORT_SEGMENTS[1]),
    },
    { directory: false, path: reportPath },
  ];

  for (const boundary of boundaries) {
    try {
      const metadata = await lstat(boundary.path);
      if (
        metadata.isSymbolicLink() ||
        (boundary.directory ? !metadata.isDirectory() : !metadata.isFile())
      ) {
        throw new OpenReportError(
          "OPEN_REPORT_PATH_INVALID",
          `Statecraft report path must contain only real ${
            boundary.directory ? "directories" : "files"
          }: ${boundary.path}`,
          reportPath,
        );
      }
    } catch (error: unknown) {
      if (error instanceof OpenReportError) {
        throw error;
      }
      if (isMissing(error)) {
        throw new OpenReportError(
          "OPEN_REPORT_NOT_FOUND",
          `No Statecraft HTML report found at ${REPORT_RELATIVE_PATH}. Generate an offline report before running statecraft open.`,
          reportPath,
        );
      }
      throw new OpenReportError(
        "OPEN_REPORT_PATH_INVALID",
        `Statecraft report path cannot be inspected: ${boundary.path}`,
        reportPath,
        { cause: error },
      );
    }
  }

  try {
    await access(reportPath, constants.R_OK);
  } catch (error: unknown) {
    throw new OpenReportError(
      "OPEN_REPORT_PATH_INVALID",
      `Statecraft report cannot be read: ${reportPath}`,
      reportPath,
      { cause: error },
    );
  }

  return reportPath;
}

/** Testable implementation shared by the public launcher boundary. */
export async function openReportWithLauncher(
  options: OpenReportOptions,
  launcher: ReportLauncher,
): Promise<OpenReportResult> {
  const projectRoot = await canonicalProjectRoot(options.cwd);
  const reportPath = await validateReportPath(projectRoot);

  try {
    await launcher(reportPath);
  } catch (error: unknown) {
    throw new OpenReportError(
      "OPEN_REPORT_LAUNCH_FAILED",
      `Statecraft could not open ${REPORT_RELATIVE_PATH} with the system browser.`,
      reportPath,
      { cause: error },
    );
  }

  return Object.freeze({
    projectRoot,
    reportPath,
    reportRelativePath: REPORT_RELATIVE_PATH,
  });
}

/** Locates and opens the latest generated offline report for one project. */
export async function openReport(
  options: OpenReportOptions = {},
): Promise<OpenReportResult> {
  return openReportWithLauncher(options, launchReport);
}

import { constants } from "node:fs";
import {
  access,
  chmod,
  lstat,
  open,
  realpath,
  rename,
  rm,
  stat,
} from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join, resolve } from "node:path";

import type { StatecraftReport } from "@statecraft/core";

import { renderReportHtml } from "./render.js";

/** Stable project-relative location of the generated offline report. */
export const REPORT_HTML_PATH = ".statecraft/report/index.html" as const;

const reportSegments = [".statecraft", "report"] as const;
const privateFileMode = 0o600;

/** Stable report-publication failures for callers and CLI orchestration. */
export type ReportWriteErrorCode =
  | "REPORT_OUTPUT_INVALID"
  | "REPORT_ROOT_INVALID"
  | "REPORT_WRITE_FAILED";

/** A classifiable failure while publishing offline report HTML. */
export class ReportWriteError extends Error {
  readonly code: ReportWriteErrorCode;
  readonly reportPath: string;

  constructor(
    code: ReportWriteErrorCode,
    message: string,
    reportPath: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "ReportWriteError";
    this.code = code;
    this.reportPath = reportPath;
  }
}

/** Filesystem target for generated report HTML. */
export interface WriteReportHtmlOptions {
  readonly projectDirectory?: string | undefined;
}

/** Published offline report location. */
export interface WrittenReportHtml {
  readonly reportPath: typeof REPORT_HTML_PATH;
}

function isMissing(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

async function canonicalRoot(directory: string | undefined): Promise<string> {
  const requested = resolve(directory ?? process.cwd());
  const reportPath = join(requested, ...reportSegments, "index.html");
  try {
    const metadata = await stat(requested);
    if (!metadata.isDirectory()) {
      throw new ReportWriteError(
        "REPORT_ROOT_INVALID",
        `Report project root is not a directory: ${requested}`,
        reportPath,
      );
    }
    await access(requested, constants.R_OK | constants.W_OK | constants.X_OK);
    return await realpath(requested);
  } catch (error: unknown) {
    if (error instanceof ReportWriteError) {
      throw error;
    }
    throw new ReportWriteError(
      "REPORT_ROOT_INVALID",
      `Report project root does not exist or cannot be used: ${requested}`,
      reportPath,
      { cause: error },
    );
  }
}

async function validateOutput(root: string): Promise<string> {
  const directories = [join(root, reportSegments[0]), join(root, ...reportSegments)];
  const reportPath = join(directories[1]!, "index.html");
  for (const directory of directories) {
    try {
      const metadata = await lstat(directory);
      if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
        throw new ReportWriteError(
          "REPORT_OUTPUT_INVALID",
          `Report output must use real directories: ${directory}`,
          reportPath,
        );
      }
    } catch (error: unknown) {
      if (error instanceof ReportWriteError) {
        throw error;
      }
      throw new ReportWriteError(
        "REPORT_OUTPUT_INVALID",
        `Report output directory is missing or cannot be inspected: ${directory}`,
        reportPath,
        { cause: error },
      );
    }
  }

  try {
    const metadata = await lstat(reportPath);
    if (metadata.isSymbolicLink() || !metadata.isFile()) {
      throw new ReportWriteError(
        "REPORT_OUTPUT_INVALID",
        `Report HTML target must be a real file when it exists: ${reportPath}`,
        reportPath,
      );
    }
  } catch (error: unknown) {
    if (error instanceof ReportWriteError) {
      throw error;
    }
    if (!isMissing(error)) {
      throw new ReportWriteError(
        "REPORT_OUTPUT_INVALID",
        `Report HTML target cannot be inspected: ${reportPath}`,
        reportPath,
        { cause: error },
      );
    }
  }
  return reportPath;
}

/** Atomically publishes private offline HTML beside the schema-v1 JSON report. */
export async function writeReportHtml(
  report: StatecraftReport,
  options: WriteReportHtmlOptions = {},
): Promise<WrittenReportHtml> {
  const html = renderReportHtml(report);
  const root = await canonicalRoot(options.projectDirectory);
  const reportPath = await validateOutput(root);
  const temporaryPath = join(
    root,
    ...reportSegments,
    `.index-${process.pid}-${randomUUID()}.tmp`,
  );
  let temporaryCreated = false;
  try {
    const handle = await open(temporaryPath, "wx", privateFileMode);
    temporaryCreated = true;
    try {
      await handle.writeFile(html, "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }
    await rename(temporaryPath, reportPath);
    temporaryCreated = false;
    if (process.platform !== "win32") {
      await chmod(reportPath, privateFileMode);
    }
  } catch (error: unknown) {
    if (temporaryCreated) {
      await rm(temporaryPath, { force: true }).catch(() => undefined);
    }
    throw new ReportWriteError(
      "REPORT_WRITE_FAILED",
      `Statecraft could not write ${REPORT_HTML_PATH}.`,
      reportPath,
      { cause: error },
    );
  }
  return Object.freeze({ reportPath: REPORT_HTML_PATH });
}

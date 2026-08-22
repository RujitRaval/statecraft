import { realpath, stat } from "node:fs/promises";
import { resolve } from "node:path";

import type { StatecraftReport } from "statecraft-ui-core";

/** Stable categories for expected public-site check failures. */
export type CheckErrorCode =
  | "CHECK_DISCOVERY_FAILED"
  | "CHECK_INVALID_INPUT"
  | "CHECK_ROOT_INVALID";

/** An expected public-site check failure safe to present to terminal users. */
export class CheckError extends Error {
  readonly code: CheckErrorCode;

  constructor(code: CheckErrorCode, message: string) {
    super(message);
    this.name = "CheckError";
    this.code = code;
  }
}

/** Inputs for one bounded public-site Quick Check. */
export interface CheckOptions {
  /** Project directory that receives `.statecraft/`. */
  readonly cwd?: string | undefined;
  /** Show the Playwright browser instead of using its headless default. */
  readonly headed?: boolean | undefined;
  /** Maximum public pages attempted during same-origin discovery. */
  readonly maxPages?: number | undefined;
  /** Absolute, credential-free HTTP(S) starting URL. */
  readonly url: string;
}

/** One accepted local pathname from public-site discovery. */
export interface CheckDiscoveredRoute {
  readonly path: string;
}

/** Bounded discovery metadata exposed without leaking browser-runner types. */
export interface CheckDiscovery {
  readonly attemptedPages: number;
  readonly baseURL: string;
  readonly routes: readonly CheckDiscoveredRoute[];
  readonly skippedPages: number;
  readonly truncatedAnchorPages: number;
}

/** Discovery metadata plus persisted evidence from one completed Quick Check. */
export interface CheckResult {
  readonly discovery: CheckDiscovery;
  readonly htmlReportPath: ".statecraft/report/index.html";
  readonly report: StatecraftReport;
  readonly reportPath: ".statecraft/report/statecraft.json";
}

function validateOptions(options: CheckOptions): void {
  let url: URL;
  try {
    if (typeof options.url !== "string") {
      throw new TypeError();
    }
    url = new URL(options.url);
  } catch {
    throw new CheckError(
      "CHECK_INVALID_INPUT",
      "url must be a valid absolute HTTP(S) URL.",
    );
  }
  if (
    (url.protocol !== "http:" && url.protocol !== "https:") ||
    url.username.length > 0 ||
    url.password.length > 0
  ) {
    throw new CheckError(
      "CHECK_INVALID_INPUT",
      "url must be an absolute HTTP(S) URL without credentials.",
    );
  }
  if (
    options.maxPages !== undefined &&
    (!Number.isSafeInteger(options.maxPages) ||
      options.maxPages < 1 ||
      options.maxPages > 20)
  ) {
    throw new CheckError(
      "CHECK_INVALID_INPUT",
      "maxPages must be an integer between 1 and 20.",
    );
  }
}

/**
 * Discovers a bounded public surface, checks its fixed responsive/theme matrix,
 * and persists screenshots plus schema-v1 JSON and offline HTML evidence.
 */
export async function checkPublicSite(
  options: CheckOptions,
): Promise<CheckResult> {
  validateOptions(options);
  let projectDirectory: string;
  try {
    projectDirectory = await realpath(resolve(options.cwd ?? process.cwd()));
    if (!(await stat(projectDirectory)).isDirectory()) {
      throw new TypeError();
    }
  } catch {
    throw new CheckError(
      "CHECK_ROOT_INVALID",
      "The Statecraft check project directory is invalid.",
    );
  }
  const runner = await import("statecraft-ui-runner-playwright");
  const launchOptions =
    options.headed === true ? Object.freeze({ headless: false }) : undefined;

  let discovery: CheckDiscovery;
  try {
    discovery = await runner.discoverPublicRoutes(options.url, {
      ...(launchOptions === undefined ? {} : { launchOptions }),
      ...(options.maxPages === undefined
        ? {}
        : { maxPages: options.maxPages }),
    });
  } catch (error: unknown) {
    if (error instanceof runner.PublicRouteDiscoveryError) {
      throw new CheckError("CHECK_DISCOVERY_FAILED", error.message);
    }
    throw error;
  }

  const run = await runner.runPublicSiteChecks(discovery, {
    ...(launchOptions === undefined ? {} : { launchOptions }),
    projectDirectory,
  });
  return Object.freeze({
    discovery,
    htmlReportPath: run.htmlReportPath,
    report: run.report,
    reportPath: run.reportPath,
  });
}

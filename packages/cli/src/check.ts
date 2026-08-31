import { realpath, stat } from "node:fs/promises";
import { resolve } from "node:path";

import type { UIWitnessReport } from "uiwitness-core";

import { ProjectFileError } from "./project-files.js";
import {
  planPublicSiteSetup,
  publishPublicSiteSetup,
  type PublicSiteSetupResult,
} from "./public-site-setup.js";

/** Stable categories for expected public-site check failures. */
export type CheckErrorCode =
  | "CHECK_DISCOVERY_FAILED"
  | "CHECK_INVALID_INPUT"
  | "CHECK_ROOT_INVALID"
  | "CHECK_SETUP_CONFLICT"
  | "CHECK_SETUP_WRITE_FAILED";

interface CheckErrorOptions {
  readonly paths?: readonly string[] | undefined;
}

/** An expected public-site check failure safe to present to terminal users. */
export class CheckError extends Error {
  readonly code: CheckErrorCode;
  readonly paths: readonly string[];

  constructor(
    code: CheckErrorCode,
    message: string,
    options: CheckErrorOptions = {},
  ) {
    super(message);
    this.name = "CheckError";
    this.code = code;
    this.paths = Object.freeze([...(options.paths ?? [])]);
  }
}

/** Inputs for one bounded public-site Quick Check. */
export interface CheckOptions {
  /** Project directory that receives `.uiwitness/`. */
  readonly cwd?: string | undefined;
  /** Show the Playwright browser instead of using its headless default. */
  readonly headed?: boolean | undefined;
  /** Maximum public pages attempted during same-origin discovery. */
  readonly maxPages?: number | undefined;
  /** Absolute, credential-free HTTP(S) starting URL. */
  readonly url: string;
  /** Save the discovered routes as an overwrite-safe permanent setup. */
  readonly writeConfig?: boolean | undefined;
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
  readonly htmlReportPath: ".uiwitness/report/index.html";
  readonly report: UIWitnessReport;
  readonly reportPath: ".uiwitness/report/uiwitness.json";
  readonly setup?: PublicSiteSetupResult | undefined;
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
  if (
    options.writeConfig !== undefined &&
    typeof options.writeConfig !== "boolean"
  ) {
    throw new CheckError(
      "CHECK_INVALID_INPUT",
      "writeConfig must be a boolean when provided.",
    );
  }
}

function setupError(error: ProjectFileError): CheckError {
  if (error.code === "PROJECT_FILE_ROOT_INVALID") {
    return new CheckError(
      "CHECK_ROOT_INVALID",
      "The Statecraft check project directory is invalid.",
      { paths: error.paths },
    );
  }
  if (error.code === "PROJECT_FILE_CONFLICT") {
    return new CheckError(
      "CHECK_SETUP_CONFLICT",
      `Statecraft setup conflicts with existing paths:\n${error.paths
        .map((path) => `  ${path}`)
        .join("\n")}\nNo existing file was overwritten.`,
      { paths: error.paths },
    );
  }
  return new CheckError(
    "CHECK_SETUP_WRITE_FAILED",
    "Statecraft could not save the discovered public surface. Existing paths were preserved; inspect the reported targets before retrying.",
    { paths: error.paths },
  );
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
  let setupPlan: Awaited<ReturnType<typeof planPublicSiteSetup>> | undefined;
  if (options.writeConfig === true) {
    try {
      setupPlan = await planPublicSiteSetup(projectDirectory);
    } catch (error: unknown) {
      if (error instanceof ProjectFileError) {
        throw setupError(error);
      }
      throw error;
    }
  }
  const runner = await import("uiwitness-runner-playwright");
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
  let setup: PublicSiteSetupResult | undefined;
  if (setupPlan !== undefined) {
    try {
      setup = await publishPublicSiteSetup(
        setupPlan,
        discovery,
        run.report,
      );
    } catch (error: unknown) {
      if (error instanceof ProjectFileError) {
        throw setupError(error);
      }
      throw error;
    }
  }
  return Object.freeze({
    discovery,
    htmlReportPath: run.htmlReportPath,
    report: run.report,
    reportPath: run.reportPath,
    ...(setup === undefined ? {} : { setup }),
  });
}

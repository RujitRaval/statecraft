import { dirname, resolve } from "node:path";

import {
  expandMatrix,
  type StatecraftReport,
} from "statecraft-ui-core";

import { loadConfig } from "./config.js";

/** Stable categories for expected scan-orchestration failures. */
export type ScanErrorCode = "SCAN_ROUTE_NOT_FOUND";

/** An expected scan setup failure that callers can classify without parsing text. */
export class ScanError extends Error {
  readonly code: ScanErrorCode;
  readonly routeId: string;

  constructor(code: ScanErrorCode, message: string, routeId: string) {
    super(message);
    this.name = "ScanError";
    this.code = code;
    this.routeId = routeId;
  }
}

/** Inputs for one complete CLI-owned scan. */
export interface ScanOptions {
  /** Explicit config file. Relative paths resolve from `cwd`. */
  readonly configPath?: string | undefined;
  /** Project directory that receives `.statecraft/`. */
  readonly cwd?: string | undefined;
  /** Show the Playwright browser instead of using its headless default. */
  readonly headed?: boolean | undefined;
  /** Execute only the exact configured route id. */
  readonly routeId?: string | undefined;
}

/** Validated persisted output from one completed scan. */
export interface ScanResult {
  readonly configPath: string;
  readonly htmlReportPath: ".statecraft/report/index.html";
  readonly report: StatecraftReport;
  readonly reportPath: ".statecraft/report/statecraft.json";
}

/**
 * Loads one trusted config, expands its selected matrix, executes every cell,
 * and persists deterministic screenshots plus schema-v1 JSON and offline HTML.
 */
export async function scanProject(
  options: ScanOptions = {},
): Promise<ScanResult> {
  const projectDirectory = resolve(options.cwd ?? process.cwd());
  const loaded = await loadConfig({
    configPath: options.configPath,
    cwd: projectDirectory,
  });
  if (
    options.routeId !== undefined &&
    !loaded.config.routes.some((route) => route.id === options.routeId)
  ) {
    throw new ScanError(
      "SCAN_ROUTE_NOT_FOUND",
      `Configured route not found: ${options.routeId}`,
      options.routeId,
    );
  }

  const cells = expandMatrix(loaded.config, {
    routeIds:
      options.routeId === undefined ? undefined : [options.routeId],
  });
  const { runPersistedScenarioCells } = await import(
    "statecraft-ui-runner-playwright"
  );
  const run = await runPersistedScenarioCells(cells, {
    baseURL: loaded.config.baseURL,
    ...(loaded.config.failOn === undefined
      ? {}
      : { failOn: loaded.config.failOn }),
    ...(options.headed === true
      ? { launchOptions: { headless: false } }
      : {}),
    projectDirectory,
    scenarioBaseDirectory: dirname(loaded.path),
  });
  return Object.freeze({
    configPath: loaded.path,
    htmlReportPath: run.htmlReportPath,
    report: run.report,
    reportPath: run.reportPath,
  });
}

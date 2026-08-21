import path from "node:path";
import { pathToFileURL } from "node:url";

import type { MatrixCell } from "statecraft-ui-core";
import type { BrowserContext, Page } from "playwright";

import {
  runExecutionCells,
  type CellExecutionContext,
  type CellExecutionOutcome,
  type RunExecutionCellsOptions,
} from "./lifecycle.js";

/** Playwright and matrix metadata supplied to every scenario hook. */
export interface ScenarioContext {
  readonly context: BrowserContext;
  readonly page: Page;
  readonly route: MatrixCell["route"];
  readonly state: MatrixCell["state"];
  readonly theme: string;
  readonly viewport: MatrixCell["viewport"];
}

/** One asynchronous scenario lifecycle hook. */
export type ScenarioHook = (context: ScenarioContext) => Promise<void>;

/** Trusted local scenario code loaded from a state's setup module. */
export interface StatecraftScenario {
  readonly afterNavigate?: ScenarioHook | undefined;
  readonly assert?: ScenarioHook | undefined;
  readonly beforeNavigate?: ScenarioHook | undefined;
}

/** Resolves a configured scenario path relative to a deterministic directory. */
export interface LoadScenarioOptions {
  readonly baseDirectory?: string | undefined;
}

/** Stable failure categories for scenario-module loading. */
export type ScenarioLoadErrorCode = "invalid-module" | "module-load-failed";

/** A scenario module could not be imported or did not expose valid hooks. */
export class ScenarioLoadError extends Error {
  readonly code: ScenarioLoadErrorCode;
  readonly scenarioPath: string;

  constructor(
    code: ScenarioLoadErrorCode,
    scenarioPath: string,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "ScenarioLoadError";
    this.code = code;
    this.scenarioPath = scenarioPath;
  }
}

/** Executes caller-owned work between beforeNavigate and afterNavigate. */
export type ScenarioCellExecutor<Value> = (
  context: ScenarioContext,
) => Promise<Value>;

/** Browser and scenario-resolution settings for a programmatic scenario run. */
export interface RunScenarioCellsOptions extends RunExecutionCellsOptions {
  readonly scenarioBaseDirectory?: string | undefined;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function scenarioHook(
  scenario: Readonly<Record<string, unknown>>,
  hookName: "afterNavigate" | "assert" | "beforeNavigate",
  scenarioPath: string,
): ScenarioHook | undefined {
  const hook = scenario[hookName];
  if (hook === undefined) {
    return undefined;
  }
  if (typeof hook !== "function") {
    throw new ScenarioLoadError(
      "invalid-module",
      scenarioPath,
      `Scenario hook "${hookName}" must be a function in ${scenarioPath}.`,
    );
  }
  return hook as ScenarioHook;
}

function normalizeScenario(
  moduleNamespace: unknown,
  scenarioPath: string,
): StatecraftScenario {
  const defaultExport = isRecord(moduleNamespace)
    ? moduleNamespace["default"]
    : undefined;
  if (!isRecord(defaultExport)) {
    throw new ScenarioLoadError(
      "invalid-module",
      scenarioPath,
      `Scenario module must default-export an object: ${scenarioPath}.`,
    );
  }

  return Object.freeze({
    afterNavigate: scenarioHook(
      defaultExport,
      "afterNavigate",
      scenarioPath,
    ),
    assert: scenarioHook(defaultExport, "assert", scenarioPath),
    beforeNavigate: scenarioHook(
      defaultExport,
      "beforeNavigate",
      scenarioPath,
    ),
  });
}

/** Imports and runtime-validates one trusted local scenario module. */
export async function loadScenario(
  scenarioPath: string,
  options: LoadScenarioOptions = {},
): Promise<StatecraftScenario> {
  const baseDirectory = options.baseDirectory ?? process.cwd();
  const absolutePath = path.resolve(baseDirectory, scenarioPath);
  const moduleUrl = pathToFileURL(absolutePath);
  let moduleNamespace: unknown;

  try {
    moduleNamespace = await import(moduleUrl.href);
  } catch (cause: unknown) {
    throw new ScenarioLoadError(
      "module-load-failed",
      scenarioPath,
      `Failed to load scenario module: ${scenarioPath}.`,
      { cause },
    );
  }

  return normalizeScenario(moduleNamespace, scenarioPath);
}

/** @internal Builds the public hook context from one isolated execution cell. */
export function scenarioContextForExecution(
  execution: CellExecutionContext,
): ScenarioContext {
  return Object.freeze({
    context: execution.context,
    page: execution.page,
    route: execution.cell.route,
    state: execution.cell.state,
    theme: execution.cell.theme,
    viewport: execution.cell.viewport,
  });
}

/** Runs the pre-navigation hook, caller-owned work, then post-navigation hook. */
export async function runScenarioLifecycle<Value>(
  scenario: StatecraftScenario,
  context: ScenarioContext,
  execute: ScenarioCellExecutor<Value>,
): Promise<Value> {
  await scenario.beforeNavigate?.(context);
  const value = await execute(context);
  await scenario.afterNavigate?.(context);
  return value;
}

/** Loads and runs every cell's configured scenario inside its isolated context. */
export async function runScenarioCells<Value>(
  cells: readonly MatrixCell[],
  execute: ScenarioCellExecutor<Value>,
  options: RunScenarioCellsOptions = {},
): Promise<readonly CellExecutionOutcome<Value>[]> {
  const lifecycleOptions: RunExecutionCellsOptions =
    options.launchOptions === undefined
      ? {}
      : { launchOptions: options.launchOptions };

  return runExecutionCells(
    cells,
    async (execution) => {
      const scenario = await loadScenario(execution.cell.state.setup, {
        baseDirectory: options.scenarioBaseDirectory,
      });
      const context = scenarioContextForExecution(execution);
      return runScenarioLifecycle(scenario, context, execute);
    },
    lifecycleOptions,
  );
}

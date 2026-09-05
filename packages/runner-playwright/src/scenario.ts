import path from "node:path";
import { pathToFileURL } from "node:url";

import type { MatrixCell } from "uiwitness-core";
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

/** Main-document metadata supplied to post-capture assertion hooks. */
export interface ScenarioNavigationMetadata {
  readonly requestedUrl: string;
  readonly status: number | null;
  readonly url: string;
}

/** Scenario context available after built-in navigation and readiness. */
export interface AssertionScenarioContext extends ScenarioContext {
  readonly navigation: ScenarioNavigationMetadata;
}

/** One asynchronous scenario lifecycle hook. */
export type ScenarioHook = (context: ScenarioContext) => Promise<void>;

/** One post-capture assertion hook with final navigation metadata. */
export type ScenarioAssertionHook = (
  context: AssertionScenarioContext,
) => Promise<void>;

/** Trusted local scenario code loaded from a state's setup module. */
export interface UIWitnessScenario {
  readonly afterNavigate?: ScenarioHook | undefined;
  readonly assert?: ScenarioAssertionHook | undefined;
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
): UIWitnessScenario {
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

/** @internal Runtime-validates a trusted in-memory scenario override. */
export function validateScenario(
  scenario: unknown,
  scenarioSource: string,
): UIWitnessScenario {
  return normalizeScenario({ default: scenario }, scenarioSource);
}

/** Imports and runtime-validates one trusted local scenario module. */
export async function loadScenario(
  scenarioPath: string,
  options: LoadScenarioOptions = {},
): Promise<UIWitnessScenario> {
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
  scenario: UIWitnessScenario,
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
    {
      ...(options.authentication === undefined
        ? {}
        : { authentication: options.authentication }),
      ...(options.launchOptions === undefined
        ? {}
        : { launchOptions: options.launchOptions }),
    };

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

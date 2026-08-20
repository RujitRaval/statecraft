import type { MatrixCell } from "@statecraft/core";
import type { Page } from "playwright";

import {
  runExecutionCells,
  type CellExecutionOutcome,
  type RunExecutionCellsOptions,
} from "./lifecycle.js";
import {
  loadScenario,
  scenarioContextForExecution,
  type RunScenarioCellsOptions,
  type ScenarioContext,
} from "./scenario.js";

const defaultNavigationTimeoutMs = 30_000;
const defaultReadinessTimeoutMs = 10_000;
const stabilityStyles = `
*, *::before, *::after {
  animation: none !important;
  caret-color: transparent !important;
  scroll-behavior: auto !important;
  transition: none !important;
}
`;

/** Optional deterministic readiness gates applied after afterNavigate. */
export interface DeterministicReadinessOptions {
  /** A selector that must become visible before post-readiness work begins. */
  readonly selector?: string | undefined;
  /** Positive timeout for load, selector, and font readiness gates. */
  readonly timeoutMs?: number | undefined;
}

/** Navigation and readiness settings for a programmatic runner invocation. */
export interface RunNavigatedScenarioCellsOptions
  extends RunScenarioCellsOptions {
  readonly baseURL: string;
  readonly navigationTimeoutMs?: number | undefined;
  readonly readiness?: DeterministicReadinessOptions | undefined;
}

/** Stable navigation metadata available after deterministic readiness. */
export interface NavigationMetadata {
  readonly requestedUrl: string;
  /** HTTP status returned by the built-in navigation to requestedUrl. */
  readonly status: number | null;
  /** Final same-origin page URL after hooks and deterministic readiness. */
  readonly url: string;
}

/** Scenario context exposed only after built-in navigation and readiness. */
export interface NavigatedScenarioContext extends ScenarioContext {
  readonly navigation: NavigationMetadata;
}

/** Executes caller-owned work after navigation, hooks, and readiness settle. */
export type NavigatedScenarioCellExecutor<Value> = (
  context: NavigatedScenarioContext,
) => Promise<Value>;

interface NavigationSettings {
  readonly baseURL: URL;
  readonly navigationTimeoutMs: number;
  readonly readinessSelector?: string | undefined;
  readonly readinessTimeoutMs: number;
}

function positiveTimeout(
  value: number | undefined,
  defaultValue: number,
  label: string,
): number {
  if (value === undefined) {
    return defaultValue;
  }
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new TypeError(`${label} must be a positive safe integer.`);
  }
  return value;
}

function navigationSettings(
  options: RunNavigatedScenarioCellsOptions,
): NavigationSettings {
  let baseURL: URL;
  try {
    baseURL = new URL(options.baseURL);
  } catch {
    throw new TypeError("baseURL must be a valid HTTP(S) URL.");
  }
  if (baseURL.protocol !== "http:" && baseURL.protocol !== "https:") {
    throw new TypeError("baseURL must be a valid HTTP(S) URL.");
  }

  const selector = options.readiness?.selector;
  if (selector !== undefined && selector.trim().length === 0) {
    throw new TypeError("readiness.selector cannot be empty.");
  }

  return Object.freeze({
    baseURL,
    navigationTimeoutMs: positiveTimeout(
      options.navigationTimeoutMs,
      defaultNavigationTimeoutMs,
      "navigationTimeoutMs",
    ),
    readinessSelector: selector,
    readinessTimeoutMs: positiveTimeout(
      options.readiness?.timeoutMs,
      defaultReadinessTimeoutMs,
      "readiness.timeoutMs",
    ),
  });
}

function routeUrl(baseURL: URL, routePath: string): URL {
  let url: URL;
  try {
    url = new URL(routePath, baseURL);
  } catch {
    throw new TypeError(`Route path must be a local URL path: ${routePath}.`);
  }
  if (!routePath.startsWith("/") || url.origin !== baseURL.origin) {
    throw new TypeError(`Route path must stay on the configured origin: ${routePath}.`);
  }
  return url;
}

function assertPageOrigin(page: Page, baseURL: URL): void {
  const pageOrigin = new URL(page.url()).origin;
  if (pageOrigin !== baseURL.origin) {
    throw new TypeError(
      `Navigation must stay on the configured origin (received ${pageOrigin}).`,
    );
  }
}

function colorScheme(theme: string): "dark" | "light" | "no-preference" {
  return theme === "dark" || theme === "light" ? theme : "no-preference";
}

async function applyTheme(page: Page, theme: string): Promise<void> {
  const scheme = colorScheme(theme);
  await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
  await page.addInitScript(
    ({ colorScheme: initialColorScheme, theme: initialTheme }) => {
      const apply = (): boolean => {
        const root = document.documentElement;
        if (root === null) {
          return false;
        }
        root.dataset["theme"] = initialTheme;
        if (
          initialColorScheme === "dark" ||
          initialColorScheme === "light"
        ) {
          root.style.colorScheme = initialColorScheme;
        }
        return true;
      };

      if (!apply()) {
        const observer = new MutationObserver(() => {
          if (apply()) {
            observer.disconnect();
          }
        });
        observer.observe(document, { childList: true, subtree: true });
      }
    },
    { colorScheme: scheme, theme },
  );
}

async function settleReadiness(
  page: Page,
  settings: NavigationSettings,
): Promise<void> {
  await page.addStyleTag({ content: stabilityStyles });
  await page.waitForLoadState("load", {
    timeout: settings.readinessTimeoutMs,
  });
  if (settings.readinessSelector !== undefined) {
    await page.locator(settings.readinessSelector).waitFor({
      state: "visible",
      timeout: settings.readinessTimeoutMs,
    });
  }
  await page.waitForFunction(
    () => !("fonts" in document) || document.fonts.status === "loaded",
    undefined,
    { timeout: settings.readinessTimeoutMs },
  );
}

function lifecycleOptions(
  options: RunNavigatedScenarioCellsOptions,
): RunExecutionCellsOptions {
  return options.launchOptions === undefined
    ? {}
    : { launchOptions: options.launchOptions };
}

/**
 * Runs configured cells through theme setup, hooks, navigation, and bounded
 * readiness before invoking caller-owned post-readiness work.
 */
export async function runNavigatedScenarioCells<Value>(
  cells: readonly MatrixCell[],
  execute: NavigatedScenarioCellExecutor<Value>,
  options: RunNavigatedScenarioCellsOptions,
): Promise<readonly CellExecutionOutcome<Value>[]> {
  const settings = navigationSettings(options);

  return runExecutionCells(
    cells,
    async (execution) => {
      const requestedUrl = routeUrl(settings.baseURL, execution.cell.route.path);
      const scenario = await loadScenario(execution.cell.state.setup, {
        baseDirectory: options.scenarioBaseDirectory,
      });
      const context = scenarioContextForExecution(execution);

      await applyTheme(context.page, context.theme);
      await scenario.beforeNavigate?.(context);
      const response = await context.page.goto(requestedUrl.href, {
        timeout: settings.navigationTimeoutMs,
        waitUntil: "domcontentloaded",
      });
      assertPageOrigin(context.page, settings.baseURL);
      await scenario.afterNavigate?.(context);
      assertPageOrigin(context.page, settings.baseURL);
      await settleReadiness(context.page, settings);
      assertPageOrigin(context.page, settings.baseURL);

      const navigation = Object.freeze({
        requestedUrl: requestedUrl.href,
        status: response?.status() ?? null,
        url: context.page.url(),
      });
      return execute(Object.freeze({ ...context, navigation }));
    },
    lifecycleOptions(options),
  );
}

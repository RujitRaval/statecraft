import { performance } from "node:perf_hooks";

import type {
  ExecutionDiagnostics,
  ExecutionFailure,
  ExecutionFailureCode,
  FailurePolicy,
  MatrixCell,
} from "statecraft-ui-core";
import type { ConsoleMessage, Page, Request } from "playwright";

import type { CellExecutionOutcome } from "./lifecycle.js";
import {
  runNavigatedScenarioLifecycleCells,
  type NavigationMetadata,
  type RunNavigatedScenarioCellsOptions,
} from "./navigation.js";
import {
  ScenarioLoadError,
  type AssertionScenarioContext,
  type StatecraftScenario,
} from "./scenario.js";

const maxDiagnosticLength = 2_000;
const maxDiagnosticsPerCategory = 100;
const maxDiagnosticUrlLength = 8_192;
const redactedValue = "[REDACTED]";
const authorizationPattern =
  /\bauthorization(\s*[:=]\s*)[^\n]*/giu;
const cookiePattern = /\b(cookie|set-cookie)(\s*[:=]\s*)[^\n]*/giu;
const sensitiveAssignmentPattern =
  /\b(password|passwd|secret|token|api[-_]?key)(\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;]+)/giu;
const bearerPattern = /\bBearer\s+[^\s,;]+/giu;
const embeddedHttpUrlPattern = /https?:\/\/[^\s<>"']+/giu;
const embeddedRouteUrlPattern = /(?<![:/])\/{1,2}[^\s<>"']*[?#][^\s<>"']*/giu;

/** Whether a scenario assertion ran and how it completed. */
export type AssertionStatus =
  | "failed"
  | "not-configured"
  | "not-run"
  | "passed";

/** Counts diagnostics omitted after the per-category memory cap is reached. */
export interface DroppedDiagnosticCounts {
  readonly consoleErrors: number;
  readonly failedRequests: number;
  readonly pageErrors: number;
}

/** Evidence available after a capture succeeds or fails. */
export interface ScenarioCaptureEvidence {
  readonly assertionStatus: AssertionStatus;
  readonly diagnostics: ExecutionDiagnostics;
  readonly droppedDiagnostics: DroppedDiagnosticCounts;
  readonly durationMs: number;
  readonly navigation: NavigationMetadata | null;
  readonly screenshot: Uint8Array | null;
}

/** Complete in-memory evidence for a successfully captured cell. */
export interface CapturedScenarioCell extends ScenarioCaptureEvidence {
  readonly assertionStatus: "not-configured" | "passed";
  readonly navigation: NavigationMetadata;
  readonly screenshot: Uint8Array;
}

/** Browser, readiness, and diagnostic-failure settings for capture. */
export interface RunCapturedScenarioCellsOptions
  extends RunNavigatedScenarioCellsOptions {
  readonly failOn?: FailurePolicy | undefined;
}

/** A failed cell with sanitized failures and any evidence captured beforehand. */
export class ScenarioCaptureError extends Error {
  readonly evidence: ScenarioCaptureEvidence;
  readonly failures: readonly ExecutionFailure[];

  constructor(
    failures: readonly ExecutionFailure[],
    evidence: ScenarioCaptureEvidence,
    options?: ErrorOptions,
  ) {
    const safeFailures = Object.freeze(
      failures.map(({ code, message }) =>
        Object.freeze({ code, message: sanitizeDiagnosticText(message) }),
      ),
    );
    const safeOptions =
      options?.cause === undefined
        ? undefined
        : { cause: new Error(diagnosticErrorMessage(options.cause)) };
    super(
      `Scenario capture failed: ${safeFailures.map(({ code }) => code).join(", ")}.`,
      safeOptions,
    );
    this.name = "ScenarioCaptureError";
    this.evidence = evidence;
    this.failures = safeFailures;
  }
}

interface ResolvedFailurePolicy {
  readonly consoleError: boolean;
  readonly failedRequest: boolean;
  readonly pageError: boolean;
}

function sanitizeHttpUrl(value: string): string | null {
  let url: URL;
  try {
    url = new URL(value.slice(0, maxDiagnosticUrlLength));
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return null;
  }

  url.username = "";
  url.password = "";
  url.hash = "";
  if (url.search.length > 0) {
    const redacted = new URLSearchParams();
    for (const [key] of url.searchParams) {
      redacted.append(key, redactedValue);
    }
    url.search = redacted.toString();
  }
  return url.href.length <= maxDiagnosticUrlLength
    ? url.href
    : new URL("/__statecraft_url_truncated__", url.origin).href;
}

function sanitizeEmbeddedUrl(value: string): string {
  const trailingPunctuationPattern = /[),.;}]+$/u;
  const punctuation = value.match(trailingPunctuationPattern)?.[0] ?? "";
  const candidate = punctuation.length === 0 ? value : value.slice(0, -punctuation.length);
  return `${sanitizeHttpUrl(candidate) ?? redactedValue}${punctuation}`;
}

function sanitizeEmbeddedRouteUrl(value: string): string {
  const trailingPunctuationPattern = /[),.;}]+$/u;
  const punctuation = value.match(trailingPunctuationPattern)?.[0] ?? "";
  const candidate = punctuation.length === 0 ? value : value.slice(0, -punctuation.length);
  const referenceOrigin = "https://statecraft.invalid";
  let url: URL;
  try {
    url = new URL(candidate, referenceOrigin);
  } catch {
    return redactedValue;
  }

  url.hash = "";
  if (url.search.length > 0) {
    const redacted = new URLSearchParams();
    for (const [key] of url.searchParams) {
      redacted.append(key, redactedValue);
    }
    url.search = redacted.toString();
  }
  const prefix = candidate.startsWith("//") ? `//${url.host}` : "";
  return `${prefix}${url.pathname}${url.search}${punctuation}`;
}

/** @internal Redacts common secret forms and caps untrusted diagnostic text. */
export function sanitizeDiagnosticText(value: string): string {
  const sanitized = value
    .slice(0, maxDiagnosticLength)
    .replace(
      cookiePattern,
      (_match, key: string, separator: string) =>
        `${key}${separator}${redactedValue}`,
    )
    .replace(
      authorizationPattern,
      (_match, separator: string) => `authorization${separator}${redactedValue}`,
    )
    .replace(bearerPattern, `Bearer ${redactedValue}`)
    .replace(
      sensitiveAssignmentPattern,
      (_match, key: string, separator: string) =>
        `${key}${separator}${redactedValue}`,
    )
    .replace(embeddedHttpUrlPattern, sanitizeEmbeddedUrl)
    .replace(embeddedRouteUrlPattern, sanitizeEmbeddedRouteUrl)
    .slice(0, maxDiagnosticLength)
    .trim();
  return sanitized.length === 0 ? "[empty diagnostic]" : sanitized;
}

/** @internal Converts unknown thrown values into bounded sanitized text. */
export function diagnosticErrorMessage(reason: unknown): string {
  try {
    return sanitizeDiagnosticText(
      String(reason instanceof Error ? reason.message : reason),
    );
  } catch {
    return "[unprintable thrown value]";
  }
}

function resolveFailurePolicy(
  policy: FailurePolicy | undefined,
): ResolvedFailurePolicy {
  const values = {
    consoleError: policy?.consoleError ?? false,
    failedRequest: policy?.failedRequest ?? false,
    pageError: policy?.pageError ?? true,
  };
  for (const [key, value] of Object.entries(values)) {
    if (typeof value !== "boolean") {
      throw new TypeError(`failOn.${key} must be a boolean.`);
    }
  }
  return Object.freeze(values);
}

function freezeDiagnostics(
  consoleErrors: readonly string[],
  failedRequests: ExecutionDiagnostics["failedRequests"],
  navigationStatus: number | null,
  pageErrors: readonly string[],
): ExecutionDiagnostics {
  return Object.freeze({
    consoleErrors: Object.freeze([...consoleErrors]),
    failedRequests: Object.freeze([...failedRequests]),
    navigationStatus,
    pageErrors: Object.freeze([...pageErrors]),
  });
}

class DiagnosticCollector {
  readonly consoleErrors: string[] = [];
  readonly failedRequests: {
    readonly errorText: string;
    readonly method: string;
    readonly url: string;
  }[] = [];
  readonly pageErrors: string[] = [];
  private readonly dropped = {
    consoleErrors: 0,
    failedRequests: 0,
    pageErrors: 0,
  };

  readonly onConsole = (message: ConsoleMessage): void => {
    if (message.type() === "error") {
      if (this.consoleErrors.length < maxDiagnosticsPerCategory) {
        this.consoleErrors.push(sanitizeDiagnosticText(message.text()));
      } else {
        this.dropped.consoleErrors += 1;
      }
    }
  };

  readonly onPageError = (error: Error): void => {
    if (this.pageErrors.length < maxDiagnosticsPerCategory) {
      this.pageErrors.push(diagnosticErrorMessage(error));
    } else {
      this.dropped.pageErrors += 1;
    }
  };

  readonly onRequestFailed = (request: Request): void => {
    const requestUrl = request.url();
    if (
      !requestUrl.startsWith("http://") &&
      !requestUrl.startsWith("https://")
    ) {
      return;
    }
    if (this.failedRequests.length >= maxDiagnosticsPerCategory) {
      this.dropped.failedRequests += 1;
      return;
    }
    const url = sanitizeHttpUrl(requestUrl);
    if (url === null) {
      return;
    }
    this.failedRequests.push(
      Object.freeze({
        errorText: sanitizeDiagnosticText(
          request.failure()?.errorText ??
            "Request failed without an error message.",
        ),
        method: sanitizeDiagnosticText(request.method()),
        url,
      }),
    );
  };

  constructor(private readonly page: Page) {}

  start(): void {
    this.page.on("console", this.onConsole);
    this.page.on("pageerror", this.onPageError);
    this.page.on("requestfailed", this.onRequestFailed);
  }

  stop(): void {
    this.page.off("console", this.onConsole);
    this.page.off("pageerror", this.onPageError);
    this.page.off("requestfailed", this.onRequestFailed);
  }

  snapshot(navigationStatus: number | null): ExecutionDiagnostics {
    return freezeDiagnostics(
      this.consoleErrors,
      this.failedRequests,
      navigationStatus,
      this.pageErrors,
    );
  }

  droppedSnapshot(): DroppedDiagnosticCounts {
    return Object.freeze({ ...this.dropped });
  }
}

function durationSince(startedAt: number): number {
  return Math.max(0, Math.round(performance.now() - startedAt));
}

function evidence(
  assertionStatus: AssertionStatus,
  collector: DiagnosticCollector,
  startedAt: number,
  navigation: NavigationMetadata | null,
  navigationStatus: number | null,
  screenshot: Uint8Array | null,
): ScenarioCaptureEvidence {
  return Object.freeze({
    assertionStatus,
    diagnostics: collector.snapshot(navigationStatus),
    droppedDiagnostics: collector.droppedSnapshot(),
    durationMs: durationSince(startedAt),
    navigation,
    screenshot,
  });
}

function failure(
  code: ExecutionFailureCode,
  message: string,
): ExecutionFailure {
  return Object.freeze({ code, message });
}

function policyFailures(
  diagnostics: ExecutionDiagnostics,
  droppedDiagnostics: DroppedDiagnosticCounts,
  policy: ResolvedFailurePolicy,
): readonly ExecutionFailure[] {
  const failures: ExecutionFailure[] = [];
  if (policy.consoleError && diagnostics.consoleErrors.length > 0) {
    failures.push(
      failure(
        "CONSOLE_ERROR",
        `${diagnostics.consoleErrors.length + droppedDiagnostics.consoleErrors} console error(s) matched the failure policy.`,
      ),
    );
  }
  if (policy.pageError && diagnostics.pageErrors.length > 0) {
    failures.push(
      failure(
        "PAGE_ERROR",
        `${diagnostics.pageErrors.length + droppedDiagnostics.pageErrors} page error(s) matched the failure policy.`,
      ),
    );
  }
  if (policy.failedRequest && diagnostics.failedRequests.length > 0) {
    failures.push(
      failure(
        "FAILED_REQUEST",
        `${diagnostics.failedRequests.length + droppedDiagnostics.failedRequests} failed request(s) matched the failure policy.`,
      ),
    );
  }
  return failures;
}

function captureError(
  failures: readonly ExecutionFailure[],
  currentEvidence: ScenarioCaptureEvidence,
  cause?: unknown,
): ScenarioCaptureError {
  return new ScenarioCaptureError(
    failures,
    currentEvidence,
    cause === undefined ? undefined : { cause },
  );
}

function lifecycleFailureCode(reason: unknown): ExecutionFailureCode {
  return reason instanceof ScenarioLoadError
    ? "INTERNAL_ERROR"
    : "NAVIGATION_FAILED";
}

/**
 * Runs complete in-memory Phase 3 capture for every matrix cell. PNG bytes and
 * sanitized diagnostics are returned without writing artifacts or reports.
 */
export async function runCapturedScenarioCells(
  cells: readonly MatrixCell[],
  options: RunCapturedScenarioCellsOptions,
): Promise<readonly CellExecutionOutcome<CapturedScenarioCell>[]> {
  const policy = resolveFailurePolicy(options.failOn);

  return runNavigatedScenarioLifecycleCells(
    cells,
    async (lifecycle) => {
      const { context } = lifecycle;
      const startedAt = lifecycle.startedAt;
      const collector = new DiagnosticCollector(context.page);
      let navigation: NavigationMetadata | null = null;
      let assertionContext: AssertionScenarioContext | undefined;
      let scenario: StatecraftScenario;
      let screenshot: Uint8Array | null = null;
      collector.start();

      const assertNavigationStable = (
        assertionStatus: AssertionStatus,
      ): void => {
        try {
          lifecycle.assertNavigationStable();
        } catch (cause: unknown) {
          screenshot = null;
          const currentEvidence = evidence(
            assertionStatus,
            collector,
            startedAt,
            navigation,
            navigation?.status ?? lifecycle.navigationStatusSnapshot(),
            screenshot,
          );
          throw captureError(
            [
              failure("NAVIGATION_FAILED", diagnosticErrorMessage(cause)),
              ...policyFailures(
                currentEvidence.diagnostics,
                currentEvidence.droppedDiagnostics,
                policy,
              ),
            ],
            currentEvidence,
            cause,
          );
        }
      };

      try {
        try {
          const navigated = await lifecycle.navigate();
          navigation = navigated.context.navigation;
          assertionContext = navigated.context;
          scenario = navigated.scenario;
        } catch (cause: unknown) {
          navigation = lifecycle.navigationSnapshot();
          const currentEvidence = evidence(
            "not-run",
            collector,
            startedAt,
            navigation,
            lifecycle.navigationStatusSnapshot(),
            screenshot,
          );
          throw captureError(
            [
              failure(
                lifecycleFailureCode(cause),
                diagnosticErrorMessage(cause),
              ),
              ...policyFailures(
                currentEvidence.diagnostics,
                currentEvidence.droppedDiagnostics,
                policy,
              ),
            ],
            currentEvidence,
            cause,
          );
        }

        try {
          const bytes = await context.page.screenshot({ type: "png" });
          screenshot = new Uint8Array(bytes);
        } catch (cause: unknown) {
          const currentEvidence = evidence(
            "not-run",
            collector,
            startedAt,
            navigation,
            navigation.status,
            screenshot,
          );
          const failures = [
            failure("SCREENSHOT_FAILED", diagnosticErrorMessage(cause)),
            ...policyFailures(
              currentEvidence.diagnostics,
              currentEvidence.droppedDiagnostics,
              policy,
            ),
          ];
          throw captureError(failures, currentEvidence, cause);
        }
        assertNavigationStable("not-run");

        let assertionStatus: AssertionStatus = "not-configured";
        let assertionFailure: ExecutionFailure | undefined;
        let assertionCause: unknown;
        if (scenario?.assert !== undefined) {
          try {
            if (assertionContext === undefined) {
              throw new Error("Assertion context is unavailable after navigation.");
            }
            await scenario.assert(assertionContext);
            assertionStatus = "passed";
          } catch (cause: unknown) {
            assertionStatus = "failed";
            assertionCause = cause;
            assertionFailure = failure(
              "ASSERTION_FAILED",
              diagnosticErrorMessage(cause),
            );
          }
        }
        assertNavigationStable(assertionStatus);

        const currentEvidence = evidence(
          assertionStatus,
          collector,
          startedAt,
          navigation,
          navigation.status,
          screenshot,
        );
        const failures = [
          ...(assertionFailure === undefined ? [] : [assertionFailure]),
          ...policyFailures(
            currentEvidence.diagnostics,
            currentEvidence.droppedDiagnostics,
            policy,
          ),
        ];
        if (failures.length > 0) {
          throw captureError(failures, currentEvidence, assertionCause);
        }

        if (
          (assertionStatus !== "not-configured" &&
            assertionStatus !== "passed") ||
          navigation === null ||
          screenshot === null
        ) {
          throw new Error("Successful capture evidence is incomplete.");
        }
        return Object.freeze({
          assertionStatus,
          diagnostics: currentEvidence.diagnostics,
          droppedDiagnostics: currentEvidence.droppedDiagnostics,
          durationMs: currentEvidence.durationMs,
          navigation,
          screenshot,
        });
      } finally {
        collector.stop();
      }
    },
    options,
  );
}

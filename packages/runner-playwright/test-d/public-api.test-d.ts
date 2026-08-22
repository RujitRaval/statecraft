import {
  discoverPublicRoutes,
  PUBLIC_SITE_OVERFLOW_TOLERANCE_PX,
  PublicRouteDiscoveryError,
  loadScenario,
  runCapturedScenarioCells,
  runExecutionCells,
  runNavigatedScenarioCells,
  runPersistedScenarioCells,
  runPublicSiteChecks,
  runScenarioCells,
  runScenarioLifecycle,
  publicSiteScenario,
  ScenarioLoadError,
  ScenarioCaptureError,
  type AssertionStatus,
  type AssertionScenarioContext,
  type CapturedScenarioCell,
  type DiscoveredPublicRoute,
  type DiscoverPublicRoutesOptions,
  type PublicRouteDiscovery,
  type CellExecutionContext,
  type CellExecutionOutcome,
  type CellExecutor,
  type DeterministicReadinessOptions,
  type DroppedDiagnosticCounts,
  type FulfilledCellExecution,
  type LoadScenarioOptions,
  type NavigatedScenarioCellExecutor,
  type NavigatedScenarioContext,
  type NavigationMetadata,
  type PersistedScenarioRun,
  type RejectedCellExecution,
  type RunExecutionCellsOptions,
  type RunCapturedScenarioCellsOptions,
  type RunNavigatedScenarioCellsOptions,
  type RunPersistedScenarioCellsOptions,
  type RunPublicSiteChecksOptions,
  type RunScenarioCellsOptions,
  type ScenarioCellExecutor,
  type ScenarioContext,
  type ScenarioCaptureEvidence,
  type ScenarioHook,
  type ScenarioAssertionHook,
  type ScenarioLoadErrorCode,
  type StatecraftScenario,
  type PublicRouteDiscoveryErrorCode,
} from "statecraft-ui-runner-playwright";

declare const execution: CellExecutionContext;

const executor: CellExecutor<string> = async (current) =>
  `${current.cell.route.id}:${current.page.url()}`;
const options: RunExecutionCellsOptions = {
  launchOptions: { headless: true },
};
const outcomes: Promise<readonly CellExecutionOutcome<string>[]> =
  runExecutionCells([execution.cell], executor, options);
const discoveryOptions: DiscoverPublicRoutesOptions = {
  launchOptions: { headless: true },
  maxPages: 5,
  navigationTimeoutMs: 30_000,
  readinessTimeoutMs: 10_000,
};
const discovery: Promise<PublicRouteDiscovery> = discoverPublicRoutes(
  "https://statecraft.invalid",
  discoveryOptions,
);
const discoveryRoute: Promise<DiscoveredPublicRoute | undefined> =
  discovery.then((result) => result.routes[0]);
const discoveryError = new PublicRouteDiscoveryError(
  "initial-response-missing",
  "No response.",
);
const discoveryErrorCode: PublicRouteDiscoveryErrorCode = discoveryError.code;
declare const scenarioContext: ScenarioContext;
declare const scenario: StatecraftScenario;
const hook: ScenarioHook = async (context) => {
  void context.page;
};
const scenarioExecutor: ScenarioCellExecutor<string> = async (context) =>
  context.state.id;
const scenarioOptions: RunScenarioCellsOptions = {
  launchOptions: { headless: true },
  scenarioBaseDirectory: process.cwd(),
};
const loadOptions: LoadScenarioOptions = {
  baseDirectory: process.cwd(),
};
const loadedScenario: Promise<StatecraftScenario> = loadScenario(
  execution.cell.state.setup,
  loadOptions,
);
const scenarioValue: Promise<string> = runScenarioLifecycle(
  scenario,
  scenarioContext,
  scenarioExecutor,
);
const scenarioOutcomes: Promise<readonly CellExecutionOutcome<string>[]> =
  runScenarioCells([execution.cell], scenarioExecutor, scenarioOptions);
const readiness: DeterministicReadinessOptions = {
  selector: "#ready",
  timeoutMs: 10_000,
};
const navigationOptions: RunNavigatedScenarioCellsOptions = {
  baseURL: "https://statecraft.invalid",
  navigationTimeoutMs: 30_000,
  readiness,
  scenario,
  scenarioBaseDirectory: process.cwd(),
};
const navigationExecutor: NavigatedScenarioCellExecutor<string> = async (
  context,
) => `${context.navigation.status}:${context.navigation.url}`;
const navigationOutcomes: Promise<readonly CellExecutionOutcome<string>[]> =
  runNavigatedScenarioCells(
    [execution.cell],
    navigationExecutor,
    navigationOptions,
  );
const captureOptions: RunCapturedScenarioCellsOptions = {
  baseURL: "https://statecraft.invalid",
  failOn: { consoleError: true, failedRequest: false, pageError: true },
  scenarioBaseDirectory: process.cwd(),
};
const captureOutcomes: Promise<
  readonly CellExecutionOutcome<CapturedScenarioCell>[]
> = runCapturedScenarioCells([execution.cell], captureOptions);
const persistenceOptions: RunPersistedScenarioCellsOptions = {
  ...captureOptions,
  generatedAt: new Date("2026-08-20T15:00:00.000Z"),
  projectDirectory: process.cwd(),
};
const persistedRun: Promise<PersistedScenarioRun> =
  runPersistedScenarioCells([execution.cell], persistenceOptions);
const publicSiteOptions: RunPublicSiteChecksOptions = {
  generatedAt: new Date("2026-08-22T18:00:00.000Z"),
  launchOptions: { headless: true },
  navigationTimeoutMs: 30_000,
  projectDirectory: process.cwd(),
  readinessTimeoutMs: 10_000,
};
const publicSiteRun: Promise<PersistedScenarioRun> = discovery.then((result) =>
  runPublicSiteChecks(result, publicSiteOptions),
);
declare const assertionContext: AssertionScenarioContext;
const assertionHook: ScenarioAssertionHook = async (context) => {
  const status: number | null = context.navigation.status;
  void status;
};
void publicSiteScenario.assert?.(assertionContext);
const overflowTolerance: 1 = PUBLIC_SITE_OVERFLOW_TOLERANCE_PX;
const htmlReportPath: Promise<".statecraft/report/index.html"> = persistedRun.then(
  (run) => run.htmlReportPath,
);
declare const capture: CapturedScenarioCell;
const evidence: ScenarioCaptureEvidence = capture;
const assertionStatus: AssertionStatus = capture.assertionStatus;
const captureError = new ScenarioCaptureError(
  [{ code: "ASSERTION_FAILED", message: "Expected main to be visible." }],
  evidence,
);
const captureFailures = captureError.failures;
const screenshotBytes: Uint8Array = capture.screenshot;
const droppedDiagnostics: DroppedDiagnosticCounts = capture.droppedDiagnostics;
declare const navigatedContext: NavigatedScenarioContext;
const navigation: NavigationMetadata = navigatedContext.navigation;
const loadError = new ScenarioLoadError(
  "invalid-module",
  "./scenario.ts",
  "invalid",
);
const loadErrorCode: ScenarioLoadErrorCode = loadError.code;

declare const fulfilled: FulfilledCellExecution<string>;
declare const rejected: RejectedCellExecution;
const fulfilledValue: string = fulfilled.value;
const rejectedReason: unknown = rejected.reason;

function inspectOutcome(outcome: CellExecutionOutcome<string>): void {
  if (outcome.status === "fulfilled") {
    const value: string = outcome.value;
    // @ts-expect-error Fulfilled outcomes do not carry rejection reasons.
    void outcome.reason;
    void value;
  } else {
    const reason: unknown = outcome.reason;
    // @ts-expect-error Rejected outcomes do not carry fulfilled values.
    void outcome.value;
    void reason;
  }

  // @ts-expect-error Outcome discriminants are immutable.
  outcome.status = "rejected";
}

const invalid: CellExecutionOutcome<string> = {
  cell: execution.cell,
  // @ts-expect-error Only fulfilled and rejected statuses are valid.
  status: "pending",
};

void outcomes.then((result) => {
  // @ts-expect-error The returned outcome collection is immutable.
  result.push(fulfilled);
});

void outcomes;
void discovery;
void discoveryRoute;
void discoveryError;
void discoveryErrorCode;
void assertionStatus;
void captureFailures;
void captureOutcomes;
void loadedScenario;
void persistedRun;
void publicSiteRun;
void navigation;
void navigationOutcomes;
void scenarioOutcomes;
void scenarioValue;
void hook;
void assertionHook;
void loadErrorCode;
void htmlReportPath;
void fulfilledValue;
void droppedDiagnostics;
void rejectedReason;
void screenshotBytes;
void overflowTolerance;
void inspectOutcome;
void invalid;

import {
  loadScenario,
  runExecutionCells,
  runScenarioCells,
  runScenarioLifecycle,
  ScenarioLoadError,
  type CellExecutionContext,
  type CellExecutionOutcome,
  type CellExecutor,
  type FulfilledCellExecution,
  type RejectedCellExecution,
  type RunExecutionCellsOptions,
  type RunScenarioCellsOptions,
  type ScenarioCellExecutor,
  type ScenarioContext,
  type ScenarioHook,
  type ScenarioLoadErrorCode,
  type StatecraftScenario,
} from "@statecraft/runner-playwright";

declare const execution: CellExecutionContext;

const executor: CellExecutor<string> = async (current) =>
  `${current.cell.route.id}:${current.page.url()}`;
const options: RunExecutionCellsOptions = {
  launchOptions: { headless: true },
};
const outcomes: Promise<readonly CellExecutionOutcome<string>[]> =
  runExecutionCells([execution.cell], executor, options);
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
const loadedScenario: Promise<StatecraftScenario> = loadScenario(
  execution.cell.state.setup,
  { baseDirectory: process.cwd() },
);
const scenarioValue: Promise<string> = runScenarioLifecycle(
  scenario,
  scenarioContext,
  scenarioExecutor,
);
const scenarioOutcomes: Promise<readonly CellExecutionOutcome<string>[]> =
  runScenarioCells([execution.cell], scenarioExecutor, scenarioOptions);
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
void loadedScenario;
void scenarioOutcomes;
void scenarioValue;
void hook;
void loadErrorCode;
void fulfilledValue;
void rejectedReason;
void inspectOutcome;
void invalid;

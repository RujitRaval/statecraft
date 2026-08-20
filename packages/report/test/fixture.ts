import {
  calculateCoverage,
  parseReport,
  REPORT_SCHEMA_VERSION,
  screenshotArtifactPath,
  type ExecutionResult,
  type MatrixCell,
  type StatecraftReport,
} from "@statecraft/core";

function cell(
  stateId: string,
  viewportId: string,
  theme: string,
): MatrixCell {
  const state = { id: stateId, setup: `./scenarios/${stateId}.mjs` };
  return {
    route: { id: "dashboard", path: "/dashboard", states: [state] },
    state,
    theme,
    viewport: { height: 800, width: 1_200 },
    viewportId,
  };
}

function namedCell(
  routeId: string,
  routePath: string,
  stateId: string,
  viewportId: string,
  theme: string,
  width: number,
  height: number,
): MatrixCell {
  const state = { id: stateId, setup: `./scenarios/${stateId}.mjs` };
  return {
    route: { id: routeId, path: routePath, states: [state] },
    state,
    theme,
    viewport: { height, width },
    viewportId,
  };
}

function execution(
  matrixCell: MatrixCell,
  status: "failed" | "passed",
): ExecutionResult {
  return {
    diagnostics: {
      consoleErrors:
        status === "failed" ? ["Widget <script>alert('x')</script> failed"] : [],
      failedRequests: [],
      navigationStatus: 200,
      pageErrors: [],
    },
    durationMs: status === "passed" ? 420 : 1_250,
    failures:
      status === "failed"
        ? [{ code: "ASSERTION_FAILED", message: "Expected <main> content." }]
        : [],
    routeId: matrixCell.route.id,
    routePath: matrixCell.route.path,
    scenarioSource: matrixCell.state.setup,
    screenshotPath: screenshotArtifactPath(matrixCell),
    stateId: matrixCell.state.id,
    status,
    theme: matrixCell.theme,
    url: `https://statecraft.invalid${matrixCell.route.path}`,
    viewport: matrixCell.viewport,
    viewportId: matrixCell.viewportId,
  };
}

export function reportFixture(): StatecraftReport {
  const cells = [cell("success", "desktop", "light"), cell("error", "desktop", "dark")];
  const executions = [execution(cells[0]!, "passed"), execution(cells[1]!, "failed")];
  const passed = executions.filter((result) => result.status === "passed").length;
  return parseReport({
    executions,
    generatedAt: "2026-08-20T18:00:00.000Z",
    project: { baseURL: "https://statecraft.invalid" },
    schemaVersion: REPORT_SCHEMA_VERSION,
    summary: {
      coverage: calculateCoverage(
        cells,
        executions.map((result) => ({
          passed: result.status === "passed",
          routeId: result.routeId,
          stateId: result.stateId,
          theme: result.theme,
          viewportId: result.viewportId,
        })),
      ),
      durationMs: executions.reduce((total, result) => total + result.durationMs, 0),
      executions: executions.length,
      failed: executions.length - passed,
      passed,
      routes: 1,
      states: 2,
    },
  });
}

export function interactiveReportFixture(): StatecraftReport {
  const cells = [
    namedCell("dashboard", "/dashboard", "success", "desktop", "light", 1_200, 800),
    namedCell("dashboard", "/dashboard", "error", "mobile", "dark", 390, 844),
    namedCell("settings", "/settings", "empty", "desktop", "dark", 1_200, 800),
    namedCell("settings", "/settings", "unauthorized", "mobile", "light", 390, 844),
  ];
  const executions = cells.map((matrixCell, index) =>
    execution(matrixCell, index % 2 === 0 ? "passed" : "failed"),
  );
  return parseReport({
    executions,
    generatedAt: "2026-08-20T18:00:00.000Z",
    project: { baseURL: "https://statecraft.invalid" },
    schemaVersion: REPORT_SCHEMA_VERSION,
    summary: {
      coverage: calculateCoverage(
        cells,
        executions.map((result) => ({
          passed: result.status === "passed",
          routeId: result.routeId,
          stateId: result.stateId,
          theme: result.theme,
          viewportId: result.viewportId,
        })),
      ),
      durationMs: executions.reduce(
        (total, result) => total + result.durationMs,
        0,
      ),
      executions: executions.length,
      failed: 2,
      passed: 2,
      routes: 2,
      states: 4,
    },
  });
}

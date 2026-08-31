import { describe, expect, it } from "vitest";

import {
  calculateCoverage,
  expandMatrix,
  parseConfig,
  type CoverageObservation,
  type MatrixCell,
  type UIWitnessConfig,
} from "../src/index.js";

function coverageConfig(): UIWitnessConfig {
  return parseConfig({
    baseURL: "http://localhost:3000",
    routes: [
      {
        id: "dashboard",
        path: "/dashboard",
        states: [
          { id: "success", setup: "./scenarios/dashboard/success.ts" },
          { id: "error", setup: "./scenarios/dashboard/error.ts" },
        ],
      },
      {
        id: "orders",
        path: "/orders",
        states: [{ id: "success", setup: "./scenarios/orders/success.ts" }],
      },
    ],
    themes: ["light", "dark"],
    viewports: {
      desktop: { height: 1000, width: 1440 },
      mobile: { height: 844, width: 390 },
    },
  });
}

function observation(
  cell: MatrixCell,
  passed: boolean,
): CoverageObservation {
  return {
    passed,
    routeId: cell.route.id,
    stateId: cell.state.id,
    theme: cell.theme,
    viewportId: cell.viewportId,
  };
}

function findCell(
  cells: readonly MatrixCell[],
  routeId: string,
  stateId: string,
  viewportId: string,
  theme: string,
): MatrixCell {
  const cell = cells.find(
    (candidate) =>
      candidate.route.id === routeId &&
      candidate.state.id === stateId &&
      candidate.viewportId === viewportId &&
      candidate.theme === theme,
  );

  if (cell === undefined) {
    throw new Error("Expected matrix cell was not found.");
  }
  return cell;
}

describe("calculateCoverage", () => {
  it("reports full coverage when every configured execution passes", () => {
    const cells = expandMatrix(coverageConfig());
    const summary = calculateCoverage(
      cells,
      cells.map((cell) => observation(cell, true)),
    );

    expect(summary).toEqual({
      execution: { covered: 12, percentage: 100, total: 12 },
      responsive: { covered: 3, percentage: 100, total: 3 },
      state: { covered: 3, percentage: 100, total: 3 },
      theme: { covered: 3, percentage: 100, total: 3 },
    });
  });

  it("uses configured cells as the denominator and missing observations as uncovered", () => {
    const cells = expandMatrix(coverageConfig(), {
      routeIds: ["dashboard"],
    });
    const observations = [
      observation(
        findCell(cells, "dashboard", "success", "desktop", "light"),
        true,
      ),
      observation(
        findCell(cells, "dashboard", "success", "mobile", "light"),
        true,
      ),
      observation(
        findCell(cells, "dashboard", "error", "desktop", "light"),
        true,
      ),
    ];

    expect(calculateCoverage(cells, observations)).toEqual({
      execution: { covered: 3, percentage: 37.5, total: 8 },
      responsive: { covered: 1, percentage: 50, total: 2 },
      state: { covered: 2, percentage: 100, total: 2 },
      theme: { covered: 0, percentage: 0, total: 2 },
    });
  });

  it("counts a dimension when every configured value has at least one pass", () => {
    const cells = expandMatrix(coverageConfig(), {
      routeIds: ["dashboard"],
      stateIds: ["success"],
    });
    const desktopAcrossThemes = [
      observation(
        findCell(cells, "dashboard", "success", "desktop", "light"),
        true,
      ),
      observation(
        findCell(cells, "dashboard", "success", "desktop", "dark"),
        true,
      ),
    ];

    expect(calculateCoverage(cells, desktopAcrossThemes)).toEqual({
      execution: { covered: 2, percentage: 50, total: 4 },
      responsive: { covered: 0, percentage: 0, total: 1 },
      state: { covered: 1, percentage: 100, total: 1 },
      theme: { covered: 1, percentage: 100, total: 1 },
    });
  });

  it("keeps identical state IDs scoped to their routes", () => {
    const cells = expandMatrix(coverageConfig());
    const ordersPass = observation(
      findCell(cells, "orders", "success", "desktop", "light"),
      true,
    );

    expect(calculateCoverage(cells, [ordersPass])).toEqual({
      execution: { covered: 1, percentage: 8.33, total: 12 },
      responsive: { covered: 0, percentage: 0, total: 3 },
      state: { covered: 1, percentage: 33.33, total: 3 },
      theme: { covered: 0, percentage: 0, total: 3 },
    });
  });

  it("ignores unconfigured and case-mismatched observations", () => {
    const cells = expandMatrix(coverageConfig(), {
      routeIds: ["dashboard"],
      stateIds: ["success"],
      themes: ["light"],
      viewportIds: ["desktop"],
    });
    const extras: CoverageObservation[] = [
      {
        passed: true,
        routeId: "Dashboard",
        stateId: "success",
        theme: "light",
        viewportId: "desktop",
      },
      {
        passed: true,
        routeId: "dashboard",
        stateId: "unconfigured",
        theme: "light",
        viewportId: "desktop",
      },
    ];

    expect(calculateCoverage(cells, extras)).toEqual({
      execution: { covered: 0, percentage: 0, total: 1 },
      responsive: { covered: 0, percentage: 0, total: 1 },
      state: { covered: 0, percentage: 0, total: 1 },
      theme: { covered: 0, percentage: 0, total: 1 },
    });
  });

  it("preserves configured denominators when no executions were observed", () => {
    const cells = expandMatrix(coverageConfig(), {
      routeIds: ["dashboard"],
      stateIds: ["success"],
    });

    expect(calculateCoverage(cells, [])).toEqual({
      execution: { covered: 0, percentage: 0, total: 4 },
      responsive: { covered: 0, percentage: 0, total: 1 },
      state: { covered: 0, percentage: 0, total: 1 },
      theme: { covered: 0, percentage: 0, total: 1 },
    });
  });

  it("collapses duplicate observations conservatively and without order dependence", () => {
    const cells = expandMatrix(coverageConfig(), {
      routeIds: ["dashboard"],
      stateIds: ["success"],
      themes: ["light"],
      viewportIds: ["desktop"],
    });
    const pass = observation(cells[0]!, true);
    const failure = observation(cells[0]!, false);

    expect(calculateCoverage(cells, [pass, pass])).toEqual({
      execution: { covered: 1, percentage: 100, total: 1 },
      responsive: { covered: 1, percentage: 100, total: 1 },
      state: { covered: 1, percentage: 100, total: 1 },
      theme: { covered: 1, percentage: 100, total: 1 },
    });
    const conflictedSummary = calculateCoverage(cells, [pass, failure]);
    expect(conflictedSummary).toEqual({
      execution: { covered: 0, percentage: 0, total: 1 },
      responsive: { covered: 0, percentage: 0, total: 1 },
      state: { covered: 0, percentage: 0, total: 1 },
      theme: { covered: 0, percentage: 0, total: 1 },
    });
    expect(conflictedSummary).toEqual(
      calculateCoverage(cells, [failure, pass]),
    );
  });

  it("collapses duplicate configured coordinates instead of inflating totals", () => {
    const [cell] = expandMatrix(coverageConfig(), {
      routeIds: ["dashboard"],
      stateIds: ["success"],
      themes: ["light"],
      viewportIds: ["desktop"],
    });
    const cells = [cell!, cell!];

    expect(calculateCoverage(cells, [observation(cell!, true)])).toEqual({
      execution: { covered: 1, percentage: 100, total: 1 },
      responsive: { covered: 1, percentage: 100, total: 1 },
      state: { covered: 1, percentage: 100, total: 1 },
      theme: { covered: 1, percentage: 100, total: 1 },
    });
  });

  it("rounds percentages to two decimal places", () => {
    const cells = expandMatrix(coverageConfig(), {
      routeIds: ["dashboard"],
      stateIds: ["success"],
      themes: ["light"],
    });
    const thirdViewport: MatrixCell = {
      ...cells[0]!,
      viewport: { height: 768, width: 1024 },
      viewportId: "tablet",
    };
    const configured = [...cells, thirdViewport];

    expect(
      calculateCoverage(configured, [observation(configured[0]!, true)]),
    ).toMatchObject({
      execution: { covered: 1, percentage: 33.33, total: 3 },
    });
    expect(
      calculateCoverage(configured, configured.slice(0, 2).map((cell) => observation(cell, true))),
    ).toMatchObject({
      execution: { covered: 2, percentage: 66.67, total: 3 },
    });
  });

  it("rounds exact percentage midpoints up", () => {
    const [cell] = expandMatrix(coverageConfig(), {
      routeIds: ["dashboard"],
      stateIds: ["success"],
      themes: ["light"],
      viewportIds: ["desktop"],
    });
    const configured = Array.from({ length: 800 }, (_, index) => ({
      ...cell!,
      viewportId: `viewport-${index}`,
    }));
    const observations = configured
      .slice(0, 57)
      .map((configuredCell) => observation(configuredCell, true));

    expect(calculateCoverage(configured, observations)).toMatchObject({
      execution: { covered: 57, percentage: 7.13, total: 800 },
    });
  });

  it("returns zero-valued metrics for an empty filtered matrix", () => {
    expect(
      calculateCoverage(expandMatrix(coverageConfig(), { routeIds: [] }), [
        {
          passed: true,
          routeId: "dashboard",
          stateId: "success",
          theme: "light",
          viewportId: "desktop",
        },
      ]),
    ).toEqual({
      execution: { covered: 0, percentage: 0, total: 0 },
      responsive: { covered: 0, percentage: 0, total: 0 },
      state: { covered: 0, percentage: 0, total: 0 },
      theme: { covered: 0, percentage: 0, total: 0 },
    });
  });

  it("does not mutate inputs and returns immutable summary objects", () => {
    const cells = expandMatrix(coverageConfig());
    const observations = cells.map((cell) => observation(cell, true));
    const cellSnapshot = structuredClone(cells);
    const observationSnapshot = structuredClone(observations);
    const summary = calculateCoverage(cells, observations);

    expect(cells).toEqual(cellSnapshot);
    expect(observations).toEqual(observationSnapshot);
    expect(Object.isFrozen(summary)).toBe(true);
    expect(Object.values(summary).every(Object.isFrozen)).toBe(true);
  });
});

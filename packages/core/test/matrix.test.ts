import { describe, expect, it } from "vitest";

import {
  expandMatrix,
  parseConfig,
  type MatrixCell,
  type UIWitnessConfig,
} from "../src/index.js";

function matrixConfig(): UIWitnessConfig {
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
        states: [{ id: "loading", setup: "./scenarios/orders/loading.ts" }],
      },
    ],
    themes: ["light", "dark"],
    viewports: {
      desktop: { height: 1000, width: 1440 },
      mobile: { height: 844, width: 390 },
    },
  });
}

function coordinates(cells: readonly MatrixCell[]): string[] {
  return cells.map(
    ({ route, state, viewportId, theme }) =>
      `${route.id}/${state.id}/${viewportId}/${theme}`,
  );
}

describe("expandMatrix", () => {
  it("expands every configured route x state x viewport x theme cell", () => {
    const cells = expandMatrix(matrixConfig());

    expect(coordinates(cells)).toEqual([
      "dashboard/success/desktop/light",
      "dashboard/success/desktop/dark",
      "dashboard/success/mobile/light",
      "dashboard/success/mobile/dark",
      "dashboard/error/desktop/light",
      "dashboard/error/desktop/dark",
      "dashboard/error/mobile/light",
      "dashboard/error/mobile/dark",
      "orders/loading/desktop/light",
      "orders/loading/desktop/dark",
      "orders/loading/mobile/light",
      "orders/loading/mobile/dark",
    ]);
  });

  it("carries the complete definitions needed by a future runner", () => {
    const [cell] = expandMatrix(matrixConfig(), {
      routeIds: ["dashboard"],
      stateIds: ["success"],
      themes: ["dark"],
      viewportIds: ["mobile"],
    });

    expect(cell).toEqual({
      route: {
        id: "dashboard",
        path: "/dashboard",
        states: [
          { id: "success", setup: "./scenarios/dashboard/success.ts" },
          { id: "error", setup: "./scenarios/dashboard/error.ts" },
        ],
      },
      state: { id: "success", setup: "./scenarios/dashboard/success.ts" },
      theme: "dark",
      viewport: { height: 844, width: 390 },
      viewportId: "mobile",
    });
  });

  it("filters every dimension by exact configured identifiers", () => {
    const cells = expandMatrix(matrixConfig(), {
      routeIds: ["dashboard"],
      stateIds: ["error"],
      themes: ["light"],
      viewportIds: ["desktop"],
    });

    expect(coordinates(cells)).toEqual(["dashboard/error/desktop/light"]);
  });

  it("selects the same state ID under every matching route", () => {
    const config = parseConfig({
      ...matrixConfig(),
      routes: [
        {
          id: "dashboard",
          path: "/dashboard",
          states: [
            { id: "success", setup: "./scenarios/dashboard/success.ts" },
          ],
        },
        {
          id: "orders",
          path: "/orders",
          states: [{ id: "success", setup: "./scenarios/orders/success.ts" }],
        },
      ],
      themes: ["light"],
      viewports: { desktop: { height: 1000, width: 1440 } },
    });

    expect(coordinates(expandMatrix(config, { stateIds: ["success"] }))).toEqual(
      ["dashboard/success/desktop/light", "orders/success/desktop/light"],
    );
  });

  it("matches filter IDs case-sensitively", () => {
    expect(
      expandMatrix(matrixConfig(), {
        routeIds: ["Dashboard"],
        stateIds: ["Success"],
        themes: ["Light"],
        viewportIds: ["Desktop"],
      }),
    ).toEqual([]);
  });

  it("preserves matrix order regardless of filter order or duplicates", () => {
    const cells = expandMatrix(matrixConfig(), {
      routeIds: ["orders", "dashboard", "dashboard"],
      stateIds: ["loading", "success", "success"],
      themes: ["dark", "light", "dark"],
      viewportIds: ["mobile", "desktop", "mobile"],
    });

    expect(coordinates(cells)).toEqual([
      "dashboard/success/desktop/light",
      "dashboard/success/desktop/dark",
      "dashboard/success/mobile/light",
      "dashboard/success/mobile/dark",
      "orders/loading/desktop/light",
      "orders/loading/desktop/dark",
      "orders/loading/mobile/light",
      "orders/loading/mobile/dark",
    ]);
  });

  it("uses deterministic ECMAScript property order for viewport IDs", () => {
    const config = parseConfig({
      ...matrixConfig(),
      routes: [
        {
          id: "dashboard",
          path: "/dashboard",
          states: [
            { id: "success", setup: "./scenarios/dashboard/success.ts" },
          ],
        },
      ],
      themes: ["light"],
      viewports: {
        "10": { height: 1000, width: 1000 },
        "2": { height: 200, width: 200 },
        mobile: { height: 844, width: 390 },
      },
    });

    expect(coordinates(expandMatrix(config))).toEqual([
      "dashboard/success/2/light",
      "dashboard/success/10/light",
      "dashboard/success/mobile/light",
    ]);
  });

  it.each([
    ["route", { routeIds: ["unknown"] }],
    ["state", { stateIds: ["unknown"] }],
    ["theme", { themes: ["unknown"] }],
    ["viewport", { viewportIds: ["unknown"] }],
    ["empty route selection", { routeIds: [] }],
    ["empty state selection", { stateIds: [] }],
    ["empty theme selection", { themes: [] }],
    ["empty viewport selection", { viewportIds: [] }],
  ])("returns no cells for an unmatched %s filter", (_label, filter) => {
    expect(expandMatrix(matrixConfig(), filter)).toEqual([]);
  });

  it("does not mutate the validated configuration", () => {
    const config = matrixConfig();
    const snapshot = structuredClone(config);

    expandMatrix(config, {
      routeIds: ["orders"],
      themes: ["dark"],
    });

    expect(config).toEqual(snapshot);
  });
});

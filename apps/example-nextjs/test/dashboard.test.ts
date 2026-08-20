import { describe, expect, it } from "vitest";

import {
  dashboardContentState,
  dashboardData,
  parseDashboardData,
} from "../lib/dashboard";

describe("dashboard fixture contract", () => {
  it("keeps the default payload deterministic and successful", () => {
    expect(parseDashboardData(structuredClone(dashboardData))).toEqual(dashboardData);
    expect(dashboardContentState(dashboardData)).toBe("success");
    expect(dashboardData.metrics).toHaveLength(4);
    expect(dashboardData.orders).toHaveLength(4);
  });

  it("classifies a valid no-data response as empty", () => {
    const empty = parseDashboardData({
      metrics: [],
      orders: [],
      pulse: [],
      summary: { atRisk: 0, fulfilledToday: 0, nextDispatch: "Not scheduled" },
    });

    expect(dashboardContentState(empty)).toBe("empty");
  });

  it.each([
    null,
    {},
    { ...dashboardData, pulse: [42, Number.NaN] },
    { ...dashboardData, pulse: dashboardData.pulse.slice(0, 11) },
    { ...dashboardData, metrics: [dashboardData.metrics[0], dashboardData.metrics[0]] },
    { ...dashboardData, orders: [dashboardData.orders[0], dashboardData.orders[0]] },
    { ...dashboardData, orders: [{ status: "Unknown" }] },
    { ...dashboardData, summary: { atRisk: "12" } },
  ])("rejects malformed API payload %#", (payload) => {
    expect(() => parseDashboardData(payload)).toThrow(
      /Dashboard response (must be an object|does not match)/,
    );
  });
});

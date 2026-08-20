import { describe, expect, it } from "vitest";

import { transformReport } from "../src/transform.js";
import { reportFixture } from "./fixture.js";

describe("transformReport", () => {
  it("builds deterministic columns, route rows, and relative screenshot references", () => {
    const report = reportFixture();

    const view = transformReport(report);

    expect(view.columns).toEqual([
      {
        height: 800,
        id: "column-1",
        theme: "light",
        viewportId: "desktop",
        width: 1_200,
      },
      {
        height: 800,
        id: "column-2",
        theme: "dark",
        viewportId: "desktop",
        width: 1_200,
      },
    ]);
    expect(view.routes).toHaveLength(1);
    expect(view.routes[0]).toMatchObject({ id: "dashboard", path: "/dashboard" });
    expect(view.routes[0]!.rows.map((row) => row.stateId)).toEqual([
      "success",
      "error",
    ]);
    expect(view.routes[0]!.rows[0]!.cells[0]).toMatchObject({
      detailId: "execution-1",
      screenshotHref: "../artifacts/dashboard/success/desktop-light.png",
    });
    expect(view.routes[0]!.rows[0]!.cells[1]).toBeNull();
    expect(view.routes[0]!.rows[1]!.cells[0]).toBeNull();
    expect(view.routes[0]!.rows[1]!.cells[1]).toMatchObject({
      detailId: "execution-2",
      screenshotHref: "../artifacts/dashboard/error/desktop-dark.png",
    });
  });

  it("validates unknown report data before transformation", () => {
    expect(() => transformReport({ schemaVersion: 99 })).toThrow(
      "Invalid Statecraft report.",
    );
  });
});

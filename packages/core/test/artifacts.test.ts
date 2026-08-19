import { describe, expect, it } from "vitest";

import {
  expandMatrix,
  parseConfig,
  screenshotArtifactPath,
  type MatrixCell,
} from "../src/index.js";

function cells(): readonly MatrixCell[] {
  return expandMatrix(
    parseConfig({
      baseURL: "http://localhost:3000",
      routes: [
        {
          id: "customer-details",
          path: "/customers/42",
          states: [
            {
              id: "payment-declined",
              setup: "./scenarios/payment-declined.ts",
            },
          ],
        },
      ],
      themes: ["wide-dark", "dark"],
      viewports: {
        desktop: { height: 1000, width: 1440 },
        "desktop-wide": { height: 1000, width: 1920 },
      },
    }),
  );
}

describe("screenshotArtifactPath", () => {
  it("returns the documented project-relative PNG path", () => {
    expect(screenshotArtifactPath(cells()[1]!)).toBe(
      ".statecraft/artifacts/customer-details/payment-declined/desktop-dark.png",
    );
  });

  it("returns the same path for the same execution coordinate", () => {
    const [cell] = cells();

    expect(screenshotArtifactPath(cell!)).toBe(screenshotArtifactPath(cell!));
  });

  it("keeps ambiguous viewport and theme partitions collision-free", () => {
    const paths = cells().map(screenshotArtifactPath);

    expect(paths).toContain(
      ".statecraft/artifacts/customer-details/payment-declined/desktop-wide~00002Ddark.png",
    );
    expect(paths).toContain(
      ".statecraft/artifacts/customer-details/payment-declined/desktop~00002Dwide-dark.png",
    );
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("encodes forged unsafe coordinates instead of permitting path traversal", () => {
    const [baseCell] = cells();
    const unsafeCell: MatrixCell = {
      ...baseCell!,
      route: { ...baseCell!.route, id: "../Dashboard" },
      state: { ...baseCell!.state, id: "success/../error" },
      theme: "Dark/Mode",
      viewportId: "../Wide-Screen",
    };

    const path = screenshotArtifactPath(unsafeCell);

    expect(path).toBe(
      ".statecraft/artifacts/~00002E~00002E~00002F~000044ashboard/success~00002F~00002E~00002E~00002Ferror/~00002E~00002E~00002F~000057ide~00002D~000053creen-~000044ark~00002F~00004Dode.png",
    );
    expect(path).not.toContain("../");
  });

  it("encodes Windows-reserved route and state directory names", () => {
    const [baseCell] = cells();
    const reservedCell: MatrixCell = {
      ...baseCell!,
      route: { ...baseCell!.route, id: "con" },
      state: { ...baseCell!.state, id: "aux" },
      theme: "dark",
      viewportId: "desktop",
    };

    expect(screenshotArtifactPath(reservedCell)).toBe(
      ".statecraft/artifacts/~000063on/~000061ux/desktop-dark.png",
    );
  });

  it("keeps empty forged segments distinct from literal tildes", () => {
    const [baseCell] = cells();
    const emptyCell: MatrixCell = {
      ...baseCell!,
      route: { ...baseCell!.route, id: "" },
      state: { ...baseCell!.state, id: "" },
      theme: "",
      viewportId: "",
    };
    const tildeCell: MatrixCell = {
      ...emptyCell,
      route: { ...emptyCell.route, id: "~" },
      state: { ...emptyCell.state, id: "~" },
      theme: "~",
      viewportId: "~",
    };

    expect(screenshotArtifactPath(emptyCell)).toBe(
      ".statecraft/artifacts/~/~/~-~.png",
    );
    expect(screenshotArtifactPath(tildeCell)).toBe(
      ".statecraft/artifacts/~00007E/~00007E/~00007E-~00007E.png",
    );
    expect(screenshotArtifactPath(emptyCell)).not.toBe(
      screenshotArtifactPath(tildeCell),
    );
  });

  it("remains distinct after case folding and Unicode normalization", () => {
    const [baseCell] = cells();
    const variants: MatrixCell[] = [
      { ...baseCell!, viewportId: "mobile" },
      { ...baseCell!, viewportId: "Mobile" },
      { ...baseCell!, viewportId: "caf\u00e9" },
      { ...baseCell!, viewportId: "cafe\u0301" },
    ];
    const normalizedPaths = variants.map((cell) =>
      screenshotArtifactPath(cell).toLowerCase().normalize("NFC"),
    );

    expect(new Set(normalizedPaths).size).toBe(variants.length);
  });

  it("bounds long valid identifiers with stable collision-resistant digests", () => {
    const sharedPrefix = Array.from({ length: 80 }, () => "segment").join("-");
    const config = parseConfig({
      baseURL: "http://localhost:3000",
      routes: [
        {
          id: `${sharedPrefix}-route`,
          path: "/long",
          states: [
            {
              id: `${sharedPrefix}-state`,
              setup: "./scenarios/long.ts",
            },
          ],
        },
      ],
      themes: [`${sharedPrefix}-dark`, `${sharedPrefix}-light`],
      viewports: {
        [`${sharedPrefix}-viewport`]: { height: 1000, width: 1440 },
      },
    });
    const paths = expandMatrix(config).map(screenshotArtifactPath);

    for (const path of paths) {
      const [, , routeId, stateId, filename] = path.split("/");
      expect(routeId).toHaveLength(120);
      expect(stateId).toHaveLength(120);
      expect(filename!.length).toBeLessThanOrEqual(245);
    }
    expect(paths[0]).toBe(screenshotArtifactPath(expandMatrix(config)[0]!));
    expect(paths[0]).not.toBe(paths[1]);
  });
});

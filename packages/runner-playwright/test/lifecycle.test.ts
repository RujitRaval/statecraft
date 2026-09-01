import path from "node:path";

import type { Browser, BrowserContext } from "playwright";
import { describe, expect, it } from "vitest";

import { expandMatrix, parseConfig } from "uiwitness-core";

import { runExecutionCells } from "../src/index.js";
import { renderFixturePage } from "./fixtures/page.js";

const cells = expandMatrix(
  parseConfig({
    baseURL: "http://127.0.0.1:3000",
    routes: [
      {
        id: "fixture",
        path: "/fixture",
        states: [{ id: "ready", setup: "./fixtures/ready.ts" }],
      },
    ],
    themes: ["light"],
    viewports: {
      desktop: { height: 720, width: 1280 },
      mobile: { height: 844, width: 390 },
    },
  }),
);
const missingBrowserExecutable = path.join(
  process.cwd(),
  "uiwitness-missing-browser-executable",
);

describe("runExecutionCells", () => {
  it("reuses one browser while isolating storage, pages, and viewports per cell", async () => {
    const browsers: Browser[] = [];
    const contexts: BrowserContext[] = [];

    const outcomes = await runExecutionCells(cells, async ({ cell, context, page }) => {
      const browser = context.browser();
      if (browser === null) {
        throw new Error("Expected a browser-owned context.");
      }
      browsers.push(browser);
      contexts.push(context);

      await renderFixturePage(page);
      const initialCookies = await context.cookies(
        "https://uiwitness.invalid",
      );
      await context.addCookies([
        {
          name: "uiwitness-cell",
          url: "https://uiwitness.invalid",
          value: cell.viewportId,
        },
      ]);

      return {
        initialCookieCount: initialCookies.length,
        text: await page.locator("#fixture").textContent(),
        viewport: page.viewportSize(),
      };
    });

    expect(outcomes).toHaveLength(2);
    expect(outcomes.map((outcome) => outcome.status)).toEqual([
      "fulfilled",
      "fulfilled",
    ]);
    expect(
      outcomes.map((outcome) =>
        outcome.status === "fulfilled"
          ? outcome.value.initialCookieCount
          : "failed",
      ),
    ).toEqual([0, 0]);
    expect(
      outcomes.map((outcome) =>
        outcome.status === "fulfilled" ? outcome.value.text : "failed",
      ),
    ).toEqual(["ready", "ready"]);
    expect(
      outcomes.map((outcome) =>
        outcome.status === "fulfilled" ? outcome.value.viewport : null,
      ),
    ).toEqual([
      { height: 720, width: 1280 },
      { height: 844, width: 390 },
    ]);

    expect(browsers[0]).toBe(browsers[1]);
    expect(browsers[0]?.isConnected()).toBe(false);
    expect(contexts[0]).not.toBe(contexts[1]);
    expect(contexts.every((context) => context.pages().length === 0)).toBe(true);
    expect(Object.isFrozen(outcomes)).toBe(true);
  });

  it("settles a failed cell and continues with the remaining cells", async () => {
    const visited: string[] = [];
    const contexts: BrowserContext[] = [];

    const outcomes = await runExecutionCells(cells, async ({ cell, context }) => {
      visited.push(cell.viewportId);
      contexts.push(context);
      if (cell.viewportId === "desktop") {
        throw new Error("fixture failure");
      }
      return cell.viewportId;
    });

    expect(visited).toEqual(["desktop", "mobile"]);
    expect(outcomes[0]).toMatchObject({
      cell: cells[0],
      status: "rejected",
    });
    expect(
      outcomes[0]?.status === "rejected" ? outcomes[0].reason : undefined,
    ).toEqual(new Error("fixture failure"));
    expect(outcomes[1]).toEqual({
      cell: cells[1],
      status: "fulfilled",
      value: "mobile",
    });
    expect(contexts.every((context) => context.pages().length === 0)).toBe(true);
  });

  it("returns an immutable empty result without invoking the callback", async () => {
    let called = false;

    const outcomes = await runExecutionCells(
      [],
      async () => {
        called = true;
        return "unused";
      },
      { launchOptions: { executablePath: missingBrowserExecutable } },
    );

    expect(outcomes).toEqual([]);
    expect(Object.isFrozen(outcomes)).toBe(true);
    expect(called).toBe(false);
  });

  it("rejects a run-level browser launch failure", async () => {
    await expect(
      runExecutionCells(cells.slice(0, 1), async () => "unused", {
        launchOptions: { executablePath: missingBrowserExecutable },
      }),
    ).rejects.toThrow(/executable/i);
  });
});

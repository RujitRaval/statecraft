import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { expandMatrix, parseConfig, type MatrixCell } from "statecraft-ui-core";

import { runNavigatedScenarioCells } from "../src/index.js";

const scenarioBaseDirectory = fileURLToPath(
  new URL("./fixtures/scenarios/", import.meta.url),
);
const baseURL = "https://statecraft.invalid/base/";
const missingBrowserExecutable = path.join(
  process.cwd(),
  "statecraft-missing-navigation-browser-executable",
);

async function localOrigin(): Promise<{
  readonly close: () => Promise<void>;
  readonly origin: string;
}> {
  const server = http.createServer((_request, response) => {
    response.writeHead(200, { "content-type": "text/html" });
    response.end("<!doctype html><html><body>outside origin</body></html>");
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("Navigation redirect fixture did not bind a TCP port.");
  }

  return {
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error === undefined) {
            resolve();
          } else {
            reject(error);
          }
        });
      }),
    origin: `http://127.0.0.1:${address.port}`,
  };
}

function navigationCells(
  states: readonly string[],
  themes: readonly string[] = ["light"],
): readonly MatrixCell[] {
  return expandMatrix(
    parseConfig({
      baseURL,
      routes: [
        {
          id: "fixture",
          path: "/fixture?source=statecraft#panel",
          states: states.map((id) => ({
            id,
            setup: "./navigation.mjs",
          })),
        },
      ],
      themes,
      viewports: { desktop: { height: 720, width: 1280 } },
    }),
  );
}

describe("runNavigatedScenarioCells", () => {
  it("applies themes before application scripts and runs post-readiness work", async () => {
    const eventKey = Symbol.for("statecraft.test.navigation-events");
    const events: string[] = [];
    Reflect.set(globalThis, eventKey, events);
    const cells = navigationCells(
      ["after-ready"],
      ["light", "dark", "solarized"],
    );

    try {
      const outcomes = await runNavigatedScenarioCells(
        cells,
        async (context) => {
          expect(Object.isFrozen(context)).toBe(true);
          expect(Object.isFrozen(context.navigation)).toBe(true);
          const pageState = await context.page.evaluate(() => {
            const boot = (
              globalThis as typeof globalThis & {
                statecraftBoot: {
                  dark: boolean;
                  reducedMotion: boolean;
                  theme: string | undefined;
                };
              }
            ).statecraftBoot;
            const animated = getComputedStyle(
              document.querySelector("#animated")!,
            );
            const caret = getComputedStyle(document.querySelector("#caret")!);
            return {
              animationName: animated.animationName,
              boot,
              caretColor: caret.caretColor,
              fontStatus: document.fonts.status,
              imageComplete: (
                document.querySelector("#slow-image") as HTMLImageElement
              ).complete,
              readyText: document.querySelector("#ready")?.textContent,
              theme: document.documentElement.dataset["theme"],
              transitionDuration: animated.transitionDuration,
            };
          });
          events.push(`execute:${context.state.id}:${context.theme}`);
          return {
            navigation: context.navigation,
            pageState,
          };
        },
        {
          baseURL,
          navigationTimeoutMs: 2_000,
          readiness: { selector: "#ready", timeoutMs: 2_000 },
          scenarioBaseDirectory,
        },
      );

      expect(outcomes.map((outcome) => outcome.status)).toEqual([
        "fulfilled",
        "fulfilled",
        "fulfilled",
      ]);
      const values = outcomes.map((outcome) =>
        outcome.status === "fulfilled" ? outcome.value : undefined,
      );
      expect(values.map((value) => value?.navigation)).toEqual([
        {
          requestedUrl:
            "https://statecraft.invalid/fixture?source=statecraft#panel",
          status: 207,
          url: "https://statecraft.invalid/fixture?source=statecraft#panel",
        },
        {
          requestedUrl:
            "https://statecraft.invalid/fixture?source=statecraft#panel",
          status: 207,
          url: "https://statecraft.invalid/fixture?source=statecraft#panel",
        },
        {
          requestedUrl:
            "https://statecraft.invalid/fixture?source=statecraft#panel",
          status: 207,
          url: "https://statecraft.invalid/fixture?source=statecraft#panel",
        },
      ]);
      expect(values.map((value) => value?.pageState.boot.theme)).toEqual([
        "light",
        "dark",
        "solarized",
      ]);
      expect(values.map((value) => value?.pageState.boot.dark)).toEqual([
        false,
        true,
        false,
      ]);
      expect(
        values.every((value) => value?.pageState.boot.reducedMotion === true),
      ).toBe(true);
      expect(
        values.every(
          (value) =>
            value?.pageState.animationName === "none" &&
            value.pageState.caretColor === "rgba(0, 0, 0, 0)" &&
            value.pageState.fontStatus === "loaded" &&
            value.pageState.imageComplete &&
            value.pageState.readyText === "ready after hook" &&
            value.pageState.theme === value.pageState.boot.theme &&
            value.pageState.transitionDuration === "0s",
        ),
      ).toBe(true);
      expect(events).toEqual([
        "before:after-ready:light",
        "after:after-ready:light",
        "execute:after-ready:light",
        "before:after-ready:dark",
        "after:after-ready:dark",
        "execute:after-ready:dark",
        "before:after-ready:solarized",
        "after:after-ready:solarized",
        "execute:after-ready:solarized",
      ]);
    } finally {
      Reflect.deleteProperty(globalThis, eventKey);
    }
  });

  it("settles invalid routes, navigation failures, and readiness timeouts", async () => {
    const eventKey = Symbol.for("statecraft.test.navigation-events");
    const redirectOriginKey = Symbol.for(
      "statecraft.test.navigation-redirect-origin",
    );
    const events: string[] = [];
    const redirectServer = await localOrigin();
    Reflect.set(globalThis, eventKey, events);
    Reflect.set(globalThis, redirectOriginKey, redirectServer.origin);
    const configured = navigationCells([
      "before-failure",
      "after-failure",
      "navigation-failure",
      "redirect-cross-origin",
      "after-cross-origin",
      "never-ready",
      "ready",
    ]);
    const invalidRoute = {
      ...configured[0]!,
      route: { ...configured[0]!.route, path: "//outside.invalid/fixture" },
    };
    const invalidScenario = {
      ...configured[0]!,
      state: {
        ...configured[0]!.state,
        id: "invalid-scenario",
        setup: "./invalid-hook.mjs",
      },
    };
    const cells = [invalidRoute, invalidScenario, ...configured];

    try {
      const outcomes = await runNavigatedScenarioCells(
        cells,
        async ({ state }) => {
          events.push(`execute:${state.id}:light`);
          return state.id;
        },
        {
          baseURL,
          navigationTimeoutMs: 1_000,
          readiness: { selector: "#ready", timeoutMs: 100 },
          scenarioBaseDirectory,
        },
      );

      expect(outcomes.map((outcome) => outcome.status)).toEqual([
        "rejected",
        "rejected",
        "rejected",
        "rejected",
        "rejected",
        "rejected",
        "rejected",
        "rejected",
        "fulfilled",
      ]);
      expect(
        outcomes[0]?.status === "rejected" ? outcomes[0].reason : undefined,
      ).toEqual(
        new TypeError(
          "Route path must stay on the configured origin: //outside.invalid/fixture.",
        ),
      );
      expect(
        outcomes[1]?.status === "rejected" ? outcomes[1].reason : undefined,
      ).toMatchObject({ code: "invalid-module", name: "ScenarioLoadError" });
      expect(
        outcomes[2]?.status === "rejected" ? outcomes[2].reason : undefined,
      ).toEqual(new Error("before navigation hook failed"));
      expect(
        outcomes[3]?.status === "rejected" ? outcomes[3].reason : undefined,
      ).toEqual(new Error("after navigation hook failed"));
      expect(
        outcomes[4]?.status === "rejected" ? outcomes[4].reason : undefined,
      ).toBeInstanceOf(Error);
      expect(
        outcomes[5]?.status === "rejected" ? outcomes[5].reason : undefined,
      ).toEqual(
        new TypeError(
          `Navigation must stay on the configured origin (received ${redirectServer.origin}).`,
        ),
      );
      expect(
        outcomes[6]?.status === "rejected" ? outcomes[6].reason : undefined,
      ).toEqual(
        new TypeError(
          `Navigation must stay on the configured origin (received ${redirectServer.origin}).`,
        ),
      );
      expect(
        outcomes[7]?.status === "rejected" ? outcomes[7].reason : undefined,
      ).toMatchObject({ name: "TimeoutError" });
      expect(outcomes[8]).toEqual({
        cell: cells[8],
        status: "fulfilled",
        value: "ready",
      });
      expect(events).toEqual([
        "before:before-failure:light",
        "before:after-failure:light",
        "after:after-failure:light",
        "before:navigation-failure:light",
        "before:redirect-cross-origin:light",
        "before:after-cross-origin:light",
        "after:after-cross-origin:light",
        "before:never-ready:light",
        "after:never-ready:light",
        "before:ready:light",
        "after:ready:light",
        "execute:ready:light",
      ]);
    } finally {
      Reflect.deleteProperty(globalThis, eventKey);
      Reflect.deleteProperty(globalThis, redirectOriginKey);
      await redirectServer.close();
    }
  });

  it("uses load and font readiness when no selector is configured", async () => {
    const eventKey = Symbol.for("statecraft.test.navigation-events");
    const events: string[] = [];
    Reflect.set(globalThis, eventKey, events);

    try {
      const cells = navigationCells(["never-ready"]);
      const outcomes = await runNavigatedScenarioCells(
        cells,
        async ({ page }) => ({
          fontStatus: await page.evaluate(() => document.fonts.status),
          imageComplete: await page
            .locator("#slow-image")
            .evaluate((image) => (image as HTMLImageElement).complete),
        }),
        {
          baseURL,
          readiness: { timeoutMs: 1_000 },
          scenarioBaseDirectory,
        },
      );

      expect(outcomes).toEqual([
        {
          cell: cells[0],
          status: "fulfilled",
          value: { fontStatus: "loaded", imageComplete: true },
        },
      ]);
      expect(events).toEqual([
        "before:never-ready:light",
        "after:never-ready:light",
      ]);
    } finally {
      Reflect.deleteProperty(globalThis, eventKey);
    }
  });

  it("reports built-in navigation status with the final same-origin URL", async () => {
    const eventKey = Symbol.for("statecraft.test.navigation-events");
    const events: string[] = [];
    Reflect.set(globalThis, eventKey, events);

    try {
      const cells = navigationCells(["after-same-origin"]);
      const outcomes = await runNavigatedScenarioCells(
        cells,
        async ({ navigation }) => navigation,
        {
          baseURL,
          readiness: { timeoutMs: 1_000 },
          scenarioBaseDirectory,
        },
      );

      expect(outcomes).toEqual([
        {
          cell: cells[0],
          status: "fulfilled",
          value: {
            requestedUrl:
              "https://statecraft.invalid/fixture?source=statecraft#panel",
            status: 207,
            url: "https://statecraft.invalid/same-origin",
          },
        },
      ]);
    } finally {
      Reflect.deleteProperty(globalThis, eventKey);
    }
  });

  it("rejects cross-origin navigation scheduled during readiness", async () => {
    const eventKey = Symbol.for("statecraft.test.navigation-events");
    const redirectOriginKey = Symbol.for(
      "statecraft.test.navigation-redirect-origin",
    );
    const events: string[] = [];
    const redirectServer = await localOrigin();
    Reflect.set(globalThis, eventKey, events);
    Reflect.set(globalThis, redirectOriginKey, redirectServer.origin);

    try {
      const cells = navigationCells(["readiness-cross-origin", "ready"]);
      const outcomes = await runNavigatedScenarioCells(
        cells,
        async ({ state }) => state.id,
        {
          baseURL,
          readiness: { timeoutMs: 1_000 },
          scenarioBaseDirectory,
        },
      );

      expect(outcomes[0]).toEqual({
        cell: cells[0],
        reason: new TypeError(
          `Navigation must stay on the configured origin (received ${redirectServer.origin}).`,
        ),
        status: "rejected",
      });
      expect(outcomes[1]).toEqual({
        cell: cells[1],
        status: "fulfilled",
        value: "ready",
      });
    } finally {
      Reflect.deleteProperty(globalThis, eventKey);
      Reflect.deleteProperty(globalThis, redirectOriginKey);
      await redirectServer.close();
    }
  });

  it("rejects same-origin document navigation during readiness", async () => {
    const eventKey = Symbol.for("statecraft.test.navigation-events");
    const events: string[] = [];
    Reflect.set(globalThis, eventKey, events);

    try {
      const cells = navigationCells(["readiness-same-origin", "ready"]);
      const outcomes = await runNavigatedScenarioCells(
        cells,
        async ({ state }) => state.id,
        {
          baseURL,
          readiness: { timeoutMs: 1_000 },
          scenarioBaseDirectory,
        },
      );

      expect(outcomes[0]).toEqual({
        cell: cells[0],
        reason: new TypeError(
          "Navigation cannot change the document during deterministic readiness.",
        ),
        status: "rejected",
      });
      expect(outcomes[1]).toEqual({
        cell: cells[1],
        status: "fulfilled",
        value: "ready",
      });
    } finally {
      Reflect.deleteProperty(globalThis, eventKey);
    }
  });

  it("waits for a font load started after the normal load event", async () => {
    const eventKey = Symbol.for("statecraft.test.navigation-events");
    const events: string[] = [];
    Reflect.set(globalThis, eventKey, events);

    try {
      const cells = navigationCells(["font-ready"]);
      const outcomes = await runNavigatedScenarioCells(
        cells,
        async ({ page, state }) => {
          events.push(`execute:${state.id}:light`);
          return page.evaluate(() => document.fonts.status);
        },
        {
          baseURL,
          readiness: { timeoutMs: 1_000 },
          scenarioBaseDirectory,
        },
      );

      expect(outcomes).toEqual([
        {
          cell: cells[0],
          status: "fulfilled",
          value: "loaded",
        },
      ]);
      expect(events).toEqual([
        "before:font-ready:light",
        "after:font-ready:light",
        "font-response:font-ready:light",
        "execute:font-ready:light",
      ]);
    } finally {
      Reflect.deleteProperty(globalThis, eventKey);
    }
  });

  it.each([
    ["invalid base URL", { baseURL: "not-a-url" }, "valid HTTP(S) URL"],
    ["non-HTTP base URL", { baseURL: "file:///tmp/app" }, "valid HTTP(S) URL"],
    [
      "empty readiness selector",
      { baseURL, readiness: { selector: "  " } },
      "readiness.selector cannot be empty",
    ],
    [
      "zero navigation timeout",
      { baseURL, navigationTimeoutMs: 0 },
      "navigationTimeoutMs must be a positive safe integer",
    ],
    [
      "fractional readiness timeout",
      { baseURL, readiness: { timeoutMs: 1.5 } },
      "readiness.timeoutMs must be a positive safe integer",
    ],
  ])("rejects %s before launching Chromium", async (_label, options, message) => {
    let called = false;

    await expect(
      runNavigatedScenarioCells(
        [],
        async () => {
          called = true;
        },
        options,
      ),
    ).rejects.toThrow(message);
    expect(called).toBe(false);
  });

  it("forwards browser launch options", async () => {
    await expect(
      runNavigatedScenarioCells(navigationCells(["ready"]), async () => true, {
        baseURL,
        launchOptions: { executablePath: missingBrowserExecutable },
        scenarioBaseDirectory,
      }),
    ).rejects.toThrow(/executable/i);
  });
});

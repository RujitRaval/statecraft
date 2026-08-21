import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { expandMatrix, parseConfig } from "statecraft-ui-core";

import {
  loadScenario,
  runScenarioCells,
  runScenarioLifecycle,
  ScenarioLoadError,
  type ScenarioContext,
  type StatecraftScenario,
} from "../src/index.js";

const scenarioBaseDirectory = fileURLToPath(
  new URL("./fixtures/scenarios/", import.meta.url),
);
const missingBrowserExecutable = path.join(
  process.cwd(),
  "statecraft-missing-scenario-browser-executable",
);

function scenarioCells(
  states: readonly { readonly id: string; readonly setup: string }[],
) {
  return expandMatrix(
    parseConfig({
      baseURL: "http://127.0.0.1:3000",
      routes: [{ id: "fixture", path: "/fixture", states }],
      themes: ["dark"],
      viewports: { mobile: { height: 844, width: 390 } },
    }),
  );
}

describe("loadScenario", () => {
  it("loads and freezes a valid default-exported scenario", async () => {
    const scenario = await loadScenario("./recording.mjs", {
      baseDirectory: scenarioBaseDirectory,
    });

    expect(scenario).toMatchObject({
      afterNavigate: expect.any(Function),
      beforeNavigate: expect.any(Function),
    });
    expect(scenario.assert).toBeUndefined();
    expect(Object.isFrozen(scenario)).toBe(true);
  });

  it("loads a TypeScript scenario authored against the public contract", async () => {
    const scenario = await loadScenario("./typed.ts", {
      baseDirectory: scenarioBaseDirectory,
    });

    expect(scenario.beforeNavigate).toEqual(expect.any(Function));
  });

  it("accepts an empty scenario object", async () => {
    await expect(
      loadScenario("./empty.mjs", { baseDirectory: scenarioBaseDirectory }),
    ).resolves.toEqual({
      afterNavigate: undefined,
      assert: undefined,
      beforeNavigate: undefined,
    });
  });

  it.each([
    ["./missing-default.mjs", "default-export an object"],
    ["./invalid-default.mjs", "default-export an object"],
    ["./invalid-hook.mjs", 'hook "beforeNavigate" must be a function'],
    ["./invalid-after-hook.mjs", 'hook "afterNavigate" must be a function'],
    ["./invalid-assert-hook.mjs", 'hook "assert" must be a function'],
  ])("rejects invalid scenario module %s", async (scenarioPath, message) => {
    await expect(
      loadScenario(scenarioPath, { baseDirectory: scenarioBaseDirectory }),
    ).rejects.toMatchObject({
      code: "invalid-module",
      message: expect.stringContaining(message),
      name: "ScenarioLoadError",
      scenarioPath,
    });
  });

  it.each(["./missing.mjs", "./throws.mjs"])(
    "wraps module import failure for %s",
    async (scenarioPath) => {
      const error = await loadScenario(scenarioPath, {
        baseDirectory: scenarioBaseDirectory,
      }).catch((reason: unknown) => reason);

      expect(error).toBeInstanceOf(ScenarioLoadError);
      expect(error).toMatchObject({
        code: "module-load-failed",
        scenarioPath,
      });
      expect((error as ScenarioLoadError).cause).toBeInstanceOf(Error);
    },
  );
});

describe("runScenarioLifecycle", () => {
  const context = Object.freeze({}) as ScenarioContext;

  it("runs hooks around caller-owned work with one context", async () => {
    const events: string[] = [];
    const scenario: StatecraftScenario = {
      async afterNavigate(received) {
        expect(received).toBe(context);
        events.push("after");
      },
      async beforeNavigate(received) {
        expect(received).toBe(context);
        events.push("before");
      },
    };

    const value = await runScenarioLifecycle(
      scenario,
      context,
      async (received) => {
        expect(received).toBe(context);
        events.push("execute");
        return "value";
      },
    );

    expect(value).toBe("value");
    expect(events).toEqual(["before", "execute", "after"]);
  });

  it("runs caller-owned work when optional hooks are absent", async () => {
    const events: string[] = [];

    const value = await runScenarioLifecycle({}, context, async (received) => {
      expect(received).toBe(context);
      events.push("execute");
      return "value";
    });

    expect(value).toBe("value");
    expect(events).toEqual(["execute"]);
  });

  it("stops after the first failing lifecycle step", async () => {
    const beforeEvents: string[] = [];
    await expect(
      runScenarioLifecycle(
        {
          async afterNavigate() {
            beforeEvents.push("after");
          },
          async beforeNavigate() {
            beforeEvents.push("before");
            throw new Error("before failed");
          },
        },
        context,
        async () => {
          beforeEvents.push("execute");
        },
      ),
    ).rejects.toThrow("before failed");
    expect(beforeEvents).toEqual(["before"]);

    const executeEvents: string[] = [];
    await expect(
      runScenarioLifecycle(
        {
          async afterNavigate() {
            executeEvents.push("after");
          },
        },
        context,
        async () => {
          executeEvents.push("execute");
          throw new Error("execute failed");
        },
      ),
    ).rejects.toThrow("execute failed");
    expect(executeEvents).toEqual(["execute"]);
  });

  it("propagates an afterNavigate failure", async () => {
    await expect(
      runScenarioLifecycle(
        {
          async afterNavigate() {
            throw new Error("after failed");
          },
        },
        context,
        async () => "value",
      ),
    ).rejects.toThrow("after failed");
  });
});

describe("runScenarioCells", () => {
  it("loads hooks per cell and runs them around the executor", async () => {
    const eventKey = Symbol.for("statecraft.test.scenario-events");
    const events: string[] = [];
    Reflect.set(globalThis, eventKey, events);
    const cwdRelativeScenario = path.relative(
      process.cwd(),
      path.join(scenarioBaseDirectory, "recording.mjs"),
    );
    const cells = scenarioCells([{ id: "ready", setup: cwdRelativeScenario }]);

    try {
      const outcomes = await runScenarioCells(
        cells,
        async (context) => {
          const { page, route, state, theme, viewport } = context;
          expect(Object.isFrozen(context)).toBe(true);
          expect(page.context()).toBe(context.context);
          expect(await page.evaluate(() => 1 + 1)).toBe(2);
          events.push(
            `execute:${route.id}:${state.id}:${viewport.width}:${theme}`,
          );
          return state.id;
        },
      );

      expect(outcomes).toEqual([
        { cell: cells[0], status: "fulfilled", value: "ready" },
      ]);
      expect(events).toEqual([
        "before:fixture:ready:390:dark",
        "execute:fixture:ready:390:dark",
        "after:fixture:ready:390:dark",
      ]);
    } finally {
      Reflect.deleteProperty(globalThis, eventKey);
    }
  });

  it("forwards browser launch options", async () => {
    const cells = scenarioCells([
      { id: "ready", setup: "./recording.mjs" },
    ]);

    await expect(
      runScenarioCells(cells, async ({ state }) => state.id, {
        launchOptions: { executablePath: missingBrowserExecutable },
        scenarioBaseDirectory,
      }),
    ).rejects.toThrow(/executable/i);
  });

  it("settles load and hook failures while later cells continue", async () => {
    const eventKey = Symbol.for("statecraft.test.scenario-events");
    const events: string[] = [];
    Reflect.set(globalThis, eventKey, events);
    const cells = scenarioCells([
      { id: "invalid", setup: "./invalid-hook.mjs" },
      { id: "before-failure", setup: "./recording.mjs" },
      { id: "after-failure", setup: "./recording.mjs" },
      { id: "ready", setup: "./recording.mjs" },
    ]);

    try {
      const outcomes = await runScenarioCells(
        cells,
        async ({ state }) => {
          events.push(`execute:${state.id}`);
          return state.id;
        },
        { scenarioBaseDirectory },
      );

      expect(outcomes.map((outcome) => outcome.status)).toEqual([
        "rejected",
        "rejected",
        "rejected",
        "fulfilled",
      ]);
      expect(
        outcomes[0]?.status === "rejected" && outcomes[0].reason,
      ).toBeInstanceOf(ScenarioLoadError);
      expect(
        outcomes[1]?.status === "rejected" ? outcomes[1].reason : undefined,
      ).toEqual(new Error("before hook failed"));
      expect(
        outcomes[2]?.status === "rejected" ? outcomes[2].reason : undefined,
      ).toEqual(new Error("after hook failed"));
      expect(outcomes[3]).toEqual({
        cell: cells[3],
        status: "fulfilled",
        value: "ready",
      });
      expect(events).toEqual([
        "before:fixture:before-failure:390:dark",
        "before:fixture:after-failure:390:dark",
        "execute:after-failure",
        "after:fixture:after-failure:390:dark",
        "before:fixture:ready:390:dark",
        "execute:ready",
        "after:fixture:ready:390:dark",
      ]);
    } finally {
      Reflect.deleteProperty(globalThis, eventKey);
    }
  });
});

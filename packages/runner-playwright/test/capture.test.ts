import http from "node:http";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { expandMatrix, parseConfig, type MatrixCell } from "uiwitness-core";

import {
  runCapturedScenarioCells,
  ScenarioCaptureError,
  type CapturedScenarioCell,
  type UIWitnessScenario,
} from "../src/index.js";
import { sanitizeDiagnosticText } from "../src/capture.js";

const scenarioBaseDirectory = fileURLToPath(
  new URL("./fixtures/scenarios/", import.meta.url),
);
const baseURL = "https://uiwitness.invalid/base/";
const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10];

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
    throw new Error("Capture redirect fixture did not bind a TCP port.");
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

function captureCells(states: readonly string[]): readonly MatrixCell[] {
  return expandMatrix(
    parseConfig({
      baseURL,
      routes: [
        {
          id: "capture",
          path: "/capture?source=statecraft#panel",
          states: states.map((id) => ({ id, setup: "./capture.mjs" })),
        },
      ],
      themes: ["light"],
      viewports: { compact: { height: 240, width: 320 } },
    }),
  );
}

function fulfilledValue(
  outcome: Awaited<ReturnType<typeof runCapturedScenarioCells>>[number],
): CapturedScenarioCell {
  expect(outcome.status).toBe("fulfilled");
  if (outcome.status !== "fulfilled") {
    throw new Error("Expected a fulfilled capture outcome.");
  }
  return outcome.value;
}

function captureReason(
  outcome: Awaited<ReturnType<typeof runCapturedScenarioCells>>[number],
): ScenarioCaptureError {
  expect(outcome.status).toBe("rejected");
  if (outcome.status !== "rejected") {
    throw new Error("Expected a rejected capture outcome.");
  }
  expect(outcome.reason).toBeInstanceOf(ScenarioCaptureError);
  return outcome.reason as ScenarioCaptureError;
}

describe("runCapturedScenarioCells", () => {
  it("captures viewport PNG bytes after readiness and then runs assertions", async () => {
    const eventKey = Symbol.for("statecraft.test.capture-events");
    const events: string[] = [];
    Reflect.set(globalThis, eventKey, events);

    try {
      const cells = captureCells(["ordered"]);
      const outcomes = await runCapturedScenarioCells(cells, {
        baseURL,
        scenarioBaseDirectory,
      });
      const capture = fulfilledValue(outcomes[0]!);
      const bytes = Buffer.from(capture.screenshot);

      expect([...bytes.subarray(0, 8)]).toEqual(pngSignature);
      expect(bytes.readUInt32BE(16)).toBe(320);
      expect(bytes.readUInt32BE(20)).toBe(240);
      expect(capture).toMatchObject({
        assertionStatus: "passed",
        diagnostics: {
          consoleErrors: [],
          failedRequests: [],
          navigationStatus: 206,
          pageErrors: [],
        },
        droppedDiagnostics: {
          consoleErrors: 0,
          failedRequests: 0,
          pageErrors: 0,
        },
        navigation: {
          requestedUrl:
            "https://uiwitness.invalid/capture?source=statecraft#panel",
          status: 206,
          url: "https://uiwitness.invalid/capture?source=statecraft#panel",
        },
      });
      expect(capture.durationMs).toBeGreaterThanOrEqual(0);
      expect(Number.isSafeInteger(capture.durationMs)).toBe(true);
      expect(events).toEqual(["screenshot", "assert:ordered"]);
    } finally {
      Reflect.deleteProperty(globalThis, eventKey);
    }
  });

  it("sanitizes console and request diagnostics without failing them by default", async () => {
    const eventKey = Symbol.for("statecraft.test.capture-events");
    Reflect.set(globalThis, eventKey, []);

    try {
      const outcomes = await runCapturedScenarioCells(captureCells(["nonfatal"]), {
        baseURL,
        scenarioBaseDirectory,
      });
      const capture = fulfilledValue(outcomes[0]!);

      expect(capture.diagnostics.consoleErrors).toEqual([
        "request https://uiwitness.invalid/private?token=%5BREDACTED%5D " +
          "Bearer [REDACTED] api_key=[REDACTED]",
        "Failed to load resource: net::ERR_FAILED",
      ]);
      expect(capture.diagnostics.failedRequests).toEqual([
        {
          errorText: "net::ERR_FAILED",
          method: "GET",
          url:
            "https://uiwitness.invalid/failed-resource?token=%5BREDACTED%5D&mode=%5BREDACTED%5D",
        },
      ]);
      expect(JSON.stringify(capture.diagnostics)).not.toMatch(
        /visible|bearer-value|plain-value|fragment/u,
      );
    } finally {
      Reflect.deleteProperty(globalThis, eventKey);
    }
  });

  it("applies page-error and assertion failures while preserving evidence and continuing", async () => {
    const eventKey = Symbol.for("statecraft.test.capture-events");
    Reflect.set(globalThis, eventKey, []);

    try {
      const cells = captureCells([
        "page-error",
        "assertion-fail",
        "screenshot-fail",
        "clean-after",
      ]);
      const outcomes = await runCapturedScenarioCells(cells, {
        baseURL,
        scenarioBaseDirectory,
      });

      expect(outcomes.map(({ status }) => status)).toEqual([
        "rejected",
        "rejected",
        "rejected",
        "fulfilled",
      ]);

      const pageError = captureReason(outcomes[0]!);
      expect(pageError.failures).toEqual([
        {
          code: "PAGE_ERROR",
          message: "1 page error(s) matched the failure policy.",
        },
      ]);
      expect(pageError.evidence.screenshot).not.toBeNull();
      expect(pageError.evidence.assertionStatus).toBe("passed");
      expect(pageError.evidence.diagnostics.pageErrors).toEqual([
        "page failed at https://uiwitness.invalid/private?secret=%5BREDACTED%5D token=[REDACTED]",
      ]);

      const assertionError = captureReason(outcomes[1]!);
      expect(assertionError.failures).toEqual([
        { code: "ASSERTION_FAILED", message: "assertion failed password=[REDACTED]" },
      ]);
      expect(assertionError.evidence.assertionStatus).toBe("failed");
      expect(assertionError.evidence.screenshot).not.toBeNull();
      expect((assertionError.cause as Error).message).toBe(
        "assertion failed password=[REDACTED]",
      );

      const screenshotError = captureReason(outcomes[2]!);
      expect(screenshotError.failures).toEqual([
        { code: "SCREENSHOT_FAILED", message: "screenshot failed token=[REDACTED]" },
      ]);
      expect(screenshotError.evidence.assertionStatus).toBe("not-run");
      expect(screenshotError.evidence.screenshot).toBeNull();
      expect((screenshotError.cause as Error).message).toBe(
        "screenshot failed token=[REDACTED]",
      );

      expect(fulfilledValue(outcomes[3]!).assertionStatus).toBe("passed");
    } finally {
      Reflect.deleteProperty(globalThis, eventKey);
    }
  });

  it("supports explicit diagnostic failure-policy overrides", async () => {
    const eventKey = Symbol.for("statecraft.test.capture-events");
    Reflect.set(globalThis, eventKey, []);

    try {
      const outcomes = await runCapturedScenarioCells(
        captureCells(["all-diagnostics"]),
        {
          baseURL,
          failOn: {
            consoleError: true,
            failedRequest: true,
            pageError: false,
          },
          scenarioBaseDirectory,
        },
      );
      const reason = captureReason(outcomes[0]!);

      expect(reason.failures.map(({ code }) => code)).toEqual([
        "CONSOLE_ERROR",
        "FAILED_REQUEST",
      ]);
      expect(reason.evidence.diagnostics.pageErrors).toHaveLength(1);
      expect(reason.evidence.assertionStatus).toBe("passed");
      expect(reason.evidence.screenshot).not.toBeNull();
    } finally {
      Reflect.deleteProperty(globalThis, eventKey);
    }
  });

  it("retains sanitized request evidence when navigation fails", async () => {
    const eventKey = Symbol.for("statecraft.test.capture-events");
    Reflect.set(globalThis, eventKey, []);

    try {
      const outcomes = await runCapturedScenarioCells(
        captureCells(["navigation-fail"]),
        {
          baseURL,
          failOn: { failedRequest: true },
          scenarioBaseDirectory,
        },
      );
      const reason = captureReason(outcomes[0]!);

      expect(reason.failures.map(({ code }) => code)).toEqual([
        "NAVIGATION_FAILED",
        "FAILED_REQUEST",
      ]);
      expect(reason.evidence).toMatchObject({
        assertionStatus: "not-run",
        navigation: null,
        screenshot: null,
      });
      expect(reason.evidence.diagnostics.failedRequests).toEqual([
        {
          errorText: "net::ERR_FAILED",
          method: "GET",
          url:
            "https://uiwitness.invalid/capture?source=%5BREDACTED%5D",
        },
      ]);
    } finally {
      Reflect.deleteProperty(globalThis, eventKey);
    }
  });

  it("discards a screenshot when an assertion replaces the main document", async () => {
    const scenario: UIWitnessScenario = {
      async beforeNavigate({ page }) {
        await page.route("**/*", async (route) => {
          await route.fulfill({
            body: "<!doctype html><html><body>fixture</body></html>",
            contentType: "text/html",
            status: 200,
          });
        });
      },
      async assert({ page }) {
        await page.goto(
          "https://outside.invalid/private?token=visible#fragment",
        );
      },
    };

    const outcomes = await runCapturedScenarioCells(
      captureCells(["clean-after"]),
      { baseURL, scenario },
    );
    const reason = captureReason(outcomes[0]!);

    expect(reason.failures).toEqual([
      {
        code: "NAVIGATION_FAILED",
        message:
          "Navigation must stay on the configured origin (received https://outside.invalid/).",
      },
    ]);
    expect(reason.evidence.assertionStatus).toBe("passed");
    expect(reason.evidence.screenshot).toBeNull();
    expect(JSON.stringify(reason.evidence)).not.toContain("replacement");
    expect(JSON.stringify(reason)).not.toMatch(/visible|private/u);
  });

  it("retains response metadata when a post-navigation hook fails", async () => {
    const eventKey = Symbol.for("statecraft.test.capture-events");
    Reflect.set(globalThis, eventKey, []);

    try {
      const outcomes = await runCapturedScenarioCells(
        captureCells(["post-response-fail"]),
        { baseURL, scenarioBaseDirectory },
      );
      const reason = captureReason(outcomes[0]!);

      expect(reason.failures).toEqual([
        {
          code: "NAVIGATION_FAILED",
          message: "after navigation failed token=[REDACTED]",
        },
      ]);
      expect(reason.evidence.navigation).toEqual({
        requestedUrl:
          "https://uiwitness.invalid/capture?source=statecraft#panel",
        status: 206,
        url: "https://uiwitness.invalid/capture?source=statecraft#panel",
      });
      expect(reason.evidence.diagnostics.navigationStatus).toBe(206);
      expect((reason.cause as Error).message).not.toContain("visible");
    } finally {
      Reflect.deleteProperty(globalThis, eventKey);
    }
  });

  it("retains redirect status without exposing a cross-origin URL", async () => {
    const eventKey = Symbol.for("statecraft.test.capture-events");
    const redirectOriginKey = Symbol.for(
      "statecraft.test.capture-redirect-origin",
    );
    const redirectServer = await localOrigin();
    Reflect.set(globalThis, eventKey, []);
    Reflect.set(globalThis, redirectOriginKey, redirectServer.origin);

    try {
      const outcomes = await runCapturedScenarioCells(
        captureCells(["redirect-cross-origin"]),
        { baseURL, scenarioBaseDirectory },
      );
      const reason = captureReason(outcomes[0]!);

      expect(reason.failures[0]?.code).toBe("NAVIGATION_FAILED");
      expect(reason.evidence.navigation).toBeNull();
      expect(reason.evidence.diagnostics.navigationStatus).toBe(200);
      expect(JSON.stringify(reason.evidence)).not.toMatch(
        /private|visible|fragment|127\.0\.0\.1/u,
      );
    } finally {
      Reflect.deleteProperty(globalThis, eventKey);
      Reflect.deleteProperty(globalThis, redirectOriginKey);
      await redirectServer.close();
    }
  });

  it("wraps route and scenario setup failures and continues", async () => {
    const eventKey = Symbol.for("statecraft.test.capture-events");
    Reflect.set(globalThis, eventKey, []);
    const configured = captureCells(["clean-after"]);
    const invalidRoute = {
      ...configured[0]!,
      route: { ...configured[0]!.route, path: "//outside.invalid/capture" },
    };
    const invalidScenario = {
      ...configured[0]!,
      state: {
        ...configured[0]!.state,
        id: "invalid-scenario",
        setup: "./invalid-hook.mjs",
      },
    };

    try {
      const outcomes = await runCapturedScenarioCells(
        [invalidRoute, invalidScenario, configured[0]!],
        { baseURL, scenarioBaseDirectory },
      );

      expect(outcomes.map(({ status }) => status)).toEqual([
        "rejected",
        "rejected",
        "fulfilled",
      ]);
      expect(captureReason(outcomes[0]!).failures[0]?.code).toBe(
        "NAVIGATION_FAILED",
      );
      expect(captureReason(outcomes[1]!).failures[0]?.code).toBe(
        "INTERNAL_ERROR",
      );
      expect(fulfilledValue(outcomes[2]!).assertionStatus).toBe("passed");
    } finally {
      Reflect.deleteProperty(globalThis, eventKey);
    }
  });

  it("caps noisy diagnostic categories and reports dropped entries", async () => {
    const eventKey = Symbol.for("statecraft.test.capture-events");
    Reflect.set(globalThis, eventKey, []);

    try {
      const outcomes = await runCapturedScenarioCells(
        captureCells(["diagnostic-burst"]),
        {
          baseURL,
          failOn: { consoleError: true },
          scenarioBaseDirectory,
        },
      );
      const reason = captureReason(outcomes[0]!);

      expect(reason.evidence.diagnostics.consoleErrors).toHaveLength(100);
      expect(reason.evidence.diagnostics.consoleErrors[0]).toBe("diagnostic 0");
      expect(reason.evidence.diagnostics.consoleErrors[99]).toBe(
        "diagnostic 99",
      );
      expect(reason.evidence.droppedDiagnostics.consoleErrors).toBe(5);
      expect(reason.failures).toEqual([
        {
          code: "CONSOLE_ERROR",
          message: "105 console error(s) matched the failure policy.",
        },
      ]);
    } finally {
      Reflect.deleteProperty(globalThis, eventKey);
    }
  });

  it("caps failed requests before sanitizing later entries", async () => {
    const eventKey = Symbol.for("statecraft.test.capture-events");
    Reflect.set(globalThis, eventKey, []);

    try {
      const outcomes = await runCapturedScenarioCells(
        captureCells(["failed-request-burst"]),
        { baseURL, scenarioBaseDirectory },
      );
      const capture = fulfilledValue(outcomes[0]!);

      expect(capture.diagnostics.failedRequests).toHaveLength(100);
      expect(capture.droppedDiagnostics.failedRequests).toBe(5);
    } finally {
      Reflect.deleteProperty(globalThis, eventKey);
    }
  });

  it("wraps unprintable assertion values without escaping the error contract", async () => {
    const eventKey = Symbol.for("statecraft.test.capture-events");
    Reflect.set(globalThis, eventKey, []);

    try {
      const outcomes = await runCapturedScenarioCells(
        captureCells(["assertion-unprintable"]),
        { baseURL, scenarioBaseDirectory },
      );
      const reason = captureReason(outcomes[0]!);

      expect(reason.failures).toEqual([
        {
          code: "ASSERTION_FAILED",
          message: "[unprintable thrown value]",
        },
      ]);
      expect((reason.cause as Error).message).toBe(
        "[unprintable thrown value]",
      );
    } finally {
      Reflect.deleteProperty(globalThis, eventKey);
    }
  });

  it("reports an absent scenario assertion without inventing a failure", async () => {
    const eventKey = Symbol.for("statecraft.test.navigation-events");
    Reflect.set(globalThis, eventKey, []);
    const cells = expandMatrix(
      parseConfig({
        baseURL,
        routes: [
          {
            id: "fixture",
            path: "/fixture",
            states: [{ id: "ready", setup: "./navigation.mjs" }],
          },
        ],
        themes: ["light"],
        viewports: { compact: { height: 240, width: 320 } },
      }),
    );

    try {
      const outcomes = await runCapturedScenarioCells(cells, {
        baseURL,
        scenarioBaseDirectory,
      });
      expect(fulfilledValue(outcomes[0]!).assertionStatus).toBe(
        "not-configured",
      );
    } finally {
      Reflect.deleteProperty(globalThis, eventKey);
    }
  });

  it("validates failure policies before launching a browser", async () => {
    await expect(
      runCapturedScenarioCells([], {
        baseURL,
        failOn: { consoleError: "yes" } as never,
        scenarioBaseDirectory,
      }),
    ).rejects.toThrow("failOn.consoleError must be a boolean.");
  });
});

describe("diagnostic sanitization", () => {
  it("removes URL credentials, fragments, query values, and named secrets", () => {
    expect(
      sanitizeDiagnosticText(
        [
          "https://",
          "user",
          ":",
          "pass",
          "@uiwitness.invalid/private?token=visible&empty=#fragment ",
        ].join("") +
          "Bearer auth-value api_key=plain-value",
      ),
    ).toBe(
      "https://uiwitness.invalid/private?token=%5BREDACTED%5D " +
        "Bearer [REDACTED] api_key=[REDACTED]",
    );
    expect(sanitizeDiagnosticText("Authorization: Basic dXNlcjpwYXNz")).toBe(
      "authorization: [REDACTED]",
    );
    expect(
      sanitizeDiagnosticText(
        "Authorization: AWS4-HMAC-SHA256 Credential=value, SignedHeaders=host, Signature=secret",
      ),
    ).toBe("authorization: [REDACTED]");
    expect(
      sanitizeDiagnosticText("Cookie: session=secret; preference=private"),
    ).toBe("Cookie: [REDACTED]");
    expect(
      sanitizeDiagnosticText(
        "Route escaped to //outside.invalid/private?return=visible#fragment.",
      ),
    ).toBe(
      "Route escaped to //outside.invalid/private?return=%5BREDACTED%5D.",
    );
  });

  it("caps untrusted diagnostic strings", () => {
    expect(sanitizeDiagnosticText("x".repeat(2_100))).toHaveLength(2_000);
    expect(sanitizeDiagnosticText("   ")).toBe("[empty diagnostic]");
  });
});

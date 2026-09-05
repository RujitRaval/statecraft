import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import type { Browser, BrowserContext } from "playwright";
import { afterEach, describe, expect, it, vi } from "vitest";

import { expandMatrix, parseConfig } from "uiwitness-core";
import {
  AuthenticationError,
  runExecutionCells,
} from "../src/index.js";
import { prepareAuthenticationState } from "../src/authentication.js";
import { createCellBrowserContext } from "../src/lifecycle.js";

const fixtureDirectory = dirname(fileURLToPath(import.meta.url));
const secret = "UIWITNESS_SECRET_CANARY_6a445b";
const counterKey = Symbol.for("uiwitness.test.authSetupCount");
const cells = expandMatrix(parseConfig({
  baseURL: "https://uiwitness.invalid",
  routes: [{
    id: "fixture",
    path: "/fixture",
    states: [{ id: "ready", setup: "./fixtures/ready.ts" }],
  }],
  themes: ["light"],
  viewports: {
    desktop: { height: 720, width: 1_280 },
    mobile: { height: 844, width: 390 },
  },
}));

function credentialedURL(value: string): string {
  const url = new URL(value);
  url.username = "test-user";
  url.password = "test-password";
  return url.href;
}

afterEach(() => {
  delete process.env["UIWITNESS_AUTH_SECRET_CANARY"];
  delete (globalThis as Record<symbol, unknown>)[counterKey];
});

describe("memory-only authentication lifecycle", () => {
  it("rejects credentialed programmatic base URLs before browser work", async () => {
    const browser = {
      newContext: vi.fn(),
    } as unknown as Browser;

    const error = await prepareAuthenticationState(browser, {
      baseURL: credentialedURL("https://uiwitness.invalid"),
      config: { setup: "./fixtures/auth-noop.mjs" },
      setupBaseDirectory: fixtureDirectory,
    }).catch((reason: unknown) => reason);

    expect(error).toMatchObject({ code: "AUTH_SETUP_INVALID" });
    expect(browser.newContext).not.toHaveBeenCalled();
    expect(String(error)).not.toContain("user:secret");
  });

  it("keeps browser-context auth seeding failures opaque", async () => {
    const browser = {
      newContext: vi.fn(async () => {
        throw new Error(secret);
      }),
    } as unknown as Browser;

    const error = await createCellBrowserContext(
      browser,
      cells[0]!,
      {
        cookies: [{
          domain: "uiwitness.invalid",
          expires: -1,
          httpOnly: true,
          name: "session",
          path: "/",
          sameSite: "Lax",
          secure: true,
          value: secret,
        }],
        origins: [],
      },
      "./fixtures/auth-noop.mjs",
    ).catch((reason: unknown) => reason);

    expect(error).toMatchObject({ code: "AUTH_SETUP_FAILED" });
    expect(String(error)).not.toContain(secret);
  });

  it("closes the setup context and fails opaquely when cleanup is unsafe", async () => {
    const close = vi.fn(async () => {
      throw new Error(secret);
    });
    const context = {
      close,
      newPage: vi.fn(async () => ({})),
      storageState: vi.fn(async () => ({ cookies: [], origins: [] })),
    } as unknown as BrowserContext;
    const browser = {
      newContext: vi.fn(async () => context),
    } as unknown as Browser;

    const error = await prepareAuthenticationState(browser, {
      baseURL: "https://uiwitness.invalid",
      config: { setup: "./fixtures/auth-noop.mjs" },
      setupBaseDirectory: fixtureDirectory,
    }).catch((reason: unknown) => reason);

    expect(close).toHaveBeenCalledOnce();
    expect(error).toMatchObject({ code: "AUTH_SETUP_FAILED" });
    expect(String(error)).not.toContain(secret);
  });

  it("logs in once and deep-copies state into every fresh isolated cell", async () => {
    process.env["UIWITNESS_AUTH_SECRET_CANARY"] = secret;
    const outcomes = await runExecutionCells(cells, async ({ context }) => {
      const cookies = await context.cookies("https://uiwitness.invalid");
      const page = await context.newPage();
      await page.route("https://uiwitness.invalid/**", (route) =>
        route.fulfill({ body: "<main>cell</main>", contentType: "text/html" })
      );
      await page.goto("https://uiwitness.invalid/fixture");
      const stored = await page.evaluate(() => localStorage.getItem("uiwitness-auth"));
      await context.addCookies([{
        name: "cell-only",
        url: "https://uiwitness.invalid",
        value: "mutated",
      }]);
      return {
        authCookie: cookies.find((cookie) => cookie.name === "uiwitness-auth")?.value,
        cellCookieCount: cookies.filter((cookie) => cookie.name === "cell-only").length,
        stored,
      };
    }, {
      authentication: {
        baseURL: "https://uiwitness.invalid",
        config: { mode: "shared-readonly", setup: "./fixtures/auth-success.mjs" },
        setupBaseDirectory: fixtureDirectory,
      },
    });

    expect((globalThis as Record<symbol, unknown>)[counterKey]).toBe(1);
    expect(outcomes).toHaveLength(2);
    for (const outcome of outcomes) {
      expect(outcome.status).toBe("fulfilled");
      if (outcome.status === "fulfilled") {
        expect(outcome.value).toEqual({
          authCookie: secret,
          cellCookieCount: 0,
          stored: secret,
        });
      }
    }
  });

  it.each([
    ["AUTH_SETUP_INVALID", "./fixtures/auth-invalid.mjs"],
    ["AUTH_SETUP_INVALID", "./fixtures/auth-returns.mjs"],
    ["AUTH_SETUP_FAILED", "./fixtures/auth-throws.mjs"],
    ["AUTH_ORIGIN_NOT_ALLOWED", "./fixtures/auth-origin-outside-scope.mjs"],
  ] as const)("fails the whole run opaquely with %s", async (code, setup) => {
    process.env["UIWITNESS_AUTH_SECRET_CANARY"] = secret;

    const error = await runExecutionCells(cells, async () => "unreachable", {
      authentication: {
        baseURL: "https://uiwitness.invalid",
        config: { setup },
        setupBaseDirectory: fixtureDirectory,
      },
    }).catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(AuthenticationError);
    expect(error).toMatchObject({ code, setupPath: setup });
    expect(String(error)).not.toContain(secret);
  });
});

import type { Browser, BrowserContext, Page } from "playwright";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { expandMatrix, parseConfig } from "uiwitness-core";

const playwrightMocks = vi.hoisted(() => ({
  launch: vi.fn(),
}));

vi.mock("playwright", async (importOriginal) => {
  const actual = await importOriginal<typeof import("playwright")>();
  return {
    ...actual,
    chromium: {
      ...actual.chromium,
      launch: playwrightMocks.launch,
    },
  };
});

import { runExecutionCells } from "../src/index.js";

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

interface ControlledContext {
  readonly close: ReturnType<typeof vi.fn>;
  readonly context: BrowserContext;
}

interface ControlledBrowser {
  readonly browser: Browser;
  readonly close: ReturnType<typeof vi.fn>;
  readonly newContext: ReturnType<typeof vi.fn>;
}

function controlledContext({
  closeError,
  pageError,
}: {
  readonly closeError?: Error;
  readonly pageError?: Error;
} = {}): ControlledContext {
  const close = vi.fn(async () => {
    if (closeError !== undefined) {
      throw closeError;
    }
  });
  const newPage = vi.fn(async () => {
    if (pageError !== undefined) {
      throw pageError;
    }
    return {} as Page;
  });

  return {
    close,
    context: { close, newPage } as unknown as BrowserContext,
  };
}

function controlledBrowser(
  sequence: readonly (BrowserContext | Error)[],
  closeError?: Error,
): ControlledBrowser {
  const remaining = [...sequence];
  const close = vi.fn(async () => {
    if (closeError !== undefined) {
      throw closeError;
    }
  });
  const newContext = vi.fn(async () => {
    const next = remaining.shift();
    if (next instanceof Error) {
      throw next;
    }
    if (next === undefined) {
      throw new Error("No controlled context remains.");
    }
    return next;
  });

  return {
    browser: { close, newContext } as unknown as Browser,
    close,
    newContext,
  };
}

describe("runExecutionCells error lifecycle", () => {
  beforeEach(() => {
    playwrightMocks.launch.mockReset();
  });

  it("settles context and page setup failures before continuing", async () => {
    const contextSetupError = new Error("context setup failed");
    const pageSetupError = new Error("page setup failed");
    const pageFailureContext = controlledContext({ pageError: pageSetupError });
    const successContext = controlledContext();
    const browser = controlledBrowser([
      contextSetupError,
      pageFailureContext.context,
      successContext.context,
    ]);
    playwrightMocks.launch.mockResolvedValue(browser.browser);
    const visited: string[] = [];

    const outcomes = await runExecutionCells(
      [cells[0]!, cells[1]!, cells[0]!],
      async ({ cell }) => {
        visited.push(cell.viewportId);
        return cell.viewportId;
      },
    );

    expect(outcomes.map((outcome) => outcome.status)).toEqual([
      "rejected",
      "rejected",
      "fulfilled",
    ]);
    expect(outcomes[0]).toMatchObject({ reason: contextSetupError });
    expect(outcomes[1]).toMatchObject({ reason: pageSetupError });
    expect(visited).toEqual(["desktop"]);
    expect(pageFailureContext.close).toHaveBeenCalledOnce();
    expect(successContext.close).toHaveBeenCalledOnce();
    expect(browser.close).toHaveBeenCalledOnce();
  });

  it("replaces a browser after context cleanup fails and continues", async () => {
    const cleanupError = new Error("context cleanup failed");
    const launchOptions = { headless: true } as const;
    const failedCleanupContext = controlledContext({ closeError: cleanupError });
    const successContext = controlledContext();
    const compromisedBrowser = controlledBrowser([failedCleanupContext.context]);
    const replacementBrowser = controlledBrowser([successContext.context]);
    playwrightMocks.launch
      .mockResolvedValueOnce(compromisedBrowser.browser)
      .mockResolvedValueOnce(replacementBrowser.browser);

    const outcomes = await runExecutionCells(
      cells,
      async ({ cell }) => cell.viewportId,
      { launchOptions },
    );

    expect(outcomes[0]).toMatchObject({
      reason: cleanupError,
      status: "rejected",
    });
    expect(outcomes[1]).toEqual({
      cell: cells[1],
      status: "fulfilled",
      value: "mobile",
    });
    expect(failedCleanupContext.close).toHaveBeenCalledOnce();
    expect(successContext.close).toHaveBeenCalledOnce();
    expect(compromisedBrowser.close).toHaveBeenCalledOnce();
    expect(replacementBrowser.close).toHaveBeenCalledOnce();
    expect(playwrightMocks.launch).toHaveBeenCalledTimes(2);
    expect(playwrightMocks.launch).toHaveBeenNthCalledWith(1, launchOptions);
    expect(playwrightMocks.launch).toHaveBeenNthCalledWith(2, launchOptions);
  });

  it("preserves callback and cleanup errors while continuing", async () => {
    const callbackError = new Error("callback failed");
    const cleanupError = new Error("cleanup also failed");
    const failedContext = controlledContext({ closeError: cleanupError });
    const successContext = controlledContext();
    const compromisedBrowser = controlledBrowser([failedContext.context]);
    const replacementBrowser = controlledBrowser([successContext.context]);
    playwrightMocks.launch
      .mockResolvedValueOnce(compromisedBrowser.browser)
      .mockResolvedValueOnce(replacementBrowser.browser);

    const outcomes = await runExecutionCells(cells, async ({ cell }) => {
      if (cell.viewportId === "desktop") {
        throw callbackError;
      }
      return cell.viewportId;
    });

    expect(outcomes[0]?.status).toBe("rejected");
    const reason =
      outcomes[0]?.status === "rejected" ? outcomes[0].reason : undefined;
    expect(reason).toBeInstanceOf(AggregateError);
    expect((reason as AggregateError).errors).toEqual([
      callbackError,
      cleanupError,
    ]);
    expect(outcomes[1]?.status).toBe("fulfilled");
    expect(failedContext.close).toHaveBeenCalledOnce();
    expect(compromisedBrowser.close).toHaveBeenCalledOnce();
    expect(replacementBrowser.close).toHaveBeenCalledOnce();
  });

  it("rejects the run when a compromised browser cannot close", async () => {
    const contextCleanupError = new Error("context cleanup failed");
    const browserCleanupError = new Error("compromised browser cleanup failed");
    const failedContext = controlledContext({ closeError: contextCleanupError });
    const compromisedBrowser = controlledBrowser(
      [failedContext.context],
      browserCleanupError,
    );
    playwrightMocks.launch.mockResolvedValue(compromisedBrowser.browser);

    await expect(
      runExecutionCells(cells, async ({ cell }) => cell.viewportId),
    ).rejects.toBe(browserCleanupError);

    expect(compromisedBrowser.close).toHaveBeenCalledOnce();
    expect(playwrightMocks.launch).toHaveBeenCalledOnce();
  });

  it("rejects the run when a replacement browser cannot launch", async () => {
    const contextCleanupError = new Error("context cleanup failed");
    const replacementError = new Error("replacement launch failed");
    const failedContext = controlledContext({ closeError: contextCleanupError });
    const compromisedBrowser = controlledBrowser([failedContext.context]);
    playwrightMocks.launch
      .mockResolvedValueOnce(compromisedBrowser.browser)
      .mockRejectedValueOnce(replacementError);

    await expect(
      runExecutionCells(cells, async ({ cell }) => cell.viewportId),
    ).rejects.toBe(replacementError);

    expect(compromisedBrowser.close).toHaveBeenCalledOnce();
    expect(playwrightMocks.launch).toHaveBeenCalledTimes(2);
  });

  it("closes without replacement when the final cell cleanup fails", async () => {
    const contextCleanupError = new Error("final context cleanup failed");
    const failedContext = controlledContext({ closeError: contextCleanupError });
    const compromisedBrowser = controlledBrowser([failedContext.context]);
    playwrightMocks.launch.mockResolvedValue(compromisedBrowser.browser);

    const outcomes = await runExecutionCells(
      cells.slice(0, 1),
      async ({ cell }) => cell.viewportId,
    );

    expect(outcomes).toEqual([
      {
        cell: cells[0],
        reason: contextCleanupError,
        status: "rejected",
      },
    ]);
    expect(failedContext.close).toHaveBeenCalledOnce();
    expect(compromisedBrowser.close).toHaveBeenCalledOnce();
    expect(playwrightMocks.launch).toHaveBeenCalledOnce();
  });

  it("rejects the run when final browser cleanup fails", async () => {
    const browserCloseError = new Error("browser cleanup failed");
    const context = controlledContext();
    const browser = controlledBrowser([context.context], browserCloseError);
    playwrightMocks.launch.mockResolvedValue(browser.browser);
    const visited: string[] = [];

    await expect(
      runExecutionCells(cells.slice(0, 1), async ({ cell }) => {
        visited.push(cell.viewportId);
        return cell.viewportId;
      }),
    ).rejects.toBe(browserCloseError);

    expect(visited).toEqual(["desktop"]);
    expect(context.close).toHaveBeenCalledOnce();
    expect(browser.close).toHaveBeenCalledOnce();
  });
});

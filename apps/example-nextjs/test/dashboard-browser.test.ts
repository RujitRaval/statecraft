import { spawn, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createServer } from "node:net";
import { dirname, resolve } from "node:path";

import { chromium, type Browser } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const appDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let baseURL = "";
let browser: Browser;
let server: ChildProcess;

async function availablePort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      if (address === null || typeof address === "string") {
        reject(new Error("Could not allocate a local test port."));
        return;
      }
      probe.close((error) => error === undefined ? resolvePort(address.port) : reject(error));
    });
  });
}

async function waitForServer(url: string): Promise<void> {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // The production server is still starting.
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 100));
  }
  throw new Error(`Example application did not start at ${url}.`);
}

beforeAll(async () => {
  const port = await availablePort();
  baseURL = `http://127.0.0.1:${port}`;
  const nextBinary = fileURLToPath(import.meta.resolve("next/dist/bin/next"));
  server = spawn(process.execPath, [nextBinary, "start", "--hostname", "127.0.0.1", "--port", String(port)], {
    cwd: appDirectory,
    stdio: "ignore",
  });
  await waitForServer(`${baseURL}/api/dashboard`);
  browser = await chromium.launch({ headless: true });
}, 30_000);

afterAll(async () => {
  await browser?.close();
  server?.kill("SIGTERM");
});

describe("example dashboard states", () => {
  it("renders deterministic success content without page or console errors", async () => {
    const page = await browser.newPage({ viewport: { height: 1_000, width: 1_440 } });
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${baseURL}/dashboard`, { waitUntil: "domcontentloaded" });
    await page.locator('[data-dashboard-state="success"]').waitFor();

    expect(await page.getByRole("heading", { name: "Good afternoon, Mara." }).isVisible()).toBe(true);
    expect(await page.getByText("$284,912").isVisible()).toBe(true);
    expect(await page.getByRole("row").count()).toBe(5);
    expect(errors).toEqual([]);
    await page.close();
  });

  it("keeps loading, empty, and error states deliberate and recoverable", async () => {
    const loadingPage = await browser.newPage();
    await loadingPage.route("**/api/dashboard", () => new Promise(() => undefined));
    await loadingPage.goto(`${baseURL}/dashboard`, { waitUntil: "domcontentloaded" });
    expect(await loadingPage.locator('[data-dashboard-state="loading"]').isVisible()).toBe(true);
    await loadingPage.close();

    const emptyPage = await browser.newPage();
    await emptyPage.route("**/api/dashboard", (route) => route.fulfill({
      body: JSON.stringify({
        metrics: [],
        orders: [],
        pulse: [],
        summary: { atRisk: 0, fulfilledToday: 0, nextDispatch: "Not scheduled" },
      }),
      contentType: "application/json",
      status: 200,
    }));
    await emptyPage.goto(`${baseURL}/dashboard`, { waitUntil: "domcontentloaded" });
    await emptyPage.locator('[data-dashboard-state="empty"]').waitFor();
    expect(await emptyPage.getByRole("heading", { name: "No operations data yet." }).isVisible()).toBe(true);
    await emptyPage.close();

    const errorPage = await browser.newPage();
    await errorPage.route("**/api/dashboard", (route) => route.fulfill({
      body: JSON.stringify({ message: "Unavailable" }),
      contentType: "application/json",
      status: 503,
    }));
    await errorPage.goto(`${baseURL}/dashboard`, { waitUntil: "domcontentloaded" });
    await errorPage.locator('[data-dashboard-state="error"]').waitFor();
    expect(await errorPage.getByRole("heading", { name: "Operations data is out of reach." }).isVisible()).toBe(true);
    expect(await errorPage.getByRole("button", { name: /Try again/ }).isVisible()).toBe(true);
    await errorPage.close();
  });

  it("uses the runner theme contract and avoids mobile horizontal overflow", async () => {
    const page = await browser.newPage({ viewport: { height: 844, width: 390 } });
    await page.addInitScript(() => {
      const apply = (): boolean => {
        if (document.documentElement === null) return false;
        document.documentElement.dataset["theme"] = "dark";
        return true;
      };
      if (!apply()) {
        const observer = new MutationObserver(() => {
          if (apply()) observer.disconnect();
        });
        observer.observe(document, { childList: true, subtree: true });
      }
    });
    await page.goto(`${baseURL}/dashboard`, { waitUntil: "domcontentloaded" });
    await page.locator('[data-dashboard-state="success"]').waitFor();

    expect(await page.locator("html").getAttribute("data-theme")).toBe("dark");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    expect(
      await page.getByRole("banner").getByText("Northline", { exact: true }).isVisible(),
    ).toBe(true);
    await page.close();
  });
});

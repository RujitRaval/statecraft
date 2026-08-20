import { spawn, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createServer } from "node:net";
import { dirname, resolve } from "node:path";

import { chromium, type Browser } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { dashboardData } from "../lib/dashboard";
import { ordersData } from "../lib/orders";

const appDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let baseURL = "";
let browser: Browser;
let server: ChildProcess;
let serverExit: Promise<void>;

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

async function waitForServerShutdown(url: string): Promise<void> {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    try {
      await fetch(url);
    } catch {
      return;
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 50));
  }
  throw new Error(`Example application remained available at ${url} after termination.`);
}

beforeAll(async () => {
  const port = await availablePort();
  baseURL = `http://127.0.0.1:${port}`;
  const nextWrapper = resolve(appDirectory, "scripts", "next.mjs");
  server = spawn(process.execPath, [nextWrapper, "start", "--hostname", "127.0.0.1", "--port", String(port)], {
    cwd: appDirectory,
    stdio: "ignore",
  });
  serverExit = new Promise<void>((resolveExit) => server.once("exit", () => resolveExit()));
  await waitForServer(`${baseURL}/api/dashboard`);
  browser = await chromium.launch({ headless: true });
}, 30_000);

afterAll(async () => {
  await browser?.close();
  if (server !== undefined) {
    if (server.exitCode === null && server.signalCode === null) server.kill("SIGTERM");
    await serverExit;
    await waitForServerShutdown(`${baseURL}/api/dashboard`);
  }
});

describe("example application states", () => {
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
    const errors: string[] = [];
    let releaseSuccess = (): void => undefined;
    const successGate = new Promise<void>((resolveSuccess) => {
      releaseSuccess = resolveSuccess;
    });
    let requestCount = 0;
    errorPage.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    errorPage.on("pageerror", (error) => errors.push(error.message));
    await errorPage.route("**/api/dashboard", async (route) => {
      requestCount += 1;
      if (requestCount === 1) {
        await route.fulfill({
          body: JSON.stringify({ message: "Unavailable" }),
          contentType: "application/json",
          status: 503,
        });
        return;
      }
      await successGate;
      await route.fulfill({
        body: JSON.stringify(dashboardData),
        contentType: "application/json",
        status: 200,
      });
    });
    await errorPage.goto(`${baseURL}/dashboard`, { waitUntil: "domcontentloaded" });
    await errorPage.locator('[data-dashboard-state="error"]').waitFor();
    expect(await errorPage.getByRole("heading", { name: "Operations data is out of reach." }).isVisible()).toBe(true);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("503");
    const expectedErrorCount = errors.length;
    await errorPage.getByRole("button", { name: /Try again/ }).click();
    await errorPage.locator('[data-dashboard-state="loading"]').waitFor();
    releaseSuccess();
    await errorPage.locator('[data-dashboard-state="success"]').waitFor();
    expect(requestCount).toBe(2);
    expect(errors).toHaveLength(expectedErrorCount);
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

  it("renders the order queue and keeps its filters usable and URL-restorable", async () => {
    const page = await browser.newPage({ viewport: { height: 1_000, width: 1_440 } });
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${baseURL}/orders`, { waitUntil: "domcontentloaded" });
    await page.locator('[data-orders-state="success"]').waitFor();

    expect(await page.getByRole("heading", { name: "Orders in motion." }).isVisible()).toBe(true);
    expect(await page.getByRole("link", { name: /Orders/ }).first().getAttribute("aria-current")).toBe("page");
    expect(await page.getByRole("table", { name: "Fulfillment order queue" }).getByRole("row").count()).toBe(9);

    await page.getByRole("button", { name: "At risk" }).click();
    expect(await page.getByRole("table", { name: "Fulfillment order queue" }).getByRole("row").count()).toBe(3);
    expect(await page.locator(".orders-summary > div").first().locator("strong").textContent()).toBe("2");
    expect(await page.locator(".orders-summary > div").nth(2).locator("strong").textContent()).toBe("0");
    expect(new URL(page.url()).searchParams.get("status")).toBe("At risk");

    await page.getByRole("button", { name: "All" }).click();
    await page.getByRole("searchbox", { name: "Search orders" }).fill("Boston");
    expect(await page.getByRole("table", { name: "Fulfillment order queue" }).getByRole("row").count()).toBe(2);
    expect(new URL(page.url()).searchParams.get("q")).toBe("Boston");

    await page.goto(`${baseURL}/orders?status=At+risk&q=Harbor`, { waitUntil: "domcontentloaded" });
    await page.getByText("Showing 1 of 8 orders").waitFor();
    expect(await page.getByRole("button", { name: "At risk" }).getAttribute("aria-pressed")).toBe("true");
    expect(await page.getByRole("searchbox", { name: "Search orders" }).inputValue()).toBe("Harbor");

    await page.getByRole("searchbox", { name: "Search orders" }).fill("No such order");
    expect(await page.getByRole("heading", { name: "No orders match this view." }).isVisible()).toBe(true);
    await page.getByRole("button", { name: /Clear filters/ }).click();
    expect(await page.getByRole("table", { name: "Fulfillment order queue" }).getByRole("row").count()).toBe(9);
    expect(errors).toEqual([]);
    await page.close();
  });

  it("keeps order loading, empty, and error states deliberate and recoverable", async () => {
    const loadingPage = await browser.newPage();
    await loadingPage.route("**/api/orders", () => new Promise(() => undefined));
    await loadingPage.goto(`${baseURL}/orders`, { waitUntil: "domcontentloaded" });
    expect(await loadingPage.locator('[data-orders-state="loading"]').isVisible()).toBe(true);
    await loadingPage.close();

    const emptyPage = await browser.newPage();
    await emptyPage.route("**/api/orders", (route) => route.fulfill({
      body: JSON.stringify({ orders: [], updatedAt: "20 Aug 2026 · 14:32 EDT" }),
      contentType: "application/json",
      status: 200,
    }));
    await emptyPage.goto(`${baseURL}/orders`, { waitUntil: "domcontentloaded" });
    await emptyPage.locator('[data-orders-state="empty"]').waitFor();
    expect(await emptyPage.getByRole("heading", { name: "No orders are waiting." }).isVisible()).toBe(true);
    await emptyPage.close();

    const errorPage = await browser.newPage();
    const errors: string[] = [];
    let releaseSuccess = (): void => undefined;
    const successGate = new Promise<void>((resolveSuccess) => {
      releaseSuccess = resolveSuccess;
    });
    let requestCount = 0;
    errorPage.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    errorPage.on("pageerror", (error) => errors.push(error.message));
    await errorPage.route("**/api/orders", async (route) => {
      requestCount += 1;
      if (requestCount === 1) {
        await route.fulfill({
          body: JSON.stringify({ message: "Unavailable" }),
          contentType: "application/json",
          status: 503,
        });
        return;
      }
      await successGate;
      await route.fulfill({
        body: JSON.stringify(ordersData),
        contentType: "application/json",
        status: 200,
      });
    });
    await errorPage.goto(`${baseURL}/orders`, { waitUntil: "domcontentloaded" });
    await errorPage.locator('[data-orders-state="error"]').waitFor();
    expect(await errorPage.getByRole("heading", { name: "The order queue did not arrive." }).isVisible()).toBe(true);
    const expectedErrorCount = errors.length;
    await errorPage.getByRole("button", { name: /Retry queue/ }).click();
    await errorPage.locator('[data-orders-state="loading"]').waitFor();
    releaseSuccess();
    await errorPage.locator('[data-orders-state="success"]').waitFor();
    expect(requestCount).toBe(2);
    expect(errors).toHaveLength(expectedErrorCount);
    await errorPage.close();
  });

  it("keeps the dark mobile order queue within the viewport", async () => {
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
    await page.goto(`${baseURL}/orders`, { waitUntil: "domcontentloaded" });
    await page.locator('[data-orders-state="success"]').waitFor();

    expect(await page.locator("html").getAttribute("data-theme")).toBe("dark");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    expect(await page.getByRole("columnheader").count()).toBe(6);
    expect(await page.getByRole("navigation", { name: "Mobile workspace navigation" }).getByRole("link", { name: /Orders/ }).getAttribute("aria-current")).toBe("page");
    await page.close();
  });

  it("preserves the shared shell across internal workspace navigation", async () => {
    const page = await browser.newPage({ viewport: { height: 1_000, width: 1_440 } });
    await page.goto(`${baseURL}/orders`, { waitUntil: "domcontentloaded" });
    await page.locator('[data-orders-state="success"]').waitFor();
    await page.evaluate(() => {
      document.body.dataset["shellMarker"] = "preserved";
    });

    await page.getByRole("link", { name: "Northline operations home" }).click();
    await page.locator('[data-dashboard-state="success"]').waitFor();
    expect(await page.locator("body").getAttribute("data-shell-marker")).toBe("preserved");

    await page.getByRole("link", { name: /Orders/ }).first().click();
    await page.locator('[data-orders-state="success"]').waitFor();
    expect(await page.locator("body").getAttribute("data-shell-marker")).toBe("preserved");
    await page.close();
  });
});

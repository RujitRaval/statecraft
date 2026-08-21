import { spawn, type ChildProcess } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createServer } from "node:net";
import { dirname, resolve } from "node:path";

import { chromium, type Browser } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { dashboardData } from "../lib/dashboard";
import { customerData, longCustomerData } from "../lib/customers";
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
  it("keeps server-only customer details out of browser chunks", async () => {
    const chunksDirectory = resolve(appDirectory, ".next", "static", "chunks");
    const chunkNames = (await readdir(chunksDirectory, { recursive: true }))
      .filter((name) => name.endsWith(".js"));
    const browserCode = (await Promise.all(
      chunkNames.map((name) => readFile(resolve(chunksDirectory, name), "utf8")),
    )).join("\n");

    expect(browserCode).not.toContain(customerData.primaryContact.email);
    expect(browserCode).not.toContain(customerData.deliveryAddress[0]);
    expect(browserCode).not.toContain(longCustomerData.note.title);
  });

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

  it("renders a deterministic customer record with usable account links", async () => {
    const page = await browser.newPage({ viewport: { height: 1_000, width: 1_440 } });
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${baseURL}/customers/${customerData.id}`, { waitUntil: "domcontentloaded" });
    await page.locator('[data-customer-state="success"]').waitFor();

    expect(await page.getByRole("heading", { name: customerData.name }).isVisible()).toBe(true);
    expect(await page.locator(".customer-status-card--active").isVisible()).toBe(true);
    expect(await page.getByRole("link", { name: /Customers/ }).first().getAttribute("aria-current")).toBe("page");
    expect(await page.getByRole("region", { name: "Customer account summary" }).getByText("$42,876").isVisible()).toBe(true);
    const recentOrders = page.getByRole("list", { name: "Recent customer orders" });
    expect(await recentOrders.getByRole("listitem").count()).toBe(3);
    expect(await recentOrders.getByRole("link").count()).toBe(1);
    expect(await recentOrders.getByText("History", { exact: true }).count()).toBe(2);
    expect(await page.getByRole("status").textContent()).toBe(`Customer record loaded for ${customerData.name}.`);
    expect(await page.getByRole("link", { name: customerData.primaryContact.email }).getAttribute("href")).toBe(`mailto:${customerData.primaryContact.email}`);
    expect(errors).toEqual([]);

    await recentOrders.getByRole("link", { name: /NL-4821/ }).click();
    await page.locator('[data-orders-state="success"]').waitFor();
    await page.getByText("Showing 1 of 8 orders", { exact: true }).waitFor();
    expect(await page.getByRole("searchbox", { name: "Search orders" }).inputValue()).toBe("NL-4821");
    const queue = page.getByRole("table", { name: "Fulfillment order queue" });
    expect(await queue.getByRole("row").count()).toBe(2);
    expect(await queue.getByRole("cell", { name: "At risk" }).isVisible()).toBe(true);
    await page.close();
  });

  it("keeps customer loading, unauthorized, and error states deliberate and recoverable", async () => {
    const loadingPage = await browser.newPage();
    await loadingPage.route("**/api/customers/**", () => new Promise(() => undefined));
    await loadingPage.goto(`${baseURL}/customers/${customerData.id}`, { waitUntil: "domcontentloaded" });
    expect(await loadingPage.locator('[data-customer-state="loading"]').isVisible()).toBe(true);
    await loadingPage.close();

    const unauthorizedPage = await browser.newPage();
    await unauthorizedPage.route("**/api/customers/**", (route) => route.fulfill({
      body: JSON.stringify({ message: "Restricted" }),
      contentType: "application/json",
      status: 401,
    }));
    await unauthorizedPage.goto(`${baseURL}/customers/${customerData.id}`, { waitUntil: "domcontentloaded" });
    await unauthorizedPage.locator('[data-customer-state="unauthorized"]').waitFor();
    expect(await unauthorizedPage.getByRole("heading", { name: "This account needs elevated access." }).isVisible()).toBe(true);
    expect(await unauthorizedPage.getByText("No contact, address, or order details were loaded.").isVisible()).toBe(true);
    expect(await unauthorizedPage.getByText("401").isVisible()).toBe(true);
    await unauthorizedPage.close();

    const forbiddenPage = await browser.newPage();
    await forbiddenPage.route("**/api/customers/**", (route) => route.fulfill({
      body: JSON.stringify({ message: "Forbidden" }),
      contentType: "application/json",
      status: 403,
    }));
    await forbiddenPage.goto(`${baseURL}/customers/${customerData.id}`, { waitUntil: "domcontentloaded" });
    await forbiddenPage.locator('[data-customer-state="unauthorized"]').waitFor();
    expect(await forbiddenPage.getByText("403").isVisible()).toBe(true);
    await forbiddenPage.close();

    const missingPage = await browser.newPage();
    await missingPage.goto(`${baseURL}/customers/not-a-customer`, { waitUntil: "domcontentloaded" });
    await missingPage.locator('[data-customer-state="not-found"]').waitFor();
    expect(await missingPage.getByRole("heading", { name: "This customer record was not found." }).isVisible()).toBe(true);
    await missingPage.close();

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
    await errorPage.route("**/api/customers/**", async (route) => {
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
        body: JSON.stringify(customerData),
        contentType: "application/json",
        status: 200,
      });
    });
    await errorPage.goto(`${baseURL}/customers/${customerData.id}`, { waitUntil: "domcontentloaded" });
    await errorPage.locator('[data-customer-state="error"]').waitFor();
    expect(await errorPage.getByRole("heading", { name: "The customer record did not arrive." }).isVisible()).toBe(true);
    const expectedErrorCount = errors.length;
    await errorPage.getByRole("button", { name: /Retry profile/ }).click();
    await errorPage.locator('[data-customer-state="loading"]').waitFor();
    releaseSuccess();
    await errorPage.locator('[data-customer-state="success"]').waitFor();
    expect(requestCount).toBe(2);
    expect(errors).toHaveLength(expectedErrorCount);
    await errorPage.close();
  });

  it("rejects a valid customer payload whose identity does not match the route", async () => {
    const page = await browser.newPage();
    await page.route("**/api/customers/**", (route) => route.fulfill({
      body: JSON.stringify({ ...customerData, id: "cus-different" }),
      contentType: "application/json",
      status: 200,
    }));
    await page.goto(`${baseURL}/customers/${customerData.id}`, { waitUntil: "domcontentloaded" });
    await page.locator('[data-customer-state="error"]').waitFor();
    expect(await page.getByText(/mismatched record/).isVisible()).toBe(true);
    await page.close();
  });

  it("renders long customer content in dark mode without mobile overflow", async () => {
    const page = await browser.newPage({ viewport: { height: 844, width: 390 } });
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));
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
    await page.route("**/api/customers/**", (route) => route.fulfill({
      body: JSON.stringify({
        ...longCustomerData,
        deliveryAddress: [...longCustomerData.deliveryAddress, longCustomerData.deliveryAddress[0]],
        status: "Review",
      }),
      contentType: "application/json",
      status: 200,
    }));
    await page.goto(`${baseURL}/customers/${longCustomerData.id}`, { waitUntil: "domcontentloaded" });
    await page.locator('[data-customer-state="success"]').waitFor();

    expect(await page.locator("html").getAttribute("data-theme")).toBe("dark");
    expect(await page.getByRole("heading", { name: longCustomerData.name }).isVisible()).toBe(true);
    expect(await page.getByText(longCustomerData.primaryContact.role).isVisible()).toBe(true);
    expect(await page.getByText(longCustomerData.note.body).isVisible()).toBe(true);
    expect(await page.locator(".customer-status-card--review").isVisible()).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    const mobileNavigation = page.getByRole("navigation", { name: "Mobile workspace navigation" });
    expect(await mobileNavigation.getByRole("link", { name: /Customers/ }).getAttribute("aria-current")).toBe("page");
    expect(await mobileNavigation.evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" "))).toHaveLength(3);
    expect(errors).toEqual([]);
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

    await page.getByRole("link", { name: /Customers/ }).first().click();
    await page.locator('[data-customer-state="success"]').waitFor();
    expect(await page.locator("body").getAttribute("data-shell-marker")).toBe("preserved");
    await page.close();
  });
});

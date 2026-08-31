import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { loadConfig, runCli, type LoadedConfig } from "uiwitness";
import { expandMatrix, parseReport } from "uiwitness-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { customerData, longCustomerData } from "../lib/customers";
import { longCustomerFixture } from "../uiwitness/scenarios/shared.mjs";

const appDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const configPath = join(appDirectory, "uiwitness.config.ts");
const baseUrlEnvironment = "UIWITNESS_EXAMPLE_BASE_URL";
const previousBaseURL = process.env[baseUrlEnvironment];
let baseURL = "";
let config: LoadedConfig;
let server: ChildProcess;
let serverExit: Promise<void>;
const projectDirectories: string[] = [];

async function availablePort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      if (address === null || typeof address === "string") {
        reject(new Error("Could not allocate a local matrix-test port."));
        return;
      }
      probe.close((error) =>
        error === undefined ? resolvePort(address.port) : reject(error),
      );
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
  throw new Error(`Example application remained available at ${url}.`);
}

function coordinate(
  routeId: string,
  stateId: string,
  viewportId: string,
  theme: string,
): string {
  return `${routeId}:${stateId}:${viewportId}:${theme}`;
}

beforeAll(async () => {
  const port = await availablePort();
  baseURL = `http://127.0.0.1:${port}`;
  process.env[baseUrlEnvironment] = baseURL;
  config = await loadConfig({ configPath });

  const nextWrapper = resolve(appDirectory, "scripts", "next.mjs");
  server = spawn(
    process.execPath,
    [nextWrapper, "start", "--hostname", "127.0.0.1", "--port", String(port)],
    { cwd: appDirectory, stdio: "ignore" },
  );
  serverExit = new Promise<void>((resolveExit) =>
    server.once("exit", () => resolveExit()),
  );
  await waitForServer(`${baseURL}/api/dashboard`);
}, 30_000);

afterAll(async () => {
  try {
    if (server !== undefined) {
      if (server.exitCode === null && server.signalCode === null) {
        server.kill("SIGTERM");
      }
      await serverExit;
      await waitForServerShutdown(`${baseURL}/api/dashboard`);
    }
  } finally {
    if (previousBaseURL === undefined) {
      delete process.env[baseUrlEnvironment];
    } else {
      process.env[baseUrlEnvironment] = previousBaseURL;
    }
    await Promise.all(
      projectDirectories.map((directory) =>
        rm(directory, { force: true, recursive: true }),
      ),
    );
  }
});

describe("complete example scenario matrix", () => {
  it("expands all configured routes and states into 60 stable cells", () => {
    const cells = expandMatrix(config.config);
    const expectedStates = [
      ["dashboard", ["success", "loading", "empty", "error"]],
      ["orders", ["success", "loading", "empty", "error"]],
      [
        "customers",
        [
          "success",
          "loading",
          "unauthorized",
          "forbidden",
          "not-found",
          "error",
          "long-content",
        ],
      ],
    ] as const;
    const expectedCoordinates = expectedStates.flatMap(([routeId, states]) =>
      states.flatMap((stateId) =>
        ["mobile", "desktop"].flatMap((viewportId) =>
          ["light", "dark"].map((theme) =>
            coordinate(routeId, stateId, viewportId, theme),
          ),
        ),
      ),
    );

    expect(config.config.baseURL).toBe(baseURL);
    expect(cells).toHaveLength(60);
    expect(
      cells.map((cell) =>
        coordinate(
          cell.route.id,
          cell.state.id,
          cell.viewportId,
          cell.theme,
        ),
      ),
    ).toEqual(expectedCoordinates);
    expect(new Set(cells.map((cell) => cell.state.setup))).toEqual(
      new Set([
        "./uiwitness/scenarios/customers.mjs",
        "./uiwitness/scenarios/dashboard.mjs",
        "./uiwitness/scenarios/orders.mjs",
      ]),
    );
    expect(longCustomerFixture).toEqual({
      ...longCustomerData,
      id: customerData.id,
    });
  });

  it("persists the offline report with only the four intentional failures", async () => {
    const projectDirectory = await mkdtemp(
      join(tmpdir(), "uiwitness-example-matrix-"),
    );
    projectDirectories.push(projectDirectory);
    const stdout: string[] = [];
    const stderr: string[] = [];

    const exitCode = await runCli({
      args: ["scan", "--config", configPath],
      cwd: projectDirectory,
      stderr: (message) => stderr.push(message),
      stdout: (message) => stdout.push(message),
    });

    expect(exitCode).toBe(1);
    expect(stderr).toEqual([]);
    expect(stdout.join("")).toContain("4 of 60 executions failed.");

    const reportPath = join(
      projectDirectory,
      ".uiwitness",
      "report",
      "uiwitness.json",
    );
    const htmlPath = join(
      projectDirectory,
      ".uiwitness",
      "report",
      "index.html",
    );
    const report = parseReport(JSON.parse(await readFile(reportPath, "utf8")));
    const failures = report.executions.filter(
      (execution) => execution.status === "failed",
    );

    expect(report.summary).toMatchObject({
      executions: 60,
      failed: 4,
      passed: 56,
      routes: 3,
      states: 15,
    });
    expect(report.summary.coverage).toEqual({
      execution: { covered: 56, percentage: 93.33, total: 60 },
      responsive: { covered: 14, percentage: 93.33, total: 15 },
      state: { covered: 15, percentage: 100, total: 15 },
      theme: { covered: 14, percentage: 93.33, total: 15 },
    });
    expect(
      failures.map((execution) =>
        coordinate(
          execution.routeId,
          execution.stateId,
          execution.viewportId,
          execution.theme,
        ),
      ),
    ).toEqual([
      "orders:error:mobile:dark",
      "orders:error:desktop:dark",
      "customers:long-content:mobile:light",
      "customers:long-content:mobile:dark",
    ]);
    for (const execution of failures) {
      expect(execution.failures.map((failure) => failure.code)).toEqual([
        "ASSERTION_FAILED",
      ]);
      expect(execution.screenshotPath).not.toBeNull();
    }
    await Promise.all(
      report.executions.map(async (execution) => {
        expect(execution.screenshotPath).not.toBeNull();
        const screenshot = await stat(
          join(projectDirectory, execution.screenshotPath!),
        );
        expect(screenshot.isFile()).toBe(true);
        expect(screenshot.size).toBeGreaterThan(0);
      }),
    );

    const html = await readFile(htmlPath, "utf8");
    expect(html).toContain('data-brand-system="kinetic-evidence-v1"');
    expect(html).toContain("Evidence<br>over instinct.");
    expect(html).toContain("4 states broke. Open the evidence.");
    expect(html).toContain("<strong>93.33<span>%</span></strong>");
    expect(html).toContain("<span>Failed</span><strong>4</strong>");
  }, 180_000);
});

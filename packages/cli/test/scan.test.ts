import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { ScanError, scanProject } from "../src/scan.js";

const projects: string[] = [];

async function projectFixture(): Promise<{
  readonly configPath: string;
  readonly project: string;
}> {
  const project = await realpath(
    await mkdtemp(join(tmpdir(), "uiwitness-cli-scan-")),
  );
  projects.push(project);
  const configDirectory = join(project, "config");
  const scenarios = join(configDirectory, "scenarios");
  await mkdir(scenarios, { recursive: true });
  const routeFixture = `export default {
  async beforeNavigate({ page }) {
    await page.route("**/*", async (request) => {
      await request.fulfill({
        contentType: "text/html",
        status: 200,
        body: "<!doctype html><title>UIWitness fixture</title><h1>Ready</h1>",
      });
    });
  },
};\n`;
  await writeFile(join(scenarios, "pass.mjs"), routeFixture, "utf8");
  await writeFile(
    join(scenarios, "fail.mjs"),
    `export default {
  async beforeNavigate({ page }) {
    await page.route("**/*", async (request) => {
      await request.fulfill({
        contentType: "text/html",
        status: 200,
        body: "<!doctype html><title>UIWitness fixture</title><h1>Ready</h1>",
      });
    });
  },
  async assert() {
    throw new Error("Expected settings heading.");
  },
};\n`,
    "utf8",
  );
  const configPath = join(configDirectory, "custom.mjs");
  await writeFile(
    configPath,
    `export default {
  baseURL: "https://uiwitness.invalid",
  routes: [
    { id: "dashboard", path: "/dashboard", states: [{ id: "success", setup: "./scenarios/pass.mjs" }] },
    { id: "settings", path: "/settings", states: [{ id: "error", setup: "./scenarios/fail.mjs" }] },
  ],
  themes: ["light"],
  viewports: { compact: { height: 240, width: 320 } },
};\n`,
    "utf8",
  );
  return { configPath, project };
}

afterEach(async () => {
  await Promise.all(
    projects.splice(0).map((project) =>
      rm(project, { force: true, recursive: true }),
    ),
  );
});

describe("scanProject", () => {
  it("filters the matrix, resolves scenarios from the config, and persists output", async () => {
    const fixture = await projectFixture();

    const run = await scanProject({
      configPath: "config/custom.mjs",
      cwd: fixture.project,
      routeId: "dashboard",
    });

    expect(run.configPath).toBe(await realpath(fixture.configPath));
    expect(run.htmlReportPath).toBe(".uiwitness/report/index.html");
    expect(run.reportPath).toBe(".uiwitness/report/uiwitness.json");
    expect(run.report.summary).toMatchObject({
      executions: 1,
      failed: 0,
      passed: 1,
      routes: 1,
      states: 1,
    });
    expect(run.report.executions[0]).toMatchObject({
      routeId: "dashboard",
      scenarioSource: "./scenarios/pass.mjs",
      status: "passed",
    });
    const reportPath = join(fixture.project, run.reportPath);
    await expect(readFile(reportPath, "utf8")).resolves.toContain(
      '"schemaVersion": 1',
    );
    await expect(
      readFile(join(fixture.project, ...run.htmlReportPath.split("/")), "utf8"),
    ).resolves.toContain("UI State Coverage Report");
    const screenshotPath = run.report.executions[0]!.screenshotPath;
    expect(screenshotPath).not.toBeNull();
    await expect(
      access(join(fixture.project, ...(screenshotPath ?? "").split("/"))),
    ).resolves.toBeUndefined();
  });

  it("continues through failed cells and persists their terminal status", async () => {
    const fixture = await projectFixture();

    const run = await scanProject({
      configPath: fixture.configPath,
      cwd: fixture.project,
    });

    expect(run.report.summary).toMatchObject({
      executions: 2,
      failed: 1,
      passed: 1,
    });
    expect(run.report.executions.map(({ status }) => status)).toEqual([
      "passed",
      "failed",
    ]);
    expect(run.report.executions[1]!.failures).toEqual([
      { code: "ASSERTION_FAILED", message: "Expected settings heading." },
    ]);
  });

  it("rejects an unknown route before creating output", async () => {
    const fixture = await projectFixture();

    const error = await scanProject({
      configPath: fixture.configPath,
      cwd: fixture.project,
      routeId: "missing",
    }).catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(ScanError);
    expect(error).toMatchObject({
      code: "SCAN_ROUTE_NOT_FOUND",
      routeId: "missing",
    });
    await expect(
      access(join(fixture.project, ".uiwitness")),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });
});

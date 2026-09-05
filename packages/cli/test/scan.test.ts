import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
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

async function authenticatedProjectFixture(): Promise<{
  readonly configPath: string;
  readonly project: string;
}> {
  const fixture = await projectFixture();
  const configDirectory = join(fixture.project, "config");
  await writeFile(
    join(configDirectory, "auth.mjs"),
    `export default async function ({ context, page }) {
  const secret = process.env.UIWITNESS_AUTH_SECRET_CANARY;
  await page.route("https://uiwitness.invalid/**", route => route.fulfill({ contentType: "text/html", body: "<main>login</main>" }));
  await page.goto("https://uiwitness.invalid/login");
  await page.evaluate(value => localStorage.setItem("session", value), secret);
  await context.addCookies([{ name: "session", value: secret, url: "https://uiwitness.invalid" }]);
}
`,
    "utf8",
  );
  const scenarioPath = join(configDirectory, "scenarios", "pass.mjs");
  await writeFile(
    scenarioPath,
    `export default {
  async beforeNavigate({ page }) {
    await page.route("**/*", route => route.fulfill({ contentType: "text/html", status: 200, body: "<!doctype html><h1>Authenticated</h1>" }));
  },
  async assert({ context, page }) {
    const expected = process.env.UIWITNESS_AUTH_SECRET_CANARY;
    const stored = await page.evaluate(() => localStorage.getItem("session"));
    const cookies = await context.cookies("https://uiwitness.invalid");
    if (stored !== expected || cookies.find(cookie => cookie.name === "session")?.value !== expected) throw new Error("Authentication state missing");
  },
};
`,
    "utf8",
  );
  const source = await readFile(fixture.configPath, "utf8");
  await writeFile(
    fixture.configPath,
    source.replace(
      "  baseURL:",
      '  authentication: { setup: "./auth.mjs" },\n  baseURL:',
    ),
    "utf8",
  );
  return fixture;
}

afterEach(async () => {
  await Promise.all(
    projects.splice(0).map((project) =>
      rm(project, { force: true, recursive: true }),
    ),
  );
});

describe("scanProject", () => {
  it("uses one memory-only login without serializing its secret state", async () => {
    const fixture = await authenticatedProjectFixture();
    const canary = "UIWITNESS_AUTH_SECRET_CANARY_d951c9";
    process.env["UIWITNESS_AUTH_SECRET_CANARY"] = canary;
    try {
      const run = await scanProject({
        configPath: "config/custom.mjs",
        cwd: fixture.project,
        routeId: "dashboard",
      });

      expect(run.report.executions[0]?.status).toBe("passed");
      const files = await readdir(join(fixture.project, ".uiwitness"), {
        recursive: true,
        withFileTypes: true,
      });
      for (const file of files) {
        if (!file.isFile()) continue;
        const contents = await readFile(join(file.parentPath, file.name));
        expect(contents.includes(Buffer.from(canary))).toBe(false);
      }
    } finally {
      delete process.env["UIWITNESS_AUTH_SECRET_CANARY"];
    }
  });

  it("rejects an authentication setup outside the workspace before browser work", async () => {
    const fixture = await projectFixture();
    const outside = await realpath(
      await mkdtemp(join(tmpdir(), "uiwitness-cli-auth-outside-")),
    );
    projects.push(outside);
    const setupPath = join(outside, "auth.mjs");
    await writeFile(setupPath, "export default async function () {}\n", "utf8");
    const source = await readFile(fixture.configPath, "utf8");
    await writeFile(
      fixture.configPath,
      source.replace(
        "  baseURL:",
        `  authentication: { setup: ${JSON.stringify(setupPath)} },\n  baseURL:`,
      ),
      "utf8",
    );

    await expect(scanProject({
      configPath: "config/custom.mjs",
      cwd: fixture.project,
    })).rejects.toMatchObject({ code: "SCAN_AUTH_SETUP_PATH_INVALID" });
    await expect(access(join(fixture.project, ".uiwitness"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

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

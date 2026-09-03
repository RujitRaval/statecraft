import {
  mkdir,
  mkdtemp,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";

import { parseReport } from "uiwitness-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const runPersistedScenarioCellsMock = vi.hoisted(() => vi.fn());

vi.mock("uiwitness-runner-playwright", () => ({
  runPersistedScenarioCells: runPersistedScenarioCellsMock,
}));
import { ScanError, scanProject } from "../src/scan.js";

const projects: string[] = [];

beforeEach(() => {
  runPersistedScenarioCellsMock.mockReset();
});

afterEach(async () => {
  await Promise.all(
    projects.splice(0).map((project) =>
      rm(project, { force: true, recursive: true }),
    ),
  );
});

describe("scanProject options", () => {
  it("selects one exact route/state/viewport/theme coordinate", async () => {
    const project = await realpath(
      await mkdtemp(join(tmpdir(), "uiwitness-cli-scan-coordinate-")),
    );
    projects.push(project);
    const configPath = join(project, "custom.mjs");
    await writeFile(
      configPath,
      `export default {
  baseURL: "https://uiwitness.invalid",
  routes: [{ id: "home", path: "/", states: [{ id: "success", setup: "./scenario.mjs" }] }],
  themes: ["light", "dark"],
  viewports: { compact: { height: 240, width: 320 }, wide: { height: 900, width: 1440 } },
};\n`,
      "utf8",
    );
    const emptyReport = parseReport({
      executions: [],
      generatedAt: "2026-08-20T18:00:00.000Z",
      project: { baseURL: "https://uiwitness.invalid" },
      schemaVersion: 1,
      summary: {
        coverage: {
          execution: { covered: 0, percentage: 0, total: 0 },
          responsive: { covered: 0, percentage: 0, total: 0 },
          state: { covered: 0, percentage: 0, total: 0 },
          theme: { covered: 0, percentage: 0, total: 0 },
        },
        durationMs: 0,
        executions: 0,
        failed: 0,
        passed: 0,
        routes: 0,
        states: 0,
      },
    });
    runPersistedScenarioCellsMock.mockResolvedValue({
      htmlReportPath: ".uiwitness/report/index.html",
      report: emptyReport,
      reportPath: ".uiwitness/report/uiwitness.json",
    });

    await scanProject({
      configPath,
      coordinate: "home/success/wide/dark",
      cwd: project,
      headed: true,
    });

    expect(runPersistedScenarioCellsMock.mock.calls[0]![0]).toEqual([{
      route: {
        id: "home",
        path: "/",
        states: [{ id: "success", setup: "./scenario.mjs" }],
      },
      state: { id: "success", setup: "./scenario.mjs" },
      theme: "dark",
      viewport: { height: 900, width: 1440 },
      viewportId: "wide",
    }]);
  });

  it.each([
    ["home/success/wide", "SCAN_COORDINATE_INVALID"],
    ["home/success/wide/missing", "SCAN_COORDINATE_NOT_FOUND"],
  ] as const)("rejects unusable exact coordinate %s", async (coordinate, code) => {
    const project = await realpath(
      await mkdtemp(join(tmpdir(), "uiwitness-cli-scan-coordinate-error-")),
    );
    projects.push(project);
    const configPath = join(project, "custom.mjs");
    await writeFile(
      configPath,
      `export default {
  baseURL: "https://uiwitness.invalid",
  routes: [{ id: "home", path: "/", states: [{ id: "success", setup: "./scenario.mjs" }] }],
  themes: ["light"],
  viewports: { wide: { height: 900, width: 1440 } },
};\n`,
      "utf8",
    );

    const error = await scanProject({ configPath, coordinate, cwd: project })
      .catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(ScanError);
    expect(error).toMatchObject({ code });
    expect(runPersistedScenarioCellsMock).not.toHaveBeenCalled();
  });

  it("forwards headed mode and config policy to the persisted runner", async () => {
    const project = await realpath(
      await mkdtemp(join(tmpdir(), "uiwitness-cli-scan-options-")),
    );
    projects.push(project);
    const configPath = join(project, "custom.mjs");
    await writeFile(
      configPath,
      `export default {
  baseURL: "https://uiwitness.invalid",
  failOn: { consoleError: true, failedRequest: true, pageError: true },
  routes: [{ id: "home", path: "/", states: [{ id: "success", setup: "./scenario.mjs" }] }],
  themes: ["light"],
  viewports: { compact: { height: 240, width: 320 } },
};\n`,
      "utf8",
    );
    const report = parseReport({
      executions: [],
      generatedAt: "2026-08-20T18:00:00.000Z",
      project: { baseURL: "https://uiwitness.invalid" },
      schemaVersion: 1,
      summary: {
        coverage: {
          execution: { covered: 0, percentage: 0, total: 0 },
          responsive: { covered: 0, percentage: 0, total: 0 },
          state: { covered: 0, percentage: 0, total: 0 },
          theme: { covered: 0, percentage: 0, total: 0 },
        },
        durationMs: 0,
        executions: 0,
        failed: 0,
        passed: 0,
        routes: 0,
        states: 0,
      },
    });
    runPersistedScenarioCellsMock.mockResolvedValue({
      htmlReportPath: ".uiwitness/report/index.html",
      report,
      reportPath: ".uiwitness/report/uiwitness.json",
    });

    await scanProject({ configPath, cwd: project, headed: true });

    expect(runPersistedScenarioCellsMock).toHaveBeenCalledOnce();
    expect(runPersistedScenarioCellsMock.mock.calls[0]![1]).toEqual({
      baseURL: "https://uiwitness.invalid",
      failOn: {
        consoleError: true,
        pageError: true,
        failedRequest: true,
      },
      launchOptions: { headless: false },
      projectDirectory: project,
      scenarioBaseDirectory: project,
    });
  });

  it("snapshots the invocation root before trusted config execution", async () => {
    const originalCwd = process.cwd();
    const project = await realpath(
      await mkdtemp(join(tmpdir(), "uiwitness-cli-scan-cwd-")),
    );
    projects.push(project);
    const redirectedDirectory = join(project, "redirected");
    await mkdir(redirectedDirectory);
    await writeFile(
      join(project, "custom.mjs"),
      `process.chdir(${JSON.stringify(redirectedDirectory)});
export default {
  baseURL: "https://uiwitness.invalid",
  routes: [{ id: "home", path: "/", states: [{ id: "success", setup: "./scenario.mjs" }] }],
  themes: ["light"],
  viewports: { compact: { height: 240, width: 320 } },
};\n`,
      "utf8",
    );
    const report = parseReport({
      executions: [],
      generatedAt: "2026-08-20T18:00:00.000Z",
      project: { baseURL: "https://uiwitness.invalid" },
      schemaVersion: 1,
      summary: {
        coverage: {
          execution: { covered: 0, percentage: 0, total: 0 },
          responsive: { covered: 0, percentage: 0, total: 0 },
          state: { covered: 0, percentage: 0, total: 0 },
          theme: { covered: 0, percentage: 0, total: 0 },
        },
        durationMs: 0,
        executions: 0,
        failed: 0,
        passed: 0,
        routes: 0,
        states: 0,
      },
    });
    runPersistedScenarioCellsMock.mockResolvedValue({
      htmlReportPath: ".uiwitness/report/index.html",
      report,
      reportPath: ".uiwitness/report/uiwitness.json",
    });

    try {
      await scanProject({
        configPath: "custom.mjs",
        cwd: relative(originalCwd, project),
      });

      expect(runPersistedScenarioCellsMock.mock.calls[0]![1]).toMatchObject({
        projectDirectory: project,
        scenarioBaseDirectory: project,
      });
    } finally {
      process.chdir(originalCwd);
    }
  });
});

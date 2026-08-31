import { tmpdir } from "node:os";
import { join, sep } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sentinel = vi.hoisted(() => ({
  active: false,
  legacyCalls: [] as string[],
}));
const legacyEvidenceRoot = `.${["state", "craft"].join("")}`;
const discoverPublicRoutesMock = vi.hoisted(() => vi.fn());
const runPersistedScenarioCellsMock = vi.hoisted(() => vi.fn());
const runPublicSiteChecksMock = vi.hoisted(() => vi.fn());

vi.mock("node:fs/promises", async (importOriginal) => {
  const original = await importOriginal<typeof import("node:fs/promises")>();
  const mocked = { ...original } as Record<string, unknown>;
  for (const name of [
    "access",
    "lstat",
    "open",
    "readFile",
    "readdir",
    "realpath",
    "stat",
  ] as const) {
    const operation = original[name] as (...arguments_: unknown[]) => unknown;
    mocked[name] = (...arguments_: unknown[]) => {
      if (sentinel.active) {
        for (const argument of arguments_) {
          const value =
            typeof argument === "string"
              ? argument
              : argument instanceof URL
                ? argument.pathname
                : undefined;
          if (
            value === legacyEvidenceRoot ||
            value?.endsWith(`${sep}${legacyEvidenceRoot}`) === true ||
            value?.includes(`${sep}${legacyEvidenceRoot}${sep}`) === true
          ) {
            sentinel.legacyCalls.push(`${name}:${value}`);
          }
        }
      }
      return Reflect.apply(operation, original, arguments_);
    };
  }
  return mocked;
});

vi.mock("uiwitness-runner-playwright", () => ({
  discoverPublicRoutes: discoverPublicRoutesMock,
  PublicRouteDiscoveryError: class PublicRouteDiscoveryError extends Error {},
  runPersistedScenarioCells: runPersistedScenarioCellsMock,
  runPublicSiteChecks: runPublicSiteChecksMock,
}));

import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { parseReport } from "uiwitness-core";

import { checkPublicSite } from "../src/check.js";
import { openReportWithLauncher } from "../src/open.js";
import { scanProject } from "../src/scan.js";

const projects: string[] = [];

function emptyReport() {
  return parseReport({
    executions: [],
    generatedAt: "2026-08-31T18:00:00.000Z",
    project: { baseURL: "https://uiwitness.invalid/" },
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
}

beforeEach(() => {
  discoverPublicRoutesMock.mockReset();
  runPersistedScenarioCellsMock.mockReset();
  runPublicSiteChecksMock.mockReset();
});

afterEach(async () => {
  sentinel.active = false;
  sentinel.legacyCalls.length = 0;
  await Promise.all(
    projects.splice(0).map(async (project) => {
      await chmod(join(project, legacyEvidenceRoot), 0o700).catch(
        () => undefined,
      );
      await rm(project, { force: true, recursive: true });
    }),
  );
});

describe("CLI legacy evidence filesystem isolation", () => {
  it.skipIf(process.platform === "win32")(
    "records zero legacy accesses across check, scan, and open",
    async () => {
      const project = await mkdtemp(join(tmpdir(), "uiwitness-cli-sentinel-"));
      projects.push(project);
      const legacyReport = join(
        project,
        legacyEvidenceRoot,
        "report",
        `${["state", "craft"].join("")}.json`,
      );
      await mkdir(join(project, legacyEvidenceRoot, "report"), {
        recursive: true,
      });
      await writeFile(legacyReport, "legacy-report\n", "utf8");
      await writeFile(
        join(project, "config.mjs"),
        `export default {
  baseURL: "https://uiwitness.invalid/",
  routes: [
    { id: "dashboard", path: "/dashboard", states: [{ id: "success", setup: "./scenario.mjs" }] },
  ],
  themes: ["light"],
  viewports: { desktop: { height: 800, width: 1200 } },
};\n`,
        "utf8",
      );
      const report = emptyReport();
      const persisted = {
        htmlReportPath: ".uiwitness/report/index.html",
        report,
        reportPath: ".uiwitness/report/uiwitness.json",
      } as const;
      discoverPublicRoutesMock.mockResolvedValue({
        attemptedPages: 0,
        baseURL: "https://uiwitness.invalid/",
        routes: [],
        skippedPages: 0,
        truncatedAnchorPages: 0,
      });
      runPublicSiteChecksMock.mockResolvedValue(persisted);
      runPersistedScenarioCellsMock.mockResolvedValue(persisted);
      await chmod(join(project, legacyEvidenceRoot), 0o000);
      sentinel.active = true;

      await checkPublicSite({ cwd: project, url: "https://uiwitness.invalid/" });
      await scanProject({ configPath: "config.mjs", cwd: project });
      await expect(
        openReportWithLauncher({ cwd: project }, async () => undefined),
      ).rejects.toMatchObject({ code: "OPEN_REPORT_NOT_FOUND" });

      sentinel.active = false;
      await chmod(join(project, legacyEvidenceRoot), 0o700);
      await expect(readFile(legacyReport, "utf8")).resolves.toBe(
        "legacy-report\n",
      );
      expect(sentinel.legacyCalls).toEqual([]);
    },
  );
});

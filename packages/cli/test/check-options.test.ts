import {
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";

import { parseReport } from "uiwitness-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const discoverPublicRoutesMock = vi.hoisted(() => vi.fn());
const runPublicSiteChecksMock = vi.hoisted(() => vi.fn());
const PublicRouteDiscoveryErrorMock = vi.hoisted(
  () =>
    class PublicRouteDiscoveryError extends Error {
      constructor(readonly code: string, message: string) {
        super(message);
      }
    },
);

vi.mock("uiwitness-runner-playwright", () => ({
  discoverPublicRoutes: discoverPublicRoutesMock,
  PublicRouteDiscoveryError: PublicRouteDiscoveryErrorMock,
  runPublicSiteChecks: runPublicSiteChecksMock,
}));

import { checkPublicSite } from "../src/check.js";

const projects: string[] = [];

function report() {
  return parseReport({
    executions: [],
    generatedAt: "2026-08-22T18:00:00.000Z",
    project: { baseURL: "https://example.test/" },
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

function discoveredReport() {
  const executions = [
    { routeId: "start-41ec", routePath: "/start" },
    { routeId: "pricing-78b2", routePath: "/pricing" },
  ].map(({ routeId, routePath }) => ({
    diagnostics: {
      consoleErrors: [],
      failedRequests: [],
      navigationStatus: 200,
      pageErrors: [],
    },
    durationMs: 10,
    failures: [],
    routeId,
    routePath,
    scenarioSource: "uiwitness:public-site",
    screenshotPath: `.statecraft/artifacts/${routeId}/public/mobile-light.png`,
    stateId: "public",
    status: "passed" as const,
    theme: "light",
    url: `https://example.test${routePath}`,
    viewport: { height: 844, width: 390 },
    viewportId: "mobile",
  }));
  return parseReport({
    executions,
    generatedAt: "2026-08-22T18:00:00.000Z",
    project: { baseURL: "https://example.test/" },
    schemaVersion: 1,
    summary: {
      coverage: {
        execution: { covered: 2, percentage: 100, total: 2 },
        responsive: { covered: 2, percentage: 100, total: 2 },
        state: { covered: 2, percentage: 100, total: 2 },
        theme: { covered: 2, percentage: 100, total: 2 },
      },
      durationMs: 20,
      executions: 2,
      failed: 0,
      passed: 2,
      routes: 2,
      states: 2,
    },
  });
}

function credentialedUrl(): string {
  const url = new URL("https://example.test");
  url.username = "fixture-user";
  url.password = "fixture-password";
  return url.toString();
}

beforeEach(() => {
  discoverPublicRoutesMock.mockReset();
  runPublicSiteChecksMock.mockReset();
});

afterEach(async () => {
  await Promise.all(
    projects.splice(0).map((project) =>
      rm(project, { force: true, recursive: true }),
    ),
  );
});

describe("checkPublicSite options", () => {
  it("connects bounded discovery to headed evidence persistence", async () => {
    const project = await realpath(
      await mkdtemp(join(tmpdir(), "statecraft-cli-check-options-")),
    );
    projects.push(project);
    const discovery = Object.freeze({
      attemptedPages: 2,
      baseURL: "https://example.test/",
      routes: Object.freeze([
        Object.freeze({ path: "/" }),
        Object.freeze({ path: "/pricing" }),
      ]),
      skippedPages: 0,
      truncatedAnchorPages: 0,
    });
    discoverPublicRoutesMock.mockResolvedValue(discovery);
    const persisted = Object.freeze({
      htmlReportPath: ".statecraft/report/index.html",
      report: report(),
      reportPath: ".statecraft/report/statecraft.json",
    });
    runPublicSiteChecksMock.mockResolvedValue(persisted);

    const result = await checkPublicSite({
      cwd: project,
      headed: true,
      maxPages: 12,
      url: "https://example.test/start",
    });

    expect(discoverPublicRoutesMock).toHaveBeenCalledWith(
      "https://example.test/start",
      { launchOptions: { headless: false }, maxPages: 12 },
    );
    expect(runPublicSiteChecksMock).toHaveBeenCalledWith(discovery, {
      launchOptions: { headless: false },
      projectDirectory: project,
    });
    expect(result).toEqual({ discovery, ...persisted });
    expect(Object.isFrozen(result)).toBe(true);
  });

  it("snapshots the invocation root before browser-backed discovery", async () => {
    const originalCwd = process.cwd();
    const project = await realpath(
      await mkdtemp(join(tmpdir(), "statecraft-cli-check-cwd-")),
    );
    projects.push(project);
    const redirectedDirectory = join(project, "redirected");
    await mkdir(redirectedDirectory);
    const discovery = Object.freeze({
      attemptedPages: 1,
      baseURL: "https://example.test/",
      routes: Object.freeze([Object.freeze({ path: "/" })]),
      skippedPages: 0,
      truncatedAnchorPages: 0,
    });
    discoverPublicRoutesMock.mockImplementation(async () => {
      process.chdir(redirectedDirectory);
      return discovery;
    });
    runPublicSiteChecksMock.mockResolvedValue({
      htmlReportPath: ".statecraft/report/index.html",
      report: report(),
      reportPath: ".statecraft/report/statecraft.json",
    });

    try {
      await checkPublicSite({
        cwd: relative(originalCwd, project),
        url: "https://example.test",
      });
      expect(runPublicSiteChecksMock).toHaveBeenCalledWith(discovery, {
        projectDirectory: project,
      });
    } finally {
      process.chdir(originalCwd);
    }
  });

  it("classifies public input validation without starting persistence", async () => {
    await expect(
      checkPublicSite({ url: "invalid" }),
    ).rejects.toMatchObject({
      code: "CHECK_INVALID_INPUT",
      message: "url must be a valid absolute HTTP(S) URL.",
    });
    expect(discoverPublicRoutesMock).not.toHaveBeenCalled();
    expect(runPublicSiteChecksMock).not.toHaveBeenCalled();
  });

  it("rejects a non-boolean writeConfig value before discovery", async () => {
    await expect(
      checkPublicSite({
        url: "https://example.test",
        writeConfig: "yes",
      } as unknown as Parameters<typeof checkPublicSite>[0]),
    ).rejects.toMatchObject({
      code: "CHECK_INVALID_INPUT",
      message: "writeConfig must be a boolean when provided.",
    });
    expect(discoverPublicRoutesMock).not.toHaveBeenCalled();
    expect(runPublicSiteChecksMock).not.toHaveBeenCalled();
  });

  it("preflights every setup conflict before browser-backed discovery", async () => {
    const project = await realpath(
      await mkdtemp(join(tmpdir(), "statecraft-cli-check-conflicts-")),
    );
    projects.push(project);
    await writeFile(join(project, "statecraft.config.mjs"), "keep", "utf8");
    await writeFile(join(project, "statecraft.config.ts"), "keep", "utf8");

    await expect(
      checkPublicSite({
        cwd: project,
        url: "https://example.test",
        writeConfig: true,
      }),
    ).rejects.toMatchObject({
      code: "CHECK_SETUP_CONFLICT",
      paths: [
        join(project, "statecraft.config.ts"),
        join(project, "statecraft.config.mjs"),
      ],
    });
    expect(discoverPublicRoutesMock).not.toHaveBeenCalled();
    expect(runPublicSiteChecksMock).not.toHaveBeenCalled();
    await expect(
      readFile(join(project, "statecraft.config.mjs"), "utf8"),
    ).resolves.toBe("keep");
  });

  it("publishes a deterministic config and shared scenario after persisted evidence", async () => {
    const project = await realpath(
      await mkdtemp(join(tmpdir(), "statecraft-cli-check-setup-")),
    );
    projects.push(project);
    const discovery = Object.freeze({
      attemptedPages: 2,
      baseURL: "https://example.test/",
      routes: Object.freeze([
        Object.freeze({ path: "/start" }),
        Object.freeze({ path: "/pricing" }),
      ]),
      skippedPages: 0,
      truncatedAnchorPages: 0,
    });
    discoverPublicRoutesMock.mockResolvedValue(discovery);
    const persisted = Object.freeze({
      htmlReportPath: ".statecraft/report/index.html",
      report: discoveredReport(),
      reportPath: ".statecraft/report/statecraft.json",
    });
    runPublicSiteChecksMock.mockResolvedValue(persisted);

    const result = await checkPublicSite({
      cwd: project,
      url: "https://example.test/start",
      writeConfig: true,
    });

    expect(result.setup).toEqual({
      configPath: join(project, "statecraft.config.mts"),
      files: [
        join(project, "statecraft.config.mts"),
        join(project, "statecraft", "scenarios", "public", "default.mts"),
      ],
      projectRoot: project,
      scenarioPath: join(
        project,
        "statecraft",
        "scenarios",
        "public",
        "default.mts",
      ),
    });
    const config = await readFile(
      join(project, "statecraft.config.mts"),
      "utf8",
    );
    expect(config).toContain('baseURL: "https://example.test/"');
    expect(config.indexOf('path: "/start"')).toBeLessThan(
      config.indexOf('path: "/pricing"'),
    );
    expect(config).toContain('id: "start-41ec"');
    expect(config).toContain('id: "pricing-78b2"');
    expect(config).toContain('"mobile": {');
    expect(config).toContain('"height": 844');
    expect(config).toContain('"width": 390');
    expect(config).toContain('"desktop": {');
    expect(config).toContain('"height": 900');
    expect(config).toContain('"width": 1440');
    expect(config).toContain('themes: [\n    "light",\n    "dark"\n  ]');
    expect(config).toContain('"consoleError": false');
    expect(config).toContain('"failedRequest": false');
    expect(config).toContain('"pageError": true');
    await expect(
      readFile(
        join(project, "statecraft", "scenarios", "public", "default.mts"),
        "utf8",
      ),
    ).resolves.toBe(`import { publicSiteScenario } from "uiwitness/public-site-scenario";

export default publicSiteScenario;
`);
  });

  it("preserves a late scenario collision and leaves the config unpublished", async () => {
    const project = await realpath(
      await mkdtemp(join(tmpdir(), "statecraft-cli-check-late-race-")),
    );
    projects.push(project);
    const scenarioPath = join(
      project,
      "statecraft",
      "scenarios",
      "public",
      "default.mts",
    );
    discoverPublicRoutesMock.mockResolvedValue(
      Object.freeze({
        attemptedPages: 2,
        baseURL: "https://example.test/",
        routes: Object.freeze([
          Object.freeze({ path: "/start" }),
          Object.freeze({ path: "/pricing" }),
        ]),
        skippedPages: 0,
        truncatedAnchorPages: 0,
      }),
    );
    runPublicSiteChecksMock.mockImplementation(async () => {
      await mkdir(join(project, "statecraft", "scenarios", "public"), {
        recursive: true,
      });
      await writeFile(scenarioPath, "created by another process", "utf8");
      return Object.freeze({
        htmlReportPath: ".statecraft/report/index.html",
        report: discoveredReport(),
        reportPath: ".statecraft/report/statecraft.json",
      });
    });

    await expect(
      checkPublicSite({
        cwd: project,
        url: "https://example.test",
        writeConfig: true,
      }),
    ).rejects.toMatchObject({
      code: "CHECK_SETUP_CONFLICT",
      paths: [scenarioPath],
    });
    await expect(readFile(scenarioPath, "utf8")).resolves.toBe(
      "created by another process",
    );
    await expect(
      readFile(join(project, "statecraft.config.mts"), "utf8"),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });

  it.each([
    "ftp://example.test",
    credentialedUrl(),
  ])("rejects the unsafe public URL %s before discovery", async (url) => {
    await expect(checkPublicSite({ url })).rejects.toMatchObject({
      code: "CHECK_INVALID_INPUT",
      message: "url must be an absolute HTTP(S) URL without credentials.",
    });
    expect(discoverPublicRoutesMock).not.toHaveBeenCalled();
    expect(runPublicSiteChecksMock).not.toHaveBeenCalled();
  });

  it.each([0, 1.5, 21])(
    "rejects maxPages=%s before browser-backed discovery",
    async (maxPages) => {
      await expect(
        checkPublicSite({
          maxPages,
          url: "https://example.test",
        }),
      ).rejects.toMatchObject({
        code: "CHECK_INVALID_INPUT",
        message: "maxPages must be an integer between 1 and 20.",
      });
      expect(discoverPublicRoutesMock).not.toHaveBeenCalled();
    },
  );

  it("classifies expected starting-page discovery failures", async () => {
    discoverPublicRoutesMock.mockRejectedValue(
      new PublicRouteDiscoveryErrorMock(
        "initial-navigation-failed",
        "The starting page could not be loaded.",
      ),
    );

    await expect(
      checkPublicSite({ url: "https://example.test" }),
    ).rejects.toMatchObject({
      code: "CHECK_DISCOVERY_FAILED",
      message: "The starting page could not be loaded.",
    });
    expect(runPublicSiteChecksMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid output root before browser-backed discovery", async () => {
    const project = await realpath(
      await mkdtemp(join(tmpdir(), "statecraft-cli-check-invalid-root-")),
    );
    projects.push(project);
    await expect(
      checkPublicSite({
        cwd: join(project, "missing"),
        url: "https://example.test",
      }),
    ).rejects.toMatchObject({
      code: "CHECK_ROOT_INVALID",
      message: "The Statecraft check project directory is invalid.",
    });
    expect(discoverPublicRoutesMock).not.toHaveBeenCalled();
    expect(runPublicSiteChecksMock).not.toHaveBeenCalled();
  });

  it("rejects a non-directory output root before browser-backed discovery", async () => {
    const project = await realpath(
      await mkdtemp(join(tmpdir(), "statecraft-cli-check-file-root-")),
    );
    projects.push(project);
    const file = join(project, "not-a-directory");
    await writeFile(file, "fixture", "utf8");

    await expect(
      checkPublicSite({ cwd: file, url: "https://example.test" }),
    ).rejects.toMatchObject({
      code: "CHECK_ROOT_INVALID",
      message: "The Statecraft check project directory is invalid.",
    });
    expect(discoverPublicRoutesMock).not.toHaveBeenCalled();
    expect(runPublicSiteChecksMock).not.toHaveBeenCalled();
  });

  it("does not reclassify unexpected discovery TypeErrors as safe input", async () => {
    const internalError = new TypeError("secret internal detail");
    discoverPublicRoutesMock.mockRejectedValue(internalError);

    await expect(
      checkPublicSite({ url: "https://example.test" }),
    ).rejects.toBe(internalError);
    expect(runPublicSiteChecksMock).not.toHaveBeenCalled();
  });
});

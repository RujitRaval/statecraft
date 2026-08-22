import {
  mkdir,
  mkdtemp,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";

import { parseReport } from "statecraft-ui-core";
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

vi.mock("statecraft-ui-runner-playwright", () => ({
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

  it.each([
    "ftp://example.test",
    "https://user:secret@example.test",
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

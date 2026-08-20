import {
  access,
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename as fsRename,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  expandMatrix,
  parseConfig,
  parseReport,
  screenshotArtifactPath,
  serializeReport,
  type MatrixCell,
} from "@statecraft/core";

import { runPersistedScenarioCells } from "../src/index.js";
import {
  acquirePersistenceLock,
  executionArtifactForOutcome,
  persistReport,
  releasePersistenceLock,
  recoverPublication,
  takeoverClaimPath,
} from "../src/persistence.js";

const scenarioBaseDirectory = fileURLToPath(
  new URL("./fixtures/scenarios/", import.meta.url),
);
const baseURL = "https://statecraft.invalid/base/";

function persistenceCells(states: readonly string[]): readonly MatrixCell[] {
  return expandMatrix(
    parseConfig({
      baseURL,
      routes: [
        {
          id: "capture",
          path: "/capture?source=statecraft#panel",
          states: states.map((id) => ({ id, setup: "./capture.mjs" })),
        },
      ],
      themes: ["light"],
      viewports: { compact: { height: 240, width: 320 } },
    }),
  );
}

async function temporaryProject(): Promise<{
  readonly cleanup: () => Promise<void>;
  readonly path: string;
}> {
  const path = await mkdtemp(join(tmpdir(), "statecraft-persistence-"));
  return {
    cleanup: () => rm(path, { force: true, recursive: true }),
    path,
  };
}

async function expectMissing(path: string): Promise<void> {
  await expect(access(path)).rejects.toMatchObject({ code: "ENOENT" });
}

describe("runPersistedScenarioCells", () => {
  it("persists deterministic screenshots and a validated schema-v1 report", async () => {
    const project = await temporaryProject();
    const eventKey = Symbol.for("statecraft.test.capture-events");
    Reflect.set(globalThis, eventKey, []);

    try {
      const cells = persistenceCells([
        "ordered",
        "page-error",
        "screenshot-fail",
        "clean-after",
      ]);
      const run = await runPersistedScenarioCells(cells, {
        baseURL,
        generatedAt: new Date("2026-08-20T15:00:00.000Z"),
        projectDirectory: project.path,
        scenarioBaseDirectory,
      });

      expect(run.reportPath).toBe(".statecraft/report/statecraft.json");
      expect(run.htmlReportPath).toBe(".statecraft/report/index.html");
      expect(run.report).toMatchObject({
        generatedAt: "2026-08-20T15:00:00.000Z",
        project: { baseURL },
        schemaVersion: 1,
        summary: {
          executions: 4,
          failed: 2,
          passed: 2,
          routes: 1,
          states: 4,
        },
      });
      expect(run.report.executions.map(({ status }) => status)).toEqual([
        "passed",
        "failed",
        "failed",
        "passed",
      ]);
      expect(run.report.summary.coverage).toEqual({
        execution: { covered: 2, percentage: 50, total: 4 },
        responsive: { covered: 2, percentage: 50, total: 4 },
        state: { covered: 2, percentage: 50, total: 4 },
        theme: { covered: 2, percentage: 50, total: 4 },
      });
      expect(run.report.summary.durationMs).toBe(
        run.report.executions.reduce(
          (total, execution) => total + execution.durationMs,
          0,
        ),
      );
      expect(run.report.executions[0]).toMatchObject({
        failures: [],
        routePath: "/capture?source=%5BREDACTED%5D",
        screenshotPath: screenshotArtifactPath(cells[0]!),
        url: "https://statecraft.invalid/capture?source=%5BREDACTED%5D",
      });
      expect(run.report.executions[1]).toMatchObject({
        failures: [
          {
            code: "PAGE_ERROR",
            message: "1 page error(s) matched the failure policy.",
          },
        ],
        screenshotPath: screenshotArtifactPath(cells[1]!),
      });
      expect(run.report.executions[2]).toMatchObject({
        failures: [
          {
            code: "SCREENSHOT_FAILED",
            message: "screenshot failed token=[REDACTED]",
          },
        ],
        screenshotPath: null,
      });

      for (const index of [0, 1, 3]) {
        const path = run.report.executions[index]!.screenshotPath;
        expect(path).not.toBeNull();
        const screenshotPath = join(
          project.path,
          ...(path ?? "").split("/"),
        );
        const bytes = await readFile(screenshotPath);
        expect([...bytes.subarray(0, 8)]).toEqual([
          137, 80, 78, 71, 13, 10, 26, 10,
        ]);
        if (process.platform !== "win32") {
          expect((await stat(screenshotPath)).mode & 0o777).toBe(0o600);
        }
      }
      await expectMissing(
        join(project.path, ".statecraft/artifacts/capture/screenshot-fail/compact-light.png"),
      );

      const reportPath = join(project.path, run.reportPath);
      const serialized = await readFile(reportPath, "utf8");
      expect(parseReport(JSON.parse(serialized))).toEqual(run.report);
      expect(serialized).toBe(serializeReport(run.report));
      if (process.platform !== "win32") {
        expect((await stat(reportPath)).mode & 0o777).toBe(0o600);
        expect(
          (
            await stat(join(project.path, ".statecraft/report/index.html"))
          ).mode & 0o777,
        ).toBe(0o600);
        expect(
          (await stat(join(project.path, ".statecraft/artifacts"))).mode &
            0o777,
        ).toBe(0o700);
      }
      await expect(
        readFile(join(project.path, run.htmlReportPath), "utf8"),
      ).resolves.toContain("UI State Coverage Report");
    } finally {
      Reflect.deleteProperty(globalThis, eventKey);
      await project.cleanup();
    }
  });

  it("replaces stale artifacts, JSON, and HTML as one report set", async () => {
    const project = await temporaryProject();
    const statecraftRoot = join(project.path, ".statecraft");
    const artifactsRoot = join(statecraftRoot, "artifacts");
    const reportRoot = join(statecraftRoot, "report");

    try {
      await mkdir(join(artifactsRoot, "stale"), { recursive: true });
      await mkdir(reportRoot, { recursive: true });
      if (process.platform !== "win32") {
        await chmod(statecraftRoot, 0o755);
        await chmod(reportRoot, 0o755);
      }
      await writeFile(join(artifactsRoot, "stale/old.png"), "old");
      await writeFile(join(reportRoot, "statecraft.json"), "stale");
      await writeFile(join(reportRoot, "index.html"), "stale report UI");

      const run = await runPersistedScenarioCells([], {
        baseURL,
        generatedAt: new Date("2026-08-20T15:01:00.000Z"),
        projectDirectory: project.path,
        scenarioBaseDirectory,
      });

      expect(run.report.executions).toEqual([]);
      expect(await readdir(artifactsRoot)).toEqual([]);
      expect(await readFile(join(reportRoot, "index.html"), "utf8")).toContain(
        "UI State Coverage Report",
      );
      expect((await readdir(statecraftRoot)).sort()).toEqual([
        "artifacts",
        "report",
      ]);
      expect((await readdir(reportRoot)).sort()).toEqual([
        "index.html",
        "statecraft.json",
      ]);
      if (process.platform !== "win32") {
        expect((await stat(statecraftRoot)).mode & 0o777).toBe(0o700);
        expect((await stat(reportRoot)).mode & 0o777).toBe(0o700);
      }
    } finally {
      await project.cleanup();
    }
  });

  it.skipIf(process.platform === "win32")(
    "rejects symbolic-link artifact roots without writing outside the project",
    async () => {
      const project = await temporaryProject();
      const outside = await temporaryProject();
      const statecraftRoot = join(project.path, ".statecraft");

      try {
        await mkdir(statecraftRoot);
        await writeFile(join(outside.path, "marker"), "unchanged");
        await symlink(outside.path, join(statecraftRoot, "artifacts"));

        await expect(
          runPersistedScenarioCells([], {
            baseURL,
            projectDirectory: project.path,
            scenarioBaseDirectory,
          }),
        ).rejects.toThrow(
          ".statecraft/artifacts must be a real directory, not a symbolic link.",
        );
        expect(await readFile(join(outside.path, "marker"), "utf8")).toBe(
          "unchanged",
        );
        await expectMissing(join(outside.path, "statecraft.json"));
      } finally {
        await project.cleanup();
        await outside.cleanup();
      }
    },
  );

  it.skipIf(process.platform === "win32")(
    "rejects symbolic-link report targets without modifying their destination",
    async () => {
      const project = await temporaryProject();
      const outside = await temporaryProject();
      const reportRoot = join(project.path, ".statecraft/report");
      const outsideReport = join(outside.path, "statecraft.json");

      try {
        await mkdir(reportRoot, { recursive: true });
        await writeFile(outsideReport, "outside report");
        await symlink(outsideReport, join(reportRoot, "statecraft.json"));

        await expect(
          runPersistedScenarioCells([], {
            baseURL,
            projectDirectory: project.path,
            scenarioBaseDirectory,
          }),
        ).rejects.toThrow(
          ".statecraft/report/statecraft.json must be a regular file, not a symbolic link.",
        );
        expect(await readFile(outsideReport, "utf8")).toBe("outside report");
        await expectMissing(
          join(project.path, ".statecraft/.runner-persistence-lock"),
        );
      } finally {
        await project.cleanup();
        await outside.cleanup();
      }
    },
  );

  it.skipIf(process.platform === "win32")(
    "rejects symbolic-link HTML targets without modifying their destination",
    async () => {
      const project = await temporaryProject();
      const outside = await temporaryProject();
      const reportRoot = join(project.path, ".statecraft/report");
      const outsideHtml = join(outside.path, "index.html");

      try {
        await mkdir(reportRoot, { recursive: true });
        await writeFile(outsideHtml, "outside HTML");
        await symlink(outsideHtml, join(reportRoot, "index.html"));

        await expect(
          runPersistedScenarioCells([], {
            baseURL,
            projectDirectory: project.path,
            scenarioBaseDirectory,
          }),
        ).rejects.toThrow(
          ".statecraft/report/index.html must be a regular file, not a symbolic link.",
        );
        expect(await readFile(outsideHtml, "utf8")).toBe("outside HTML");
        await expectMissing(
          join(project.path, ".statecraft/.runner-persistence-lock"),
        );
      } finally {
        await project.cleanup();
        await outside.cleanup();
      }
    },
  );

  it.skipIf(process.platform === "win32")(
    "rejects symbolic-link report directories without writing through them",
    async () => {
      const project = await temporaryProject();
      const outside = await temporaryProject();
      const statecraftRoot = join(project.path, ".statecraft");
      const marker = join(outside.path, "marker");

      try {
        await mkdir(statecraftRoot);
        await writeFile(marker, "unchanged");
        await symlink(outside.path, join(statecraftRoot, "report"));

        await expect(
          runPersistedScenarioCells([], {
            baseURL,
            projectDirectory: project.path,
            scenarioBaseDirectory,
          }),
        ).rejects.toThrow(
          "report must be a real directory, not a symbolic link.",
        );
        expect(await readFile(marker, "utf8")).toBe("unchanged");
        await expectMissing(join(outside.path, "statecraft.json"));
      } finally {
        await project.cleanup();
        await outside.cleanup();
      }
    },
  );

  it("does not remove a lock owned by another persistence run", async () => {
    const project = await temporaryProject();
    const lock = join(
      project.path,
      ".statecraft/.runner-persistence-lock",
    );

    try {
      await mkdir(lock, { recursive: true });
      await writeFile(
        join(lock, "owner.json"),
        `${JSON.stringify({
          phase: "capture",
          pid: process.pid,
          schemaVersion: 1,
          token: "other-live-run",
        })}\n`,
      );
      await expect(
        runPersistedScenarioCells(persistenceCells(["clean-after"]), {
          baseURL,
          launchOptions: {
            executablePath: join(project.path, "missing-chromium"),
          },
          projectDirectory: project.path,
          scenarioBaseDirectory,
        }),
      ).rejects.toThrow("Another result-persistence run is active");
      expect((await stat(lock)).isDirectory()).toBe(true);
    } finally {
      await chmod(lock, 0o700).catch(() => undefined);
      await project.cleanup();
    }
  });

  it("refuses to release a lock after its durable owner token changes", async () => {
    const project = await temporaryProject();

    try {
      const lock = await acquirePersistenceLock(project.path);
      await writeFile(
        join(lock.directory, "owner.json"),
        `${JSON.stringify({
          pid: process.pid,
          schemaVersion: 1,
          token: "replacement-owner",
        })}\n`,
      );

      await expect(releasePersistenceLock(lock)).rejects.toThrow(
        "Result-persistence lock ownership changed before cleanup.",
      );
      expect((await stat(lock.directory)).isDirectory()).toBe(true);
    } finally {
      await project.cleanup();
    }
  });

  it("recovers an abandoned capture-phase lock before running", async () => {
    const project = await temporaryProject();
    const lock = join(project.path, ".statecraft/.runner-persistence-lock");

    try {
      await mkdir(lock, { recursive: true });
      await mkdir(
        join(project.path, ".statecraft/.runner-persistence-stage-abandoned"),
      );
      await writeFile(
        join(lock, "owner.json"),
        `${JSON.stringify({
          phase: "capture",
          pid: 2_147_483_647,
          schemaVersion: 1,
          token: "abandoned-run",
        })}\n`,
      );

      const run = await runPersistedScenarioCells([], {
        baseURL,
        projectDirectory: project.path,
        scenarioBaseDirectory,
      });
      expect(run.report.executions).toEqual([]);
      await expectMissing(lock);
      await expectMissing(
        join(project.path, ".statecraft/.runner-persistence-stage-abandoned"),
      );
      expect(
        (await readdir(join(project.path, ".statecraft"))).some((entry) =>
          entry.startsWith(".runner-persistence-lock.claimed-"),
        ),
      ).toBe(true);
    } finally {
      await project.cleanup();
    }
  });

  it.each(["publishing", "recovery"] as const)(
    "preserves abandoned %s-phase recovery state",
    async (phase) => {
      const project = await temporaryProject();
      const lock = join(project.path, ".statecraft/.runner-persistence-lock");

      try {
        await mkdir(lock, { recursive: true });
        await writeFile(
          join(lock, "owner.json"),
          `${JSON.stringify({
            pid: 2_147_483_647,
            schemaVersion: 1,
            token: `abandoned-${phase}-run`,
          })}\n`,
        );
        await writeFile(join(lock, phase), `${phase}\n`);

        await expect(
          runPersistedScenarioCells([], {
            baseURL,
            launchOptions: {
              executablePath: join(project.path, "missing-chromium"),
            },
            projectDirectory: project.path,
            scenarioBaseDirectory,
          }),
        ).rejects.toThrow(
          ".statecraft contains recovery state from an interrupted result-persistence run.",
        );
        expect((await stat(lock)).isDirectory()).toBe(true);
        expect(await readFile(join(lock, phase), "utf8")).toBe(`${phase}\n`);
      } finally {
        await project.cleanup();
      }
    },
  );

  it("allows only one concurrent recovery claimant for an abandoned lock", async () => {
    const project = await temporaryProject();
    const lock = join(project.path, ".statecraft/.runner-persistence-lock");

    try {
      await mkdir(lock, { recursive: true });
      await writeFile(
        join(lock, "owner.json"),
        `${JSON.stringify({
          pid: 2_147_483_647,
          schemaVersion: 1,
          token: "shared-abandoned-run",
        })}\n`,
      );

      const attempts = await Promise.allSettled([
        acquirePersistenceLock(project.path),
        acquirePersistenceLock(project.path),
      ]);
      expect(attempts.map(({ status }) => status).sort()).toEqual([
        "fulfilled",
        "rejected",
      ]);
      const acquired = attempts.find(
        (attempt): attempt is PromiseFulfilledResult<
          Awaited<ReturnType<typeof acquirePersistenceLock>>
        > => attempt.status === "fulfilled",
      );
      expect(acquired).toBeDefined();
      expect(
        JSON.parse(await readFile(join(lock, "owner.json"), "utf8")),
      ).toMatchObject({ token: acquired?.value.token });
    } finally {
      await project.cleanup();
    }
  });

  it("derives one permanent takeover claim for each observed stale owner", () => {
    const lock = "/project/.statecraft/.runner-persistence-lock";
    const first = takeoverClaimPath(lock, "observed-owner");

    expect(takeoverClaimPath(lock, "observed-owner")).toBe(first);
    expect(takeoverClaimPath(lock, "newer-owner")).not.toBe(first);
    expect(first).toMatch(
      /^\/project\/\.statecraft\/\.runner-persistence-lock\.claimed-[a-f0-9]{64}$/,
    );
  });

  it("normalizes unexpected lifecycle failures into sanitized core results", () => {
    const cell = persistenceCells(["clean-after"])[0]!;
    const outcome = Object.freeze({
      cell,
      reason: Object.create(null),
      status: "rejected" as const,
    });

    expect(executionArtifactForOutcome(outcome, baseURL)).toEqual({
      result: expect.objectContaining({
        diagnostics: {
          consoleErrors: [],
          failedRequests: [],
          navigationStatus: null,
          pageErrors: [],
        },
        durationMs: 0,
        failures: [
          { code: "INTERNAL_ERROR", message: "[unprintable thrown value]" },
        ],
        screenshotPath: null,
        status: "failed",
        url: "https://statecraft.invalid/capture?source=%5BREDACTED%5D",
      }),
      screenshot: null,
    });
  });

  it("restores artifacts before making the previous JSON and HTML visible", async () => {
    const calls: string[] = [];
    const errors = await recoverPublication(
      {
        existingArtifacts: "existing-artifacts",
        existingHtml: "existing-html",
        existingReport: "existing-report",
        previousArtifacts: "previous-artifacts",
        previousHtml: "previous-html",
        previousReport: "previous-report",
      },
      {
        movedPreviousArtifacts: true,
        movedPreviousHtml: true,
        movedPreviousReport: true,
        publishedArtifacts: true,
        publishedHtml: true,
        publishedReport: true,
      },
      {
        remove: async (path) => {
          calls.push(`remove:${path}`);
        },
        rename: async (source, destination) => {
          calls.push(`rename:${source}:${destination}`);
        },
      },
    );

    expect(calls).toEqual([
      "remove:existing-html",
      "remove:existing-report",
      "remove:existing-artifacts",
      "rename:previous-artifacts:existing-artifacts",
      "rename:previous-report:existing-report",
      "rename:previous-html:existing-html",
    ]);
    expect(errors).toEqual([]);
  });

  it("keeps the previous report hidden when artifact recovery fails", async () => {
    const calls: string[] = [];
    const removalFailure = new Error("artifact removal failed");
    const errors = await recoverPublication(
      {
        existingArtifacts: "existing-artifacts",
        existingHtml: "existing-html",
        existingReport: "existing-report",
        previousArtifacts: "previous-artifacts",
        previousHtml: "previous-html",
        previousReport: "previous-report",
      },
      {
        movedPreviousArtifacts: true,
        movedPreviousHtml: true,
        movedPreviousReport: true,
        publishedArtifacts: true,
        publishedHtml: true,
        publishedReport: true,
      },
      {
        remove: async (path) => {
          calls.push(`remove:${path}`);
          if (path === "existing-artifacts") {
            throw removalFailure;
          }
        },
        rename: async (source, destination) => {
          calls.push(`rename:${source}:${destination}`);
        },
      },
    );

    expect(calls).toEqual([
      "remove:existing-html",
      "remove:existing-report",
      "remove:existing-artifacts",
    ]);
    expect(errors).toEqual([removalFailure]);
  });

  it("preserves staging data and the lock when publication recovery fails", async () => {
    const project = await temporaryProject();
    try {
      const initial = await runPersistedScenarioCells([], {
        baseURL,
        generatedAt: new Date("2026-08-20T15:02:00.000Z"),
        projectDirectory: project.path,
        scenarioBaseDirectory,
      });
      const lock = await acquirePersistenceLock(project.path);
      const publishFailure = new Error("report publication failed");
      const recoveryFailure = new Error("artifact recovery failed");
      let renameCalls = 0;

      await expect(
        persistReport(project.path, lock, initial.report, [], {
          remove: rm,
          rename: async (source, destination) => {
            renameCalls += 1;
            if (renameCalls === 4) {
              throw publishFailure;
            }
            if (renameCalls === 5) {
              throw recoveryFailure;
            }
            await fsRename(source, destination);
          },
        }),
      ).rejects.toMatchObject({
        cause: publishFailure,
        errors: [recoveryFailure],
      });

      expect(lock.preserve).toBe(true);
      expect(await readFile(join(lock.directory, "recovery"), "utf8")).toBe(
        "recovery\n",
      );
      const recoveryDirectory = (await readdir(
        join(project.path, ".statecraft"),
      )).find(
        (entry) =>
          entry !== ".runner-persistence-lock" &&
          entry.startsWith(".runner-persistence-stage-"),
      );
      expect(recoveryDirectory).toBeDefined();
      expect(
        await readFile(
          join(
            project.path,
            ".statecraft",
            recoveryDirectory ?? "missing",
            "previous-statecraft.json",
          ),
          "utf8",
        ),
      ).toBe(serializeReport(initial.report));
      await expectMissing(
        join(project.path, ".statecraft/report/statecraft.json"),
      );
    } finally {
      await project.cleanup();
    }
  });

  it("restores the previous JSON and HTML when final HTML publication fails", async () => {
    const project = await temporaryProject();
    let lock: Awaited<ReturnType<typeof acquirePersistenceLock>> | undefined;
    try {
      const initial = await runPersistedScenarioCells([], {
        baseURL,
        generatedAt: new Date("2026-08-20T15:02:30.000Z"),
        projectDirectory: project.path,
        scenarioBaseDirectory,
      });
      const next = parseReport({
        ...initial.report,
        generatedAt: "2026-08-20T15:02:31.000Z",
      });
      lock = await acquirePersistenceLock(project.path);
      let rejectedHtml = false;

      await expect(
        persistReport(project.path, lock, next, [], {
          remove: rm,
          rename: async (source, destination) => {
            if (
              !rejectedHtml &&
              String(source).includes(".runner-persistence-stage-") &&
              String(source).endsWith("index.html")
            ) {
              rejectedHtml = true;
              throw new Error("HTML publication failed");
            }
            await fsRename(source, destination);
          },
        }),
      ).rejects.toThrow("HTML publication failed");

      expect(
        parseReport(
          JSON.parse(
            await readFile(
              join(project.path, ".statecraft/report/statecraft.json"),
              "utf8",
            ),
          ),
        ),
      ).toEqual(initial.report);
      const html = await readFile(
        join(project.path, ".statecraft/report/index.html"),
        "utf8",
      );
      expect(html).toContain("2026-08-20T15:02:30.000Z");
      expect(html).not.toContain("2026-08-20T15:02:31.000Z");
      expect(lock.preserve).toBe(false);
    } finally {
      if (lock !== undefined) {
        await releasePersistenceLock(lock).catch(() => undefined);
      }
      await project.cleanup();
    }
  });

  it("preserves recovery state when published staging cleanup fails", async () => {
    const project = await temporaryProject();
    try {
      const initial = await runPersistedScenarioCells([], {
        baseURL,
        generatedAt: new Date("2026-08-20T15:03:00.000Z"),
        projectDirectory: project.path,
        scenarioBaseDirectory,
      });
      const lock = await acquirePersistenceLock(project.path);
      const cleanupFailure = new Error("staging cleanup failed");

      await expect(
        persistReport(
          project.path,
          lock,
          initial.report,
          [],
          {
            remove: async (path, options) => {
              if (String(path).includes(".runner-persistence-stage-")) {
                throw cleanupFailure;
              }
              await rm(path, options);
            },
            rename: fsRename,
          },
        ),
      ).rejects.toMatchObject({ errors: [cleanupFailure] });

      expect(lock.preserve).toBe(true);
      expect(await readFile(join(lock.directory, "recovery"), "utf8")).toBe(
        "recovery\n",
      );
      expect(
        (await readdir(join(project.path, ".statecraft"))).some((entry) =>
          entry.startsWith(".runner-persistence-stage-"),
        ),
      ).toBe(true);
      expect(
        parseReport(
          JSON.parse(
            await readFile(
              join(project.path, ".statecraft/report/statecraft.json"),
              "utf8",
            ),
          ),
        ),
      ).toEqual(initial.report);
    } finally {
      await project.cleanup();
    }
  });

  it("rejects malformed matrix cells before launching a browser", async () => {
    const project = await temporaryProject();
    try {
      const validCell = persistenceCells(["clean-after"])[0]!;
      const invalidCell: MatrixCell = {
        ...validCell,
        route: { ...validCell.route, path: "//outside.invalid/capture" },
      };
      await expect(
        runPersistedScenarioCells([invalidCell], {
          baseURL,
          projectDirectory: project.path,
          scenarioBaseDirectory,
        }),
      ).rejects.toThrow("Invalid Statecraft execution result.");
      await expectMissing(join(project.path, ".statecraft"));
    } finally {
      await project.cleanup();
    }
  });

  it("rejects conflicting matrix coordinates before launching a browser", async () => {
    const project = await temporaryProject();
    try {
      const cell = persistenceCells(["clean-after"])[0]!;
      await expect(
        runPersistedScenarioCells([cell, cell], {
          baseURL,
          projectDirectory: project.path,
          scenarioBaseDirectory,
        }),
      ).rejects.toThrow("Invalid Statecraft report.");
      await expectMissing(join(project.path, ".statecraft"));
    } finally {
      await project.cleanup();
    }
  });

  it("rejects missing and non-directory project roots before writing", async () => {
    const project = await temporaryProject();
    const file = join(project.path, "not-a-directory");
    const missing = join(project.path, "missing");
    try {
      await writeFile(file, "file");
      await expect(
        runPersistedScenarioCells([], {
          baseURL,
          projectDirectory: file,
          scenarioBaseDirectory,
        }),
      ).rejects.toThrow(
        "projectDirectory must refer to an existing directory.",
      );
      await expect(
        runPersistedScenarioCells([], {
          baseURL,
          projectDirectory: missing,
          scenarioBaseDirectory,
        }),
      ).rejects.toMatchObject({ code: "ENOENT" });
    } finally {
      await project.cleanup();
    }
  });

  it("rejects invalid deterministic timestamps before launching a browser", async () => {
    const project = await temporaryProject();
    try {
      const invalidDate = new Date(Number.NaN);
      await expect(
        runPersistedScenarioCells(persistenceCells(["clean-after"]), {
          baseURL,
          generatedAt: invalidDate,
          projectDirectory: project.path,
          scenarioBaseDirectory,
        }),
      ).rejects.toThrow(RangeError);
      await expectMissing(join(project.path, ".statecraft"));
    } finally {
      await project.cleanup();
    }
  });
});

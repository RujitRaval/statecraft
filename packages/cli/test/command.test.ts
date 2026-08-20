import {
  lstat,
  mkdtemp,
  readFile,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { parseReport } from "@statecraft/core";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ScanOptions, ScanResult } from "../src/scan.js";
import type {
  OpenReportOptions,
  OpenReportResult,
} from "../src/open.js";

const openReportMock = vi.hoisted(() =>
  vi.fn<(options?: OpenReportOptions) => Promise<OpenReportResult>>(),
);

const scanProjectMock = vi.hoisted(() =>
  vi.fn<(options?: ScanOptions) => Promise<ScanResult>>(),
);

vi.mock("../src/init.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("../src/init.js")>();
  return {
    ...original,
    initProject: vi.fn(async (options: { readonly cwd?: string }) => {
      if (options.cwd === "write-failure") {
        throw new original.InitError(
          "INIT_WRITE_FAILED",
          "Statecraft could not create every starter file.",
          { paths: ["/project/statecraft.config.ts", "/project/statecraft"] },
        );
      }
      return original.initProject(options);
    }),
  };
});

vi.mock("../src/scan.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("../src/scan.js")>();
  return { ...original, scanProject: scanProjectMock };
});

vi.mock("../src/open.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("../src/open.js")>();
  return { ...original, openReport: openReportMock };
});

import { runCli } from "../src/command.js";

const temporaryProjects: string[] = [];

async function temporaryProject(): Promise<string> {
  const project = await realpath(
    await mkdtemp(join(tmpdir(), "statecraft-cli-command-")),
  );
  temporaryProjects.push(project);
  return project;
}

afterEach(async () => {
  openReportMock.mockReset();
  scanProjectMock.mockReset();
  await Promise.all(
    temporaryProjects.splice(0).map((project) =>
      rm(project, { force: true, recursive: true }),
    ),
  );
});

function completedScan(
  status: "failed" | "passed",
  failureMessage = "Expected heading.",
): ScanResult {
  const passed = status === "passed";
  const covered = passed ? 1 : 0;
  return Object.freeze({
    configPath: "/project/statecraft.config.ts",
    report: parseReport({
      executions: [
        {
          diagnostics: {
            consoleErrors: [],
            failedRequests: [],
            navigationStatus: 200,
            pageErrors: [],
          },
          durationMs: 25,
          failures: passed
            ? []
            : [{ code: "ASSERTION_FAILED", message: failureMessage }],
          routeId: "dashboard",
          routePath: "/dashboard",
          scenarioSource: "./dashboard.mjs",
          screenshotPath: passed
            ? ".statecraft/artifacts/dashboard/success/desktop-light.png"
            : null,
          stateId: "success",
          status,
          theme: "light",
          url: "https://example.test/dashboard",
          viewport: { height: 900, width: 1440 },
          viewportId: "desktop",
        },
      ],
      generatedAt: "2026-08-20T18:00:00.000Z",
      project: { baseURL: "https://example.test" },
      schemaVersion: 1,
      summary: {
        coverage: {
          execution: { covered, percentage: covered * 100, total: 1 },
          responsive: { covered, percentage: covered * 100, total: 1 },
          state: { covered, percentage: covered * 100, total: 1 },
          theme: { covered, percentage: covered * 100, total: 1 },
        },
        durationMs: 25,
        executions: 1,
        failed: passed ? 0 : 1,
        passed: passed ? 1 : 0,
        routes: 1,
        states: 1,
      },
    }),
    htmlReportPath: ".statecraft/report/index.html",
    reportPath: ".statecraft/report/statecraft.json",
  });
}

function outputCapture(): {
  readonly messages: string[];
  readonly write: (message: string) => void;
} {
  const messages: string[] = [];
  return {
    messages,
    write(message: string): void {
      messages.push(message);
    },
  };
}

describe("runCli", () => {
  it.each(["--help", "-h", "help"])(
    "prints help for %s without touching the filesystem",
    async (argument) => {
    const project = await temporaryProject();
    const stdout = outputCapture();
    const stderr = outputCapture();

    await expect(
      runCli({
        args: [argument],
        cwd: project,
        stderr: stderr.write,
        stdout: stdout.write,
      }),
    ).resolves.toBe(0);
    expect(stdout.messages.join("")).toContain("statecraft init");
    expect(stdout.messages.join("")).toContain("statecraft open");
    expect(stdout.messages.join("")).toContain(
      "persist screenshots, JSON, and HTML",
    );
    expect(stderr.messages).toEqual([]);
    await expect(
      lstat(join(project, "statecraft.config.ts")),
    ).rejects.toMatchObject({ code: "ENOENT" });
    },
  );

  it("returns setup exit code 2 for missing and unsupported commands", async () => {
    const stderr = outputCapture();

    await expect(runCli({ args: [], stderr: stderr.write })).resolves.toBe(2);
    await expect(
      runCli({ args: ["unknown"], stderr: stderr.write }),
    ).resolves.toBe(2);
    expect(stderr.messages.join("")).toContain("Missing command.");
    expect(stderr.messages.join("")).toContain("Unknown command: unknown");
  });

  it("opens the latest report and prints its stable relative path", async () => {
    const stdout = outputCapture();
    const stderr = outputCapture();
    openReportMock.mockResolvedValue({
      projectRoot: "/project",
      reportPath: "/project/.statecraft/report/index.html",
      reportRelativePath: ".statecraft/report/index.html",
    });

    await expect(
      runCli({
        args: ["open"],
        cwd: "/project",
        stderr: stderr.write,
        stdout: stdout.write,
      }),
    ).resolves.toBe(0);
    expect(openReportMock).toHaveBeenCalledWith({ cwd: "/project" });
    expect(stdout.messages.join("")).toBe(
      "Opened .statecraft/report/index.html.\n",
    );
    expect(stderr.messages).toEqual([]);
  });

  it("prints expected open failures and returns setup exit code 2", async () => {
    const stderr = outputCapture();
    const { OpenReportError } = await import("../src/open.js");
    openReportMock.mockRejectedValue(
      new OpenReportError(
        "OPEN_REPORT_NOT_FOUND",
        "No report\nfound.",
        "/project/.statecraft/report/index.html",
      ),
    );

    await expect(
      runCli({ args: ["open"], stderr: stderr.write }),
    ).resolves.toBe(2);
    expect(stderr.messages.join("")).toBe("No report\\nfound.\n");
  });

  it("rejects open arguments before locating a report", async () => {
    const stderr = outputCapture();

    await expect(
      runCli({ args: ["open", "--latest"], stderr: stderr.write }),
    ).resolves.toBe(2);
    expect(stderr.messages.join("")).toContain(
      "The open command does not accept arguments: --latest",
    );
    expect(openReportMock).not.toHaveBeenCalled();
  });

  it("does not expose unexpected open failures", async () => {
    const stderr = outputCapture();
    openReportMock.mockRejectedValue(new Error("secret internal detail"));

    await expect(
      runCli({ args: ["open"], stderr: stderr.write }),
    ).resolves.toBe(2);
    expect(stderr.messages.join("")).toBe(
      "Statecraft could not open the latest report unexpectedly.\n",
    );
  });

  it("rejects init arguments before touching the filesystem", async () => {
    const project = await temporaryProject();
    const stderr = outputCapture();

    await expect(
      runCli({
        args: ["init", "--force"],
        cwd: project,
        stderr: stderr.write,
      }),
    ).resolves.toBe(2);
    expect(stderr.messages.join("")).toContain(
      "The init command does not accept arguments: --force",
    );
    await expect(
      lstat(join(project, "statecraft.config.ts")),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("initializes a project and prints exact next steps", async () => {
    const project = await temporaryProject();
    const stdout = outputCapture();
    const stderr = outputCapture();

    await expect(
      runCli({
        args: ["init"],
        cwd: project,
        stderr: stderr.write,
        stdout: stdout.write,
      }),
    ).resolves.toBe(0);
    expect(stdout.messages.join("")).toBe(`Statecraft initialized.

Created:
  statecraft.config.ts
  statecraft/scenarios/home/success.ts

Next:
  1. Update statecraft.config.ts for your app.
  2. Add scenario hooks in statecraft/scenarios/home/success.ts.
  3. Commit both starter files to version control.
`);
    expect(stderr.messages).toEqual([]);
  });

  it("reports conflicts without replacing existing content", async () => {
    const project = await temporaryProject();
    const configPath = join(project, "statecraft.config.ts");
    const stderr = outputCapture();
    await writeFile(configPath, "keep", "utf8");

    await expect(
      runCli({
        args: ["init"],
        cwd: project,
        stderr: stderr.write,
      }),
    ).resolves.toBe(2);
    expect(stderr.messages.join("")).toContain(
      "Statecraft initialization conflicts with existing paths:",
    );
    await expect(readFile(configPath, "utf8")).resolves.toBe("keep");
  });

  it("reports targets for write failures", async () => {
    const stderr = outputCapture();

    await expect(
      runCli({
        args: ["init"],
        cwd: "write-failure",
        stderr: stderr.write,
      }),
    ).resolves.toBe(2);
    expect(stderr.messages.join("")).toBe(`Statecraft could not create every starter file.

Targets:
  /project/statecraft.config.ts
  /project/statecraft
`);
  });

  it("parses scan options and prints a passing terminal summary", async () => {
    const stdout = outputCapture();
    const stderr = outputCapture();
    scanProjectMock.mockResolvedValue(completedScan("passed"));

    await expect(
      runCli({
        args: [
          "scan",
          "--route",
          "dashboard",
          "--headed",
          "--config",
          "./custom.mjs",
        ],
        cwd: "/project",
        stderr: stderr.write,
        stdout: stdout.write,
      }),
    ).resolves.toBe(0);
    expect(scanProjectMock).toHaveBeenCalledWith({
      configPath: "./custom.mjs",
      cwd: "/project",
      headed: true,
      routeId: "dashboard",
    });
    expect(stdout.messages.join("")).toBe(`Statecraft

Dashboard
  ✓ success · desktop · light

Coverage: 100%
Report: .statecraft/report/index.html
All 1 execution passed.
`);
    expect(stderr.messages).toEqual([]);
  });

  it("returns exit code 1 and prints failures after a completed scan", async () => {
    const stdout = outputCapture();
    scanProjectMock.mockResolvedValue(completedScan("failed"));

    await expect(
      runCli({ args: ["scan"], stdout: stdout.write }),
    ).resolves.toBe(1);
    expect(stdout.messages.join("")).toContain(
      "ASSERTION_FAILED: Expected heading.",
    );
    expect(stdout.messages.join("")).toContain("1 of 1 execution failed.");
  });

  it("escapes terminal controls in failure messages", async () => {
    const stdout = outputCapture();
    scanProjectMock.mockResolvedValue(
      completedScan("failed", "first line\n\u001b[2Jsecond line\tend"),
    );

    await expect(
      runCli({ args: ["scan"], stdout: stdout.write }),
    ).resolves.toBe(1);
    expect(stdout.messages.join("")).toContain(
      "ASSERTION_FAILED: first line\\n\\u{001b}[2Jsecond line\\tend",
    );
    expect(stdout.messages.join("")).not.toContain("\u001b");
  });

  it("prints expected scan failures and returns setup exit code 2", async () => {
    const stderr = outputCapture();
    scanProjectMock.mockRejectedValue(
      new (await import("../src/scan.js")).ScanError(
        "SCAN_ROUTE_NOT_FOUND",
        "Configured route not found: missing",
        "missing",
      ),
    );

    await expect(
      runCli({
        args: ["scan", "--route", "missing"],
        stderr: stderr.write,
      }),
    ).resolves.toBe(2);
    expect(stderr.messages.join("")).toBe(
      "Configured route not found: missing\n",
    );
  });

  it("does not expose unexpected scan errors", async () => {
    const stderr = outputCapture();
    scanProjectMock.mockRejectedValue(new Error("secret internal detail"));

    await expect(
      runCli({ args: ["scan"], stderr: stderr.write }),
    ).resolves.toBe(2);
    expect(stderr.messages.join("")).toBe(
      "Statecraft scan failed unexpectedly.\n",
    );
  });

  it.each([
    [["scan", "--config"], "The --config option requires a value."],
    [["scan", "--route", "--headed"], "The --route option requires a value."],
    [["scan", "--headed", "--headed"], "The --headed option can be specified only once."],
    [["scan", "--config", "a", "--config", "b"], "The --config option can be specified only once."],
    [["scan", "--route", "a", "--route", "b"], "The --route option can be specified only once."],
    [["scan", "--unknown"], "Unknown scan option: --unknown"],
    [["scan", "positional"], "Unknown scan option: positional"],
  ] as const)("rejects invalid scan arguments %#", async (args, message) => {
    const stderr = outputCapture();

    await expect(runCli({ args, stderr: stderr.write })).resolves.toBe(2);
    expect(stderr.messages.join("")).toContain(message);
    expect(scanProjectMock).not.toHaveBeenCalled();
  });
});

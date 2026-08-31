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

import { parseReport } from "uiwitness-core";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CheckOptions, CheckResult } from "../src/check.js";
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

const checkPublicSiteMock = vi.hoisted(() =>
  vi.fn<(options: CheckOptions) => Promise<CheckResult>>(),
);

vi.mock("../src/init.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("../src/init.js")>();
  return {
    ...original,
    initProject: vi.fn(async (options: { readonly cwd?: string }) => {
      if (options.cwd === "write-failure") {
        throw new original.InitError(
          "INIT_WRITE_FAILED",
          "UIWitness could not create every starter file.",
          { paths: ["/project/uiwitness.config.mts", "/project/uiwitness"] },
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

vi.mock("../src/check.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("../src/check.js")>();
  return { ...original, checkPublicSite: checkPublicSiteMock };
});

vi.mock("../src/open.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("../src/open.js")>();
  return { ...original, openReport: openReportMock };
});

import { runCli } from "../src/command.js";

const temporaryProjects: string[] = [];

async function temporaryProject(): Promise<string> {
  const project = await realpath(
    await mkdtemp(join(tmpdir(), "uiwitness-cli-command-")),
  );
  temporaryProjects.push(project);
  return project;
}

function credentialedCheckUrl(): string {
  const url = new URL("https://example.test");
  url.username = "fixture-user";
  url.password = "fixture-password";
  return url.toString();
}

afterEach(async () => {
  checkPublicSiteMock.mockReset();
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
    configPath: "/project/uiwitness.config.ts",
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
            ? ".uiwitness/artifacts/dashboard/success/desktop-light.png"
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
    htmlReportPath: ".uiwitness/report/index.html",
    reportPath: ".uiwitness/report/uiwitness.json",
  });
}

function completedCheck(
  status: "failed" | "passed",
  setup = false,
): CheckResult {
  const passed = status === "passed";
  return Object.freeze({
    discovery: Object.freeze({
      attemptedPages: 2,
      baseURL: "https://example.test/",
      routes: Object.freeze([
        Object.freeze({ path: "/" }),
        Object.freeze({ path: "/pricing" }),
      ]),
      skippedPages: 1,
      truncatedAnchorPages: 0,
    }),
    report: parseReport({
      executions: [
        ...["light", "dark"].flatMap((theme) =>
          ["mobile", "desktop"].map((viewportId) => ({
            diagnostics: {
              consoleErrors: [],
              failedRequests: [],
              navigationStatus: 200,
              pageErrors: [],
            },
            durationMs: 25,
            failures: [],
            routeId: "home-abc",
            routePath: "/",
            scenarioSource: "uiwitness:public-site",
            screenshotPath: `.uiwitness/artifacts/home-abc/public/${viewportId}-${theme}.png`,
            stateId: "public",
            status: "passed" as const,
            theme,
            url: "https://example.test/",
            viewport:
              viewportId === "mobile"
                ? { height: 844, width: 390 }
                : { height: 900, width: 1_440 },
            viewportId,
          })),
        ),
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
            : [
                {
                  code: "ASSERTION_FAILED",
                  message: "Page overflows\nby 4px.",
                },
              ],
          routeId: "pricing-def",
          routePath: "/pricing",
          scenarioSource: "uiwitness:public-site",
          screenshotPath: ".uiwitness/artifacts/pricing-def/public/mobile-light.png",
          stateId: "public",
          status,
          theme: "light",
          url: "https://example.test/pricing",
          viewport: { height: 844, width: 390 },
          viewportId: "mobile",
        },
      ],
      generatedAt: "2026-08-22T18:00:00.000Z",
      project: { baseURL: "https://example.test/" },
      schemaVersion: 1,
      summary: {
        coverage: {
          execution: {
            covered: passed ? 5 : 4,
            percentage: passed ? 100 : 80,
            total: 5,
          },
          responsive: {
            covered: passed ? 2 : 1,
            percentage: passed ? 100 : 50,
            total: 2,
          },
          state: {
            covered: passed ? 2 : 1,
            percentage: passed ? 100 : 50,
            total: 2,
          },
          theme: {
            covered: passed ? 2 : 1,
            percentage: passed ? 100 : 50,
            total: 2,
          },
        },
        durationMs: 125,
        executions: 5,
        failed: passed ? 0 : 1,
        passed: passed ? 5 : 4,
        routes: 2,
        states: 2,
      },
    }),
    htmlReportPath: ".uiwitness/report/index.html",
    reportPath: ".uiwitness/report/uiwitness.json",
    ...(setup
      ? {
          setup: Object.freeze({
            configPath: "/project/uiwitness.config.mts",
            files: Object.freeze([
              "/project/uiwitness.config.mts",
              "/project/uiwitness/scenarios/public/default.mts",
            ]),
            projectRoot: "/project",
            scenarioPath:
              "/project/uiwitness/scenarios/public/default.mts",
          }),
        }
      : {}),
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
    expect(stdout.messages.join("")).toContain("uiwitness init");
    expect(stdout.messages.join("")).toContain("uiwitness check <url>");
    expect(stdout.messages.join("")).toContain(
      "Check only websites you own or are authorized to test.",
    );
    expect(stdout.messages.join("")).toContain("uiwitness open");
    expect(stdout.messages.join("")).toContain(
      "persist screenshots, JSON, and HTML",
    );
    expect(stderr.messages).toEqual([]);
    await expect(
      lstat(join(project, "uiwitness.config.mts")),
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
      reportPath: "/project/.uiwitness/report/index.html",
      reportRelativePath: ".uiwitness/report/index.html",
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
      "Opened .uiwitness/report/index.html.\n",
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
        "/project/.uiwitness/report/index.html",
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
      "UIWitness could not open the latest report unexpectedly.\n",
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
      lstat(join(project, "uiwitness.config.mts")),
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
    expect(stdout.messages.join("")).toBe(`UIWitness initialized.

Created:
  uiwitness.config.mts
  uiwitness/scenarios/home/success.mts

Next:
  1. Update uiwitness.config.mts for your app.
  2. Add scenario hooks in uiwitness/scenarios/home/success.mts.
  3. Commit both starter files to version control.
`);
    expect(stderr.messages).toEqual([]);
  });

  it("reports conflicts without replacing existing content", async () => {
    const project = await temporaryProject();
    const configPath = join(project, "uiwitness.config.ts");
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
      "UIWitness initialization conflicts with existing paths:",
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
    expect(stderr.messages.join("")).toBe(`UIWitness could not create every starter file.

Targets:
  /project/uiwitness.config.mts
  /project/uiwitness
`);
  });

  it("parses check options and prints a passing public-site summary", async () => {
    const stdout = outputCapture();
    const stderr = outputCapture();
    checkPublicSiteMock.mockResolvedValue(completedCheck("passed"));

    await expect(
      runCli({
        args: [
          "check",
          "https://example.test/start?private=value#fragment",
          "--max-pages",
          "12",
          "--headed",
        ],
        cwd: "/project",
        stderr: stderr.write,
        stdout: stdout.write,
      }),
    ).resolves.toBe(0);
    expect(checkPublicSiteMock).toHaveBeenCalledWith({
      cwd: "/project",
      headed: true,
      maxPages: 12,
      url: "https://example.test/start?private=value#fragment",
      writeConfig: false,
    });
    expect(stdout.messages.join("")).toContain("UIWitness Quick Check");
    expect(stdout.messages.join("")).toContain(
      "Site: https://example.test/",
    );
    expect(stdout.messages.join("")).toContain(
      "Pages: 2 discovered · 2 scanned · 1 skipped",
    );
    expect(stdout.messages.join("")).toContain(
      "Report: .uiwitness/report/index.html",
    );
    expect(stdout.messages.join("")).toContain("All 5 checks passed.");
    expect(stdout.messages.join("")).toContain(
      "npx uiwitness check https://example.test/ --write-config",
    );
    expect(stderr.messages).toEqual([]);
  });

  it("writes the discovered project setup and prints the configured-scan handoff", async () => {
    const stdout = outputCapture();
    const stderr = outputCapture();
    checkPublicSiteMock.mockResolvedValue(completedCheck("passed", true));

    await expect(
      runCli({
        args: ["check", "https://example.test", "--write-config"],
        cwd: "/project",
        stderr: stderr.write,
        stdout: stdout.write,
      }),
    ).resolves.toBe(0);
    expect(checkPublicSiteMock).toHaveBeenCalledWith({
      cwd: "/project",
      headed: false,
      maxPages: undefined,
      url: "https://example.test",
      writeConfig: true,
    });
    expect(stdout.messages.join("")).toContain(
      "Saved the discovered public surface.",
    );
    expect(stdout.messages.join("")).toContain("uiwitness.config.mts");
    expect(stdout.messages.join("")).toContain(
      "uiwitness/scenarios/public/default.mts",
    );
    expect(stdout.messages.join("")).toContain(
      "Next: add real product states, then run `npx uiwitness scan`.",
    );
    expect(stdout.messages.join("")).not.toContain(
      "npx uiwitness check https://example.test/ --write-config",
    );
    expect(stderr.messages).toEqual([]);
  });

  it("returns exit code 1 and prints sanitized public-site failures", async () => {
    const stdout = outputCapture();
    checkPublicSiteMock.mockResolvedValue(completedCheck("failed"));

    await expect(
      runCli({
        args: ["check", "https://example.test"],
        stdout: stdout.write,
      }),
    ).resolves.toBe(1);
    expect(stdout.messages.join("")).toContain(
      "mobile · light · ASSERTION_FAILED: Page overflows\\nby 4px.",
    );
    expect(stdout.messages.join("")).toContain("1 issue across 5 checks.");
    expect(stdout.messages.join("")).toContain("1 of 5 checks failed.");
    expect(stdout.messages.join("")).not.toContain("Page overflows\nby 4px.");
  });

  it("prints expected check failures without terminal controls", async () => {
    const stderr = outputCapture();
    const { CheckError } = await import("../src/check.js");
    checkPublicSiteMock.mockRejectedValue(
      new CheckError(
        "CHECK_DISCOVERY_FAILED",
        "Starting page\nwas not ready.\u001b[2J",
      ),
    );

    await expect(
      runCli({
        args: ["check", "https://example.test"],
        stderr: stderr.write,
      }),
    ).resolves.toBe(2);
    expect(stderr.messages.join("")).toBe(
      "Starting page\\nwas not ready.\\u{001b}[2J\n",
    );
  });

  it("does not expose unexpected check errors", async () => {
    const stderr = outputCapture();
    checkPublicSiteMock.mockRejectedValue(new TypeError("secret internal detail"));

    await expect(
      runCli({
        args: ["check", "https://example.test"],
        stderr: stderr.write,
      }),
    ).resolves.toBe(2);
    expect(stderr.messages.join("")).toBe(
      "UIWitness check failed unexpectedly.\n",
    );
  });

  it.each([
    [["check"], "The check command requires a public website URL."],
    [["check", "relative/path"], "The check URL must be a valid absolute HTTP(S) URL."],
    [["check", "file:///tmp/site"], "The check URL must be absolute HTTP(S) without credentials."],
    [["check", credentialedCheckUrl()], "The check URL must be absolute HTTP(S) without credentials."],
    [["check", "https://example.test", "https://other.test"], "The check command accepts exactly one URL."],
    [["check", "https://example.test", "--max-pages"], "The --max-pages option requires a value."],
    [["check", "https://example.test", "--max-pages", "0"], "The --max-pages option must be an integer between 1 and 20."],
    [["check", "https://example.test", "--max-pages", "21"], "The --max-pages option must be an integer between 1 and 20."],
    [["check", "https://example.test", "--max-pages", "5", "--max-pages", "6"], "The --max-pages option can be specified only once."],
    [["check", "https://example.test", "--headed", "--headed"], "The --headed option can be specified only once."],
    [["check", "https://example.test", "--write-config", "--write-config"], "The --write-config option can be specified only once."],
  ] as const)("rejects invalid check arguments %#", async (args, message) => {
    const stderr = outputCapture();

    await expect(runCli({ args, stderr: stderr.write })).resolves.toBe(2);
    expect(stderr.messages.join("")).toContain(message);
    expect(checkPublicSiteMock).not.toHaveBeenCalled();
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
    expect(stdout.messages.join("")).toBe(`UIWitness

Dashboard
  ✓ success · desktop · light

Coverage: 100%
Report: .uiwitness/report/index.html
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
      "UIWitness scan failed unexpectedly.\n",
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

import {
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EventEmitter } from "node:events";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  OpenReportError,
  openReport,
  openReportWithLauncher,
} from "../src/open.js";
import {
  launchReportWithSpawn,
  reportOpenCommand,
} from "../src/launcher.js";

const projects: string[] = [];

async function temporaryProject(): Promise<string> {
  const project = await realpath(
    await mkdtemp(join(tmpdir(), "statecraft-cli-open-")),
  );
  projects.push(project);
  return project;
}

async function reportFixture(): Promise<{
  readonly project: string;
  readonly reportPath: string;
}> {
  const project = await temporaryProject();
  const reportDirectory = join(project, ".statecraft", "report");
  await mkdir(reportDirectory, { recursive: true });
  const reportPath = join(reportDirectory, "index.html");
  await writeFile(reportPath, "<!doctype html><title>Statecraft</title>", "utf8");
  return { project, reportPath };
}

afterEach(async () => {
  await Promise.all(
    projects.splice(0).map((project) =>
      rm(project, { force: true, recursive: true }),
    ),
  );
});

describe("openReport", () => {
  it("opens the canonical latest report without generating or changing it", async () => {
    const fixture = await reportFixture();
    const before = "<!doctype html><title>Statecraft</title>";
    const launcher = vi.fn(async () => undefined);

    await expect(
      openReportWithLauncher({ cwd: fixture.project }, launcher),
    ).resolves.toEqual({
      projectRoot: fixture.project,
      reportPath: fixture.reportPath,
      reportRelativePath: ".statecraft/report/index.html",
    });
    expect(launcher).toHaveBeenCalledOnce();
    expect(launcher).toHaveBeenCalledWith(fixture.reportPath);
    await expect(readFile(fixture.reportPath, "utf8")).resolves.toBe(before);
  });

  it("returns a useful not-found error when no HTML report exists", async () => {
    const project = await temporaryProject();
    const launcher = vi.fn(async () => undefined);

    const error = await openReportWithLauncher({ cwd: project }, launcher).catch(
      (cause: unknown) => cause,
    );

    expect(error).toBeInstanceOf(OpenReportError);
    expect(error).toMatchObject({
      code: "OPEN_REPORT_NOT_FOUND",
      reportPath: join(project, ".statecraft", "report", "index.html"),
    });
    expect((error as Error).message).toContain(
      "No Statecraft HTML report found at .statecraft/report/index.html.",
    );
    expect(launcher).not.toHaveBeenCalled();
  });

  it("keeps the public OS-launching wrapper behind report validation", async () => {
    const project = await temporaryProject();

    await expect(openReport({ cwd: project })).rejects.toMatchObject({
      code: "OPEN_REPORT_NOT_FOUND",
    });
  });

  it.each(["statecraft", "report", "file"] as const)(
    "rejects a symbolic-link %s boundary",
    async (boundary) => {
    const project = await temporaryProject();
    const external = await temporaryProject();
      const reportDirectory = join(project, ".statecraft", "report");
      if (boundary === "statecraft") {
        await mkdir(join(external, "report"));
        await writeFile(
          join(external, "report", "index.html"),
          "outside",
          "utf8",
        );
        await symlink(external, join(project, ".statecraft"), "dir");
      } else if (boundary === "report") {
        await mkdir(join(project, ".statecraft"));
        await writeFile(join(external, "index.html"), "outside", "utf8");
        await symlink(external, reportDirectory, "dir");
      } else {
        await mkdir(reportDirectory, { recursive: true });
        const externalReport = join(external, "index.html");
        await writeFile(externalReport, "outside", "utf8");
        await symlink(externalReport, join(reportDirectory, "index.html"));
      }
    const launcher = vi.fn(async () => undefined);

    await expect(
      openReportWithLauncher({ cwd: project }, launcher),
    ).rejects.toMatchObject({ code: "OPEN_REPORT_PATH_INVALID" });
    expect(launcher).not.toHaveBeenCalled();
    },
  );

  it("rejects a non-file report target", async () => {
    const project = await temporaryProject();
    await mkdir(join(project, ".statecraft", "report", "index.html"), {
      recursive: true,
    });

    await expect(
      openReportWithLauncher({ cwd: project }, async () => undefined),
    ).rejects.toMatchObject({ code: "OPEN_REPORT_PATH_INVALID" });
  });

  it("classifies invalid project roots before launching", async () => {
    const project = await temporaryProject();
    const filePath = join(project, "not-a-directory");
    await writeFile(filePath, "file", "utf8");
    const launcher = vi.fn(async () => undefined);

    await expect(
      openReportWithLauncher({ cwd: filePath }, launcher),
    ).rejects.toMatchObject({ code: "OPEN_REPORT_ROOT_INVALID" });
    expect(launcher).not.toHaveBeenCalled();
  });

  it("classifies a missing project root before launching", async () => {
    const project = await temporaryProject();
    const launcher = vi.fn(async () => undefined);

    await expect(
      openReportWithLauncher({ cwd: join(project, "missing") }, launcher),
    ).rejects.toMatchObject({ code: "OPEN_REPORT_ROOT_INVALID" });
    expect(launcher).not.toHaveBeenCalled();
  });

  it("classifies launcher failures without changing the report path", async () => {
    const fixture = await reportFixture();

    const error = await openReportWithLauncher(
      { cwd: fixture.project },
      async () => {
        throw new Error("launcher unavailable");
      },
    ).catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(OpenReportError);
    expect(error).toMatchObject({
      code: "OPEN_REPORT_LAUNCH_FAILED",
      reportPath: fixture.reportPath,
    });
    expect((error as Error).message).not.toContain("launcher unavailable");
  });
});

describe("reportOpenCommand", () => {
  it.each([
    ["darwin", "/usr/bin/open"],
    ["win32", "C:\\Windows\\explorer.exe"],
    ["linux", "/usr/bin/xdg-open"],
    ["freebsd", "/usr/local/bin/xdg-open"],
  ] as const)("uses a shell-free %s launcher", (platform, file) => {
    const reportPath = "/project with spaces/.statecraft/report/index.html";

    expect(reportOpenCommand(platform, reportPath, "C:\\Windows")).toEqual({
      args: [reportPath],
      file,
    });
  });

  it("uses the absolute Windows system launcher instead of project lookup", () => {
    expect(
      reportOpenCommand(
        "win32",
        "C:\\project\\.statecraft\\report\\index.html",
        "D:\\Windows",
      ),
    ).toEqual({
      args: ["C:\\project\\.statecraft\\report\\index.html"],
      file: "D:\\Windows\\explorer.exe",
    });
  });

  it("resolves on launcher spawn without waiting for its exit status", async () => {
    const unref = vi.fn<() => void>();
    const child = Object.assign(new EventEmitter(), { unref });
    const spawnProcess = vi.fn(() => child);
    const launched = launchReportWithSpawn(
      "/project/.statecraft/report/index.html",
      "win32",
      spawnProcess,
    );

    child.emit("spawn");
    await expect(launched).resolves.toBeUndefined();
    child.emit("exit", 1);

    expect(unref).toHaveBeenCalledOnce();
    expect(spawnProcess).toHaveBeenCalledWith(
      "C:\\Windows\\explorer.exe",
      ["/project/.statecraft/report/index.html"],
      {
        detached: true,
        shell: false,
        stdio: "ignore",
        windowsHide: true,
      },
    );
  });

  it("rejects when the platform launcher cannot spawn", async () => {
    const unref = vi.fn<() => void>();
    const child = Object.assign(new EventEmitter(), { unref });
    const launched = launchReportWithSpawn(
      "/project/.statecraft/report/index.html",
      "linux",
      () => child,
    );

    child.emit("error", new Error("xdg-open missing"));
    await expect(launched).rejects.toThrow("xdg-open missing");
    expect(unref).not.toHaveBeenCalled();
  });

  it("classifies a synchronous launcher rejection", async () => {
    await expect(
      launchReportWithSpawn(
        "/project/.statecraft/report/index.html",
        "darwin",
        () => {
          throw new Error("spawn denied");
        },
      ),
    ).rejects.toThrow("spawn denied");
  });
});

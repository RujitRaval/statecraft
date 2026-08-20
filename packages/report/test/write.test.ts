import {
  access,
  lstat,
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

import { afterEach, describe, expect, it } from "vitest";

import {
  REPORT_HTML_PATH,
  ReportWriteError,
  writeReportHtml,
} from "../src/write.js";
import { reportFixture } from "./fixture.js";

const projects: string[] = [];

async function projectFixture(): Promise<string> {
  const project = await realpath(
    await mkdtemp(join(tmpdir(), "statecraft-report-write-")),
  );
  projects.push(project);
  await mkdir(join(project, ".statecraft", "report"), { recursive: true });
  return project;
}

afterEach(async () => {
  await Promise.all(
    projects.splice(0).map((project) => rm(project, { force: true, recursive: true })),
  );
});

describe("writeReportHtml", () => {
  it("publishes deterministic private HTML and replaces an older report", async () => {
    const project = await projectFixture();
    const output = join(project, ...REPORT_HTML_PATH.split("/"));
    await writeFile(output, "old", "utf8");

    await expect(
      writeReportHtml(reportFixture(), { projectDirectory: project }),
    ).resolves.toEqual({ reportPath: REPORT_HTML_PATH });
    await expect(readFile(output, "utf8")).resolves.toContain(
      "UI State Coverage Report",
    );
    if (process.platform !== "win32") {
      expect((await lstat(output)).mode & 0o777).toBe(0o600);
    }
    const reportDirectory = join(project, ".statecraft", "report");
    await expect(access(reportDirectory)).resolves.toBeUndefined();
  });

  it.each(["statecraft", "report", "file"] as const)(
    "rejects a symbolic-link %s output boundary",
    async (boundary) => {
      const project = await projectFixture();
      const external = await projectFixture();
      const statecraftDirectory = join(project, ".statecraft");
      const reportDirectory = join(statecraftDirectory, "report");
      await rm(statecraftDirectory, { force: true, recursive: true });

      if (boundary === "statecraft") {
        await symlink(external, statecraftDirectory, "dir");
      } else if (boundary === "report") {
        await mkdir(statecraftDirectory);
        await symlink(external, reportDirectory, "dir");
      } else {
        await mkdir(reportDirectory, { recursive: true });
        const externalFile = join(external, "index.html");
        await writeFile(externalFile, "outside", "utf8");
        await symlink(externalFile, join(reportDirectory, "index.html"));
      }

      const error = await writeReportHtml(reportFixture(), {
        projectDirectory: project,
      }).catch((cause: unknown) => cause);

      expect(error).toBeInstanceOf(ReportWriteError);
      expect(error).toMatchObject({ code: "REPORT_OUTPUT_INVALID" });
    },
  );
});

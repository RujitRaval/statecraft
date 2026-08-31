import http from "node:http";
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  symlink,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { parseReport } from "uiwitness-core";
import { afterEach, describe, expect, it } from "vitest";

import { runCli } from "../src/command.js";

interface FixtureServer {
  readonly close: () => Promise<void>;
  readonly origin: string;
}

const projects: string[] = [];

async function fixtureServer(): Promise<FixtureServer> {
  const server = http.createServer((request, response) => {
    const path = new URL(request.url ?? "/", "http://fixture").pathname;
    const overflow =
      path === "/overflow"
        ? '<div class="overflow">overflow evidence</div>'
        : '<a href="/overflow?private=value#proof">Inspect overflow</a>';
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(`<!doctype html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>UIWitness check fixture</title>
          <style>
            * { box-sizing: border-box; }
            html, body { margin: 0; min-height: 100%; }
            .overflow { width: calc(100vw + 4px); }
          </style>
        </head>
        <body><main><h1>${path}</h1>${overflow}</main></body>
      </html>`);
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("CLI check fixture did not bind a TCP port.");
  }
  return {
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.closeAllConnections();
        server.close((error) => {
          if (error === undefined) {
            resolve();
          } else {
            reject(error);
          }
        });
      }),
    origin: `http://127.0.0.1:${address.port}`,
  };
}

afterEach(async () => {
  await Promise.all(
    projects.splice(0).map((project) =>
      rm(project, { force: true, recursive: true }),
    ),
  );
});

describe("uiwitness check", () => {
  it(
    "promotes a public surface into a configured scan without changing its evidence matrix",
    async () => {
      const fixture = await fixtureServer();
      const project = await realpath(
        await mkdtemp(join(tmpdir(), "uiwitness-cli-check-")),
      );
      projects.push(project);
      try {
        let stderr = "";
        let stdout = "";
        const exitCode = await runCli({
          args: [
            "check",
            `${fixture.origin}/start?private=value#fragment`,
            "--max-pages",
            "2",
            "--write-config",
          ],
          cwd: project,
          stderr: (message) => {
            stderr += message;
          },
          stdout: (message) => {
            stdout += message;
          },
        });

        expect(exitCode).toBe(1);
        expect(stderr).toBe("");
        expect(stdout).toContain(`Site: ${fixture.origin}/`);
        expect(stdout).toContain("Pages: 2 discovered · 2 scanned · 0 skipped");
        expect(stdout).toContain("4 of 8 checks failed.");
        expect(stdout).toContain("Report: .uiwitness/report/index.html");
        expect(stdout).toContain("Saved the discovered public surface.");
        expect(stdout).toContain(
          "Next: add real product states, then run `npx uiwitness scan`.",
        );
        const reportPath = join(
          project,
          ".uiwitness",
          "report",
          "uiwitness.json",
        );
        const reportContents = await readFile(reportPath, "utf8");
        const report = parseReport(JSON.parse(reportContents));
        expect(report.summary).toMatchObject({
          executions: 8,
          failed: 4,
          passed: 4,
          routes: 2,
          states: 2,
        });
        expect(
          report.executions.map(
            ({ routePath, status, theme, viewportId }) =>
              `${routePath}:${viewportId}:${theme}:${status}`,
          ),
        ).toEqual([
          "/start:mobile:light:passed",
          "/start:mobile:dark:passed",
          "/start:desktop:light:passed",
          "/start:desktop:dark:passed",
          "/overflow:mobile:light:failed",
          "/overflow:mobile:dark:failed",
          "/overflow:desktop:light:failed",
          "/overflow:desktop:dark:failed",
        ]);
        expect(
          report.executions.slice(4).every(({ failures }) =>
            failures.some(
              ({ code, message }) =>
                code === "ASSERTION_FAILED" &&
                message.includes("overflows horizontally by 4 CSS pixels"),
            ),
          ),
        ).toBe(true);
        for (const execution of report.executions) {
          expect(execution.screenshotPath).not.toBeNull();
          await expect(
            access(
              join(
                project,
                ...(execution.screenshotPath ?? "").split("/"),
              ),
            ),
          ).resolves.toBeUndefined();
        }
        expect(reportContents).not.toContain("private=value");
        const html = await readFile(
          join(project, ".uiwitness", "report", "index.html"),
          "utf8",
        );
        expect(html).toContain('data-brand-system="kinetic-evidence-v1"');
        expect(html).toContain("4 states broke. Open the evidence.");

        const config = await readFile(
          join(project, "uiwitness.config.mts"),
          "utf8",
        );
        expect(config).toContain(`baseURL: "${fixture.origin}/"`);
        expect(config.indexOf('path: "/start"')).toBeLessThan(
          config.indexOf('path: "/overflow"'),
        );
        await expect(
          readFile(
            join(
              project,
              "uiwitness",
              "scenarios",
              "public",
              "default.mts",
            ),
            "utf8",
          ),
        ).resolves.toContain(
          'from "uiwitness/public-site-scenario"',
        );

        const packageModules = join(project, "node_modules");
        await mkdir(packageModules, { recursive: true });
        await symlink(
          fileURLToPath(new URL("../", import.meta.url)),
          join(packageModules, "uiwitness"),
          process.platform === "win32" ? "junction" : "dir",
        );
        let scanStderr = "";
        let scanStdout = "";
        const scanExitCode = await runCli({
          args: ["scan"],
          cwd: project,
          stderr: (message) => {
            scanStderr += message;
          },
          stdout: (message) => {
            scanStdout += message;
          },
        });
        expect(scanExitCode).toBe(1);
        expect(scanStderr).toBe("");
        expect(scanStdout).toContain("4 of 8 executions failed.");
        const promotedReport = parseReport(
          JSON.parse(await readFile(reportPath, "utf8")),
        );
        expect(
          promotedReport.executions.map(
            ({ routePath, status, theme, viewportId }) =>
              `${routePath}:${viewportId}:${theme}:${status}`,
          ),
        ).toEqual(
          report.executions.map(
            ({ routePath, status, theme, viewportId }) =>
              `${routePath}:${viewportId}:${theme}:${status}`,
          ),
        );
      } finally {
        await fixture.close();
      }
    },
    30_000,
  );
});

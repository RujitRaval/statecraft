import http from "node:http";
import { access, mkdtemp, readFile, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { parseReport } from "statecraft-ui-core";
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
          <title>Statecraft check fixture</title>
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

describe("statecraft check", () => {
  it(
    "discovers a public surface and persists four evidence cells per page",
    async () => {
      const fixture = await fixtureServer();
      const project = await realpath(
        await mkdtemp(join(tmpdir(), "statecraft-cli-check-")),
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
        expect(stdout).toContain("Report: .statecraft/report/index.html");
        const reportPath = join(
          project,
          ".statecraft",
          "report",
          "statecraft.json",
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
          join(project, ".statecraft", "report", "index.html"),
          "utf8",
        );
        expect(html).toContain('data-brand-system="kinetic-evidence-v1"');
        expect(html).toContain("4 states broke. Open the evidence.");
      } finally {
        await fixture.close();
      }
    },
    30_000,
  );
});

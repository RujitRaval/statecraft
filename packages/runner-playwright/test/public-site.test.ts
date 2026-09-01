import http from "node:http";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import type { PublicRouteDiscovery } from "../src/discovery.js";
import {
  publicSiteMatrix,
  runPublicSiteChecks,
} from "../src/public-site.js";
import { publicSiteScenario } from "../src/public-site-scenario.js";
import type { AssertionScenarioContext } from "../src/scenario.js";

interface FixtureServer {
  readonly close: () => Promise<void>;
  readonly origin: string;
}

function discovery(
  baseURL: string,
  paths: readonly string[],
): PublicRouteDiscovery {
  return Object.freeze({
    attemptedPages: paths.length,
    baseURL,
    routes: Object.freeze(
      paths.map((path) => Object.freeze({ path })),
    ),
    skippedPages: 0,
    truncatedAnchorPages: 0,
  });
}

async function fixtureServer(): Promise<FixtureServer> {
  const server = http.createServer((request, response) => {
    const path = new URL(request.url ?? "/", "http://fixture").pathname;
    if (path === "/failed-resource") {
      response.destroy();
      return;
    }

    const overflow =
      path === "/overflow"
        ? '<div class="overflow">overflow evidence</div>'
        : "";
    const pageError =
      path === "/page-error"
        ? 'setTimeout(() => { throw new Error("page token=visible"); }, 0);'
        : "";
    const status = path === "/http-error" ? 503 : 200;
    response.writeHead(status, { "content-type": "text/html; charset=utf-8" });
    response.end(`<!doctype html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            * { box-sizing: border-box; }
            html, body { margin: 0; min-height: 100%; }
            body { background: #f4f0e6; color: #0b0c0a; }
            @media (prefers-color-scheme: dark) {
              body { background: #0b0c0a; color: #f4f0e6; }
            }
            main { min-height: 100vh; padding: 24px; }
            .overflow { width: calc(100vw + 4px); }
          </style>
        </head>
        <body>
          <main>
            <h1>${path}</h1>
            ${overflow}
            <img src="/failed-resource?token=visible#fragment" alt="" width="1" height="1">
          </main>
          <script>
            const scheme = matchMedia("(prefers-color-scheme: dark)").matches
              ? "dark"
              : "light";
            if (scheme !== document.documentElement.dataset.theme) {
              queueMicrotask(() => {
                throw new Error("browser color scheme did not match the matrix theme");
              });
            }
            const supportedViewport =
              (innerWidth === 390 && innerHeight === 844) ||
              (innerWidth === 1440 && innerHeight === 900);
            if (!supportedViewport) {
              queueMicrotask(() => {
                throw new Error("browser viewport did not match the fixed matrix");
              });
            }
            console.error(
              "public diagnostic /private?token=visible#fragment api_key=plain-value",
            );
            ${pageError}
          </script>
        </body>
      </html>`);
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("Public-site fixture did not bind a TCP port.");
  }
  return {
    close: () =>
      new Promise<void>((resolve, reject) => {
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

describe("publicSiteMatrix", () => {
  it("expands each route into the fixed mobile/desktop by light/dark order", () => {
    const result = publicSiteMatrix(
      discovery("https://example.com/", ["/", "/a-b", "/a/b"]),
    );

    expect(result).toHaveLength(12);
    expect(
      result.slice(0, 4).map(({ state, theme, viewport, viewportId }) => ({
        state: state.id,
        theme,
        viewport,
        viewportId,
      })),
    ).toEqual([
      {
        state: "public",
        theme: "light",
        viewport: { height: 844, width: 390 },
        viewportId: "mobile",
      },
      {
        state: "public",
        theme: "dark",
        viewport: { height: 844, width: 390 },
        viewportId: "mobile",
      },
      {
        state: "public",
        theme: "light",
        viewport: { height: 900, width: 1_440 },
        viewportId: "desktop",
      },
      {
        state: "public",
        theme: "dark",
        viewport: { height: 900, width: 1_440 },
        viewportId: "desktop",
      },
    ]);
    const routeIds = result
      .filter((_, index) => index % 4 === 0)
      .map(({ route }) => route.id);
    expect(routeIds[0]).toMatch(/^home-[a-f0-9]{12}$/u);
    expect(routeIds[1]).toMatch(/^a-b-[a-f0-9]{12}$/u);
    expect(routeIds[2]).toMatch(/^a-b-[a-f0-9]{12}$/u);
    expect(new Set(routeIds).size).toBe(3);
    expect(
      publicSiteMatrix(
        discovery("https://example.com/", ["/", "/a-b", "/a/b"]),
      )
        .filter((_, index) => index % 4 === 0)
        .map(({ route }) => route.id),
    ).toEqual(routeIds);
  });

  it("rejects empty, duplicate, credentialed, or non-path discovery input", () => {
    const credentialedBaseURL = new URL("https://example.com/");
    credentialedBaseURL.username = "user";
    credentialedBaseURL.password = "pass";

    expect(() => publicSiteMatrix(discovery("https://example.com/", []))).toThrow(
      "at least one accepted route",
    );
    expect(() =>
      publicSiteMatrix(
        discovery("https://example.com/", ["/same", "/same"]),
      ),
    ).toThrow("duplicated");
    expect(() =>
      publicSiteMatrix(discovery(credentialedBaseURL.href, ["/"])),
    ).toThrow("credential-free");
    expect(() =>
      publicSiteMatrix(discovery("https://example.com/", ["/path?secret=yes"])),
    ).toThrow("query-free local pathname");
    expect(() =>
      publicSiteMatrix(discovery("https://example.com/", ["//outside.test"])),
    ).toThrow("query-free local pathname");
  });
});

describe("publicSiteScenario", () => {
  function context(
    status: number | null,
    overflow: number,
  ): AssertionScenarioContext {
    return {
      navigation: {
        requestedUrl: "https://example.com/",
        status,
        url: "https://example.com/",
      },
      page: {
        evaluate: async () => overflow,
      },
    } as unknown as AssertionScenarioContext;
  }

  it("accepts the exact HTTP and overflow boundaries", async () => {
    await expect(
      publicSiteScenario.assert?.(context(399, 1)),
    ).resolves.toBeUndefined();
  });

  it("fails missing/error responses and overflow above one CSS pixel", async () => {
    await expect(
      publicSiteScenario.assert?.(context(null, 0)),
    ).rejects.toThrow("did not return an HTTP response");
    await expect(
      publicSiteScenario.assert?.(context(400, 0)),
    ).rejects.toThrow("HTTP status 400");
    await expect(
      publicSiteScenario.assert?.(context(200, 2)),
    ).rejects.toThrow("overflows horizontally by 2 CSS pixels");
  });
});

describe("runPublicSiteChecks", () => {
  it(
    "persists four screenshots per route with precise failures and warning-only sanitized diagnostics",
    async () => {
      const fixture = await fixtureServer();
      const projectDirectory = await mkdtemp(
        join(tmpdir(), "uiwitness-public-site-"),
      );
      try {
        const run = await runPublicSiteChecks(
          discovery(`${fixture.origin}/`, [
            "/healthy",
            "/overflow",
            "/page-error",
            "/http-error",
          ]),
          {
            generatedAt: new Date("2026-08-22T18:00:00.000Z"),
            navigationTimeoutMs: 5_000,
            projectDirectory,
            readinessTimeoutMs: 5_000,
          },
        );

        expect(run.report).toMatchObject({
          generatedAt: "2026-08-22T18:00:00.000Z",
          project: { baseURL: `${fixture.origin}/` },
          schemaVersion: 1,
          summary: {
            executions: 16,
            failed: 12,
            passed: 4,
            routes: 4,
            states: 4,
          },
        });
        expect(
          run.report.executions.map(
            ({ routePath, status, theme, viewportId }) =>
              `${routePath}:${viewportId}:${theme}:${status}`,
          ),
        ).toEqual([
          "/healthy:mobile:light:passed",
          "/healthy:mobile:dark:passed",
          "/healthy:desktop:light:passed",
          "/healthy:desktop:dark:passed",
          "/overflow:mobile:light:failed",
          "/overflow:mobile:dark:failed",
          "/overflow:desktop:light:failed",
          "/overflow:desktop:dark:failed",
          "/page-error:mobile:light:failed",
          "/page-error:mobile:dark:failed",
          "/page-error:desktop:light:failed",
          "/page-error:desktop:dark:failed",
          "/http-error:mobile:light:failed",
          "/http-error:mobile:dark:failed",
          "/http-error:desktop:light:failed",
          "/http-error:desktop:dark:failed",
        ]);

        const healthy = run.report.executions.slice(0, 4);
        expect(
          healthy.every(
            ({ diagnostics, failures, status }) =>
              status === "passed" &&
              failures.length === 0 &&
              diagnostics.consoleErrors.length > 0 &&
              diagnostics.failedRequests.length === 1,
          ),
        ).toBe(true);
        expect(
          run.report.executions
            .slice(4, 8)
            .every(
              ({ failures }) =>
                failures.length === 1 &&
                failures[0]?.code === "ASSERTION_FAILED" &&
                failures[0].message.includes("overflows horizontally"),
            ),
        ).toBe(true);
        expect(
          run.report.executions
            .slice(8, 12)
            .every(
              ({ failures }) =>
                failures.length === 1 &&
                failures[0]?.code === "PAGE_ERROR",
            ),
        ).toBe(true);
        expect(
          run.report.executions
            .slice(12)
            .every(
              ({ diagnostics, failures }) =>
                diagnostics.navigationStatus === 503 &&
                failures.length === 1 &&
                failures[0]?.code === "ASSERTION_FAILED" &&
                failures[0].message.includes("HTTP status 503"),
            ),
        ).toBe(true);

        const serialized = JSON.stringify(run.report);
        expect(serialized).not.toMatch(/plain-value|token=visible|#fragment/u);
        expect(serialized).toContain("%5BREDACTED%5D");

        for (const execution of run.report.executions) {
          expect(execution.screenshotPath).not.toBeNull();
          const bytes = await readFile(
            join(
              projectDirectory,
              ...(execution.screenshotPath ?? "").split("/"),
            ),
          );
          expect([...bytes.subarray(0, 8)]).toEqual([
            137, 80, 78, 71, 13, 10, 26, 10,
          ]);
        }
        await expect(
          access(join(projectDirectory, run.reportPath)),
        ).resolves.toBeUndefined();
        await expect(
          readFile(join(projectDirectory, run.htmlReportPath), "utf8"),
        ).resolves.toContain("UI State Coverage Report");
      } finally {
        await fixture.close();
        await rm(projectDirectory, { force: true, recursive: true });
      }
    },
    30_000,
  );
});

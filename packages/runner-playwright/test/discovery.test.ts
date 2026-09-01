import http, {
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  discoverPublicRoutes,
  PublicRouteDiscoveryError,
} from "../src/index.js";

interface LoopbackServer {
  readonly close: () => Promise<void>;
  readonly origin: string;
}

async function loopbackServer(
  handle: (request: IncomingMessage, response: ServerResponse) => void,
): Promise<LoopbackServer> {
  const server = http.createServer(handle);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("Discovery fixture did not bind a TCP port.");
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

function html(response: ServerResponse, body: string, status = 200): void {
  response.writeHead(status, { "content-type": "text/html; charset=utf-8" });
  response.end(`<!doctype html><html><body>${body}</body></html>`);
}

describe("discoverPublicRoutes", () => {
  it("rejects invalid input and bounds before Chromium launches", async () => {
    const missingExecutable = path.join(
      process.cwd(),
      "uiwitness-missing-discovery-browser",
    );
    const launchOptions = { executablePath: missingExecutable };

    await expect(
      discoverPublicRoutes("not a URL", { launchOptions }),
    ).rejects.toEqual(
      new TypeError("url must be a valid absolute HTTP(S) URL."),
    );
    await expect(
      discoverPublicRoutes("file:///tmp/site", { launchOptions }),
    ).rejects.toEqual(
      new TypeError(
        "url must be an absolute HTTP(S) URL without credentials.",
      ),
    );
    await expect(
      discoverPublicRoutes(["https://", "user", ":", "fixture", "@example.com"].join(""), {
        launchOptions,
      }),
    ).rejects.toBeInstanceOf(TypeError);
    for (const maxPages of [0, 1.5, 21, Number.MAX_SAFE_INTEGER + 1]) {
      await expect(
        discoverPublicRoutes("https://example.com", {
          launchOptions,
          maxPages,
        }),
      ).rejects.toBeInstanceOf(TypeError);
    }
    await expect(
      discoverPublicRoutes("https://example.com", {
        launchOptions,
        readinessTimeoutMs: -1,
      }),
    ).rejects.toBeInstanceOf(TypeError);
  });

  it("discovers deterministic breadth-first paths and isolates page state", async () => {
    const requested: string[] = [];
    let leakedCookie = false;
    let leakedStorage = false;
    const server = await loopbackServer((request, response) => {
      requested.push(request.url ?? "");
      const pathname = new URL(request.url ?? "/", "http://fixture").pathname;
      if (pathname === "/start") {
        response.setHeader("set-cookie", "uiwitness-secret=present; Path=/");
        html(
          response,
          `
            <script>localStorage.setItem("uiwitness-secret", "present")</script>
            <a href="/a?token=secret#panel">A</a>
            <a href="/b">B</a>
            <a href="/a?duplicate=yes">A duplicate</a>
            <a href="/asset.png">asset</a>
            <a href="/download" download>download</a>
            <a href="mailto:test@example.com">mail</a>
          `,
        );
        return;
      }
      if (pathname === "/a") {
        leakedCookie = request.headers.cookie !== undefined;
        html(
          response,
          `<script>
            if (localStorage.getItem("uiwitness-secret")) {
              fetch("/storage-leaked");
            }
          </script><a href="/c">C</a>`,
        );
        return;
      }
      if (pathname === "/storage-leaked") {
        leakedStorage = true;
      }
      if (pathname === "/b") {
        html(response, '<a href="/d">D</a>');
        return;
      }
      html(response, "leaf");
    });

    try {
      const result = await discoverPublicRoutes(
        `${server.origin}/start?private=value#fragment`,
        {
          maxPages: 4,
          navigationTimeoutMs: 2_000,
          readinessTimeoutMs: 2_000,
        },
      );

      expect(Object.isFrozen(result)).toBe(true);
      expect(Object.isFrozen(result.routes)).toBe(true);
      expect(result).toEqual({
        attemptedPages: 4,
        baseURL: `${server.origin}/`,
        routes: [
          { path: "/start" },
          { path: "/a" },
          { path: "/b" },
          { path: "/c" },
        ],
        skippedPages: 0,
        truncatedAnchorPages: 0,
      });
      expect(requested[0]).toBe("/start");
      expect(requested).not.toContain("/asset.png");
      expect(requested).not.toContain("/download");
      expect(leakedCookie).toBe(false);
      expect(leakedStorage).toBe(false);
    } finally {
      await server.close();
    }
  });

  it("uses the initial redirect origin and skips later external redirects", async () => {
    let externalHits = 0;
    const external = await loopbackServer((_request, response) => {
      externalHits += 1;
      html(response, '<a href="/never-followed">outside</a>');
    });
    let canonical: LoopbackServer | undefined;
    let entry: LoopbackServer | undefined;
    try {
      canonical = await loopbackServer((request, response) => {
        const pathname = new URL(request.url ?? "/", "http://fixture").pathname;
        if (pathname === "/root") {
          html(
            response,
            '<a href="/same-redirect">same</a><a href="/final">final duplicate</a><a href="/outside">outside</a>',
          );
          return;
        }
        if (pathname === "/same-redirect") {
          response.writeHead(302, { location: "/final" });
          response.end();
          return;
        }
        if (pathname === "/outside") {
          response.writeHead(302, { location: `${external.origin}/landing` });
          response.end();
          return;
        }
        html(response, "final");
      });
      entry = await loopbackServer((_request, response) => {
        response.writeHead(302, { location: `${canonical!.origin}/root` });
        response.end();
      });

      const result = await discoverPublicRoutes(`${entry.origin}/start`, {
        maxPages: 3,
        navigationTimeoutMs: 2_000,
        readinessTimeoutMs: 2_000,
      });

      expect(result).toEqual({
        attemptedPages: 3,
        baseURL: `${canonical.origin}/`,
        routes: [{ path: "/root" }, { path: "/final" }],
        skippedPages: 1,
        truncatedAnchorPages: 0,
      });
      expect(externalHits).toBe(1);
    } finally {
      await entry?.close();
      await canonical?.close();
      await external.close();
    }
  });

  it("keeps same-origin double-slash paths on the canonical origin", async () => {
    let externalHits = 0;
    const external = await loopbackServer((_request, response) => {
      externalHits += 1;
      html(response, "must not load");
    });
    const externalHost = new URL(external.origin).host;
    let server: LoopbackServer | undefined;
    const requested: string[] = [];
    try {
      server = await loopbackServer((request, response) => {
        requested.push(request.url ?? "");
        if (request.url === "/") {
          html(
            response,
            `<a href="${server!.origin}//${externalHost}/private">path</a>`,
          );
          return;
        }
        html(response, "same-origin leaf");
      });

      await expect(
        discoverPublicRoutes(server.origin, {
          maxPages: 2,
          navigationTimeoutMs: 2_000,
          readinessTimeoutMs: 2_000,
        }),
      ).resolves.toEqual({
        attemptedPages: 2,
        baseURL: `${server.origin}/`,
        routes: [{ path: "/" }, { path: `//${externalHost}/private` }],
        skippedPages: 0,
        truncatedAnchorPages: 0,
      });
      expect(requested).toContain(`//${externalHost}/private`);
      expect(externalHits).toBe(0);
    } finally {
      await server?.close();
      await external.close();
    }
  });

  it("counts failed and skipped candidates against the hard attempt budget", async () => {
    const external = await loopbackServer((_request, response) => {
      html(response, "outside");
    });
    const server = await loopbackServer((request, response) => {
      const pathname = new URL(request.url ?? "/", "http://fixture").pathname;
      if (pathname === "/") {
        html(
          response,
          '<a href="/failed">failed</a><a href="/outside">outside</a><a href="/never">never</a>',
        );
        return;
      }
      if (pathname === "/failed") {
        response.destroy();
        return;
      }
      if (pathname === "/outside") {
        response.writeHead(302, { location: external.origin });
        response.end();
        return;
      }
      html(response, "unexpected");
    });

    try {
      const result = await discoverPublicRoutes(server.origin, {
        maxPages: 3,
        navigationTimeoutMs: 1_000,
        readinessTimeoutMs: 1_000,
      });
      expect(result).toEqual({
        attemptedPages: 3,
        baseURL: `${server.origin}/`,
        routes: [{ path: "/" }, { path: "/failed" }],
        skippedPages: 1,
        truncatedAnchorPages: 0,
      });
    } finally {
      await server.close();
      await external.close();
    }
  });

  it("accepts an initial HTTP error and classifies later page failures", async () => {
    const server = await loopbackServer((request, response) => {
      const pathname = new URL(request.url ?? "/", "http://fixture").pathname;
      if (pathname === "/missing") {
        html(
          response,
          '<a href="/slow">slow</a><a href="/data">data</a>',
          404,
        );
        return;
      }
      if (pathname === "/slow") {
        html(response, '<img src="/hang" alt="">');
        return;
      }
      if (pathname === "/hang") {
        return;
      }
      response.writeHead(200, { "content-type": "text/plain" });
      response.end("not a document");
    });

    try {
      await expect(
        discoverPublicRoutes(`${server.origin}/slow`, {
          navigationTimeoutMs: 2_000,
          readinessTimeoutMs: 100,
        }),
      ).rejects.toEqual(
        new PublicRouteDiscoveryError(
          "initial-navigation-failed",
          "The starting page did not become ready.",
        ),
      );
      const result = await discoverPublicRoutes(`${server.origin}/missing`, {
        maxPages: 3,
        navigationTimeoutMs: 2_000,
        readinessTimeoutMs: 100,
      });
      expect(result).toEqual({
        attemptedPages: 3,
        baseURL: `${server.origin}/`,
        routes: [{ path: "/missing" }, { path: "/slow" }],
        skippedPages: 1,
        truncatedAnchorPages: 0,
      });
    } finally {
      await server.close();
    }
  });

  it("requires an exact HTML MIME type for initial and candidate pages", async () => {
    const server = await loopbackServer((request, response) => {
      const pathname = new URL(request.url ?? "/", "http://fixture").pathname;
      if (pathname === "/") {
        html(response, '<a href="/htmlish">not HTML</a>');
        return;
      }
      response.writeHead(200, { "content-type": "text/htmlish" });
      response.end('<a href="/must-not-expand">not HTML</a>');
    });

    try {
      await expect(
        discoverPublicRoutes(`${server.origin}/htmlish`, {
          navigationTimeoutMs: 2_000,
          readinessTimeoutMs: 2_000,
        }),
      ).rejects.toEqual(
        new PublicRouteDiscoveryError(
          "initial-response-not-html",
          "The starting page did not return an HTML document.",
        ),
      );
      await expect(
        discoverPublicRoutes(server.origin, {
          maxPages: 3,
          navigationTimeoutMs: 2_000,
          readinessTimeoutMs: 2_000,
        }),
      ).resolves.toEqual({
        attemptedPages: 2,
        baseURL: `${server.origin}/`,
        routes: [{ path: "/" }],
        skippedPages: 1,
        truncatedAnchorPages: 0,
      });
    } finally {
      await server.close();
    }
  });

  it("caps rendered anchor extraction and sanitizes initial failures", async () => {
    const requested: string[] = [];
    const anchors = [
      `<a href="/${"x".repeat(8_192)}">oversized</a>`,
      '<a href="/downloaded" download>download</a>',
      ...Array.from({ length: 998 }, () => '<a href="/within">within</a>'),
      '<a href="/overflow">overflow</a>',
    ].join("");
    const htmlServer = await loopbackServer((request, response) => {
      requested.push(request.url ?? "");
      const pathname = new URL(request.url ?? "/", "http://fixture").pathname;
      html(response, pathname === "/" ? anchors : "leaf");
    });
    const textServer = await loopbackServer((_request, response) => {
      response.writeHead(200, { "content-type": "text/plain" });
      response.end("not html");
    });

    try {
      await expect(
        discoverPublicRoutes(`${textServer.origin}/secret?token=value`, {
          navigationTimeoutMs: 2_000,
          readinessTimeoutMs: 2_000,
        }),
      ).rejects.toEqual(
        new PublicRouteDiscoveryError(
          "initial-response-not-html",
          "The starting page did not return an HTML document.",
        ),
      );
      const result = await discoverPublicRoutes(htmlServer.origin, {
        maxPages: 3,
        navigationTimeoutMs: 2_000,
        readinessTimeoutMs: 2_000,
      });
      expect(result).toEqual({
        attemptedPages: 2,
        baseURL: `${htmlServer.origin}/`,
        routes: [{ path: "/" }, { path: "/within" }],
        skippedPages: 0,
        truncatedAnchorPages: 1,
      });
      expect(requested).not.toContain("/overflow");
      expect(requested.every((request) => request.length < 8_192)).toBe(true);
    } finally {
      await htmlServer.close();
      await textServer.close();
    }
  });

  it("sanitizes an initial network failure", async () => {
    const stoppedServer = await loopbackServer((_request, response) => {
      html(response, "unused");
    });
    const stoppedOrigin = stoppedServer.origin;
    await stoppedServer.close();

    let thrown: unknown;
    try {
      await discoverPublicRoutes(
        `${stoppedOrigin}/private?access_token=secret#fragment`,
        {
          navigationTimeoutMs: 500,
          readinessTimeoutMs: 500,
        },
      );
    } catch (error: unknown) {
      thrown = error;
    }
    expect(thrown).toEqual(
      new PublicRouteDiscoveryError(
        "initial-navigation-failed",
        "The starting page could not be loaded.",
      ),
    );
    expect(String(thrown)).not.toContain("secret");
    expect(String(thrown)).not.toContain(stoppedOrigin);
  });
});

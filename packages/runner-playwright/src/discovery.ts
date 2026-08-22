import {
  chromium,
  type Browser,
  type BrowserContext,
  type LaunchOptions,
  type Page,
} from "playwright";

import {
  defaultNavigationTimeoutMs,
  defaultReadinessTimeoutMs,
  positiveSafeInteger,
  settleDeterministicReadiness,
} from "./readiness.js";

const defaultMaxPages = 5;
const maximumPages = 20;
const maximumAnchorsPerPage = 1_000;
const maximumCandidateURLCharacters = 8_192;
const nonDocumentExtensions = new Set([
  ".7z",
  ".avi",
  ".avif",
  ".bmp",
  ".css",
  ".csv",
  ".doc",
  ".docx",
  ".eot",
  ".gif",
  ".gz",
  ".ico",
  ".jpeg",
  ".jpg",
  ".js",
  ".json",
  ".map",
  ".mov",
  ".mp3",
  ".mp4",
  ".mpeg",
  ".pdf",
  ".png",
  ".rar",
  ".rss",
  ".svg",
  ".tar",
  ".tgz",
  ".ttf",
  ".txt",
  ".wav",
  ".webm",
  ".webp",
  ".woff",
  ".woff2",
  ".xml",
  ".zip",
]);

export type PublicRouteDiscoveryErrorCode =
  | "initial-navigation-failed"
  | "initial-response-missing"
  | "initial-response-not-html";

export class PublicRouteDiscoveryError extends Error {
  readonly code: PublicRouteDiscoveryErrorCode;

  constructor(code: PublicRouteDiscoveryErrorCode, message: string) {
    super(message);
    this.name = "PublicRouteDiscoveryError";
    this.code = code;
  }
}

export interface DiscoverPublicRoutesOptions {
  readonly launchOptions?: LaunchOptions | undefined;
  readonly maxPages?: number | undefined;
  readonly navigationTimeoutMs?: number | undefined;
  readonly readinessTimeoutMs?: number | undefined;
}

export interface DiscoveredPublicRoute {
  readonly path: string;
}

export interface PublicRouteDiscovery {
  readonly attemptedPages: number;
  readonly baseURL: string;
  readonly routes: readonly DiscoveredPublicRoute[];
  readonly skippedPages: number;
  readonly truncatedAnchorPages: number;
}

interface DiscoverySettings {
  readonly initialURL: URL;
  readonly launchOptions?: LaunchOptions | undefined;
  readonly maxPages: number;
  readonly navigationTimeoutMs: number;
  readonly readinessTimeoutMs: number;
}

interface ExtractedAnchors {
  readonly hrefs: readonly string[];
  readonly truncated: boolean;
}

interface InitialPage {
  readonly anchors: ExtractedAnchors;
  readonly finalURL: URL;
}

interface CandidatePage {
  readonly anchors?: ExtractedAnchors | undefined;
  readonly finalPath?: string | undefined;
  readonly kind: "accepted" | "failed" | "skipped";
}

function settingsFor(
  input: string,
  options: DiscoverPublicRoutesOptions,
): DiscoverySettings {
  let initialURL: URL;
  try {
    initialURL = new URL(input);
  } catch {
    throw new TypeError("url must be a valid absolute HTTP(S) URL.");
  }
  if (
    (initialURL.protocol !== "http:" && initialURL.protocol !== "https:") ||
    initialURL.username.length > 0 ||
    initialURL.password.length > 0
  ) {
    throw new TypeError(
      "url must be an absolute HTTP(S) URL without credentials.",
    );
  }
  initialURL.search = "";
  initialURL.hash = "";

  const maxPages = positiveSafeInteger(
    options.maxPages,
    defaultMaxPages,
    "maxPages",
  );
  if (maxPages > maximumPages) {
    throw new TypeError(`maxPages must be between 1 and ${maximumPages}.`);
  }

  return Object.freeze({
    initialURL,
    launchOptions: options.launchOptions,
    maxPages,
    navigationTimeoutMs: positiveSafeInteger(
      options.navigationTimeoutMs,
      defaultNavigationTimeoutMs,
      "navigationTimeoutMs",
    ),
    readinessTimeoutMs: positiveSafeInteger(
      options.readinessTimeoutMs,
      defaultReadinessTimeoutMs,
      "readinessTimeoutMs",
    ),
  });
}

function httpURL(value: string): URL | undefined {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url
      : undefined;
  } catch {
    return undefined;
  }
}

function isHtmlDocument(contentType: string): boolean {
  const normalized = contentType.toLowerCase();
  return normalized === "text/html" || normalized === "application/xhtml+xml";
}

async function documentContentType(page: Page): Promise<string> {
  return page.evaluate(() => document.contentType);
}

async function extractedAnchors(page: Page): Promise<ExtractedAnchors> {
  const result = await page.evaluate(
    ({ limit, maximumURLCharacters }) => {
      const hrefs: string[] = [];
      const walker = document.createTreeWalker(
        document.documentElement,
        NodeFilter.SHOW_ELEMENT,
      );
      let anchorsSeen = 0;
      let node: Node | null;
      while ((node = walker.nextNode()) !== null) {
        if (!(node instanceof HTMLAnchorElement) || !node.hasAttribute("href")) {
          continue;
        }
        anchorsSeen += 1;
        if (anchorsSeen > limit) {
          return { hrefs, truncated: true };
        }
        const rawHref = node.getAttribute("href");
        if (
          node.hasAttribute("download") ||
          rawHref === null ||
          rawHref.length > maximumURLCharacters
        ) {
          continue;
        }
        const resolvedHref = node.href;
        if (resolvedHref.length <= maximumURLCharacters) {
          hrefs.push(resolvedHref);
        }
      }
      return { hrefs, truncated: false };
    },
    {
      limit: maximumAnchorsPerPage,
      maximumURLCharacters: maximumCandidateURLCharacters,
    },
  );
  return Object.freeze({
    hrefs: Object.freeze(result.hrefs),
    truncated: result.truncated,
  });
}

function pathFor(url: URL): string {
  return url.pathname.length === 0 ? "/" : url.pathname;
}

function isDocumentPath(pathname: string): boolean {
  const lastSegment = pathname.slice(pathname.lastIndexOf("/") + 1);
  const dot = lastSegment.lastIndexOf(".");
  if (dot < 0) {
    return true;
  }
  return !nonDocumentExtensions.has(lastSegment.slice(dot).toLowerCase());
}

function normalizedCandidate(
  href: string,
  canonicalOrigin: string,
): string | undefined {
  if (href.length > maximumCandidateURLCharacters) {
    return undefined;
  }
  const url = httpURL(href);
  if (
    url === undefined ||
    url.origin !== canonicalOrigin ||
    url.username.length > 0 ||
    url.password.length > 0 ||
    !isDocumentPath(url.pathname)
  ) {
    return undefined;
  }
  url.search = "";
  url.hash = "";
  return pathFor(url);
}

async function withFreshContext<Value>(
  browser: Browser,
  execute: (context: BrowserContext) => Promise<Value>,
): Promise<Value> {
  const context = await browser.newContext();
  let failure: unknown;
  let value: Value | undefined;
  try {
    value = await execute(context);
  } catch (cause: unknown) {
    failure = cause;
  }

  try {
    await context.close();
  } catch (cleanupFailure: unknown) {
    if (failure !== undefined) {
      throw new AggregateError(
        [failure, cleanupFailure],
        "Public-route discovery and browser-context cleanup both failed.",
        { cause: cleanupFailure },
      );
    }
    throw cleanupFailure;
  }
  if (failure !== undefined) {
    throw failure;
  }
  return value as Value;
}

async function initialPage(
  browser: Browser,
  settings: DiscoverySettings,
): Promise<InitialPage> {
  return withFreshContext(browser, async (context) => {
    const page = await context.newPage();
    let response;
    try {
      response = await page.goto(settings.initialURL.href, {
        timeout: settings.navigationTimeoutMs,
        waitUntil: "domcontentloaded",
      });
    } catch {
      throw new PublicRouteDiscoveryError(
        "initial-navigation-failed",
        "The starting page could not be loaded.",
      );
    }
    if (response === null) {
      throw new PublicRouteDiscoveryError(
        "initial-response-missing",
        "The starting page did not return an HTTP response.",
      );
    }

    const finalURL = httpURL(page.url());
    if (finalURL === undefined) {
      throw new PublicRouteDiscoveryError(
        "initial-response-missing",
        "The starting page did not finish on an HTTP(S) URL.",
      );
    }
    if (!isHtmlDocument(await documentContentType(page))) {
      throw new PublicRouteDiscoveryError(
        "initial-response-not-html",
        "The starting page did not return an HTML document.",
      );
    }
    try {
      await settleDeterministicReadiness(page, {
        baseURL: finalURL,
        timeoutMs: settings.readinessTimeoutMs,
      });
    } catch {
      throw new PublicRouteDiscoveryError(
        "initial-navigation-failed",
        "The starting page did not become ready.",
      );
    }
    return Object.freeze({
      anchors: await extractedAnchors(page),
      finalURL,
    });
  });
}

async function candidatePage(
  browser: Browser,
  requestedURL: URL,
  canonicalBaseURL: URL,
  settings: DiscoverySettings,
): Promise<CandidatePage> {
  return withFreshContext(browser, async (context) => {
    const page = await context.newPage();
    try {
      const response = await page.goto(requestedURL.href, {
        timeout: settings.navigationTimeoutMs,
        waitUntil: "domcontentloaded",
      });
      if (response === null) {
        return Object.freeze({ kind: "failed" });
      }
      const finalURL = httpURL(page.url());
      if (finalURL === undefined || finalURL.origin !== canonicalBaseURL.origin) {
        return Object.freeze({ kind: "skipped" });
      }
      if (!isHtmlDocument(await documentContentType(page))) {
        return Object.freeze({ kind: "skipped" });
      }
      await settleDeterministicReadiness(page, {
        baseURL: canonicalBaseURL,
        timeoutMs: settings.readinessTimeoutMs,
      });
      return Object.freeze({
        anchors: await extractedAnchors(page),
        finalPath: pathFor(finalURL),
        kind: "accepted",
      });
    } catch {
      const finalURL = httpURL(page.url());
      return Object.freeze({
        kind:
          finalURL !== undefined &&
          finalURL.origin !== canonicalBaseURL.origin
            ? "skipped"
            : "failed",
      });
    }
  });
}

/**
 * Discovers a bounded public route surface in deterministic first-seen order.
 * One Chromium process is reused while every attempted page receives a fresh
 * browser context.
 */
export async function discoverPublicRoutes(
  url: string,
  options: DiscoverPublicRoutesOptions = {},
): Promise<PublicRouteDiscovery> {
  const settings = settingsFor(url, options);
  const browser = await chromium.launch(settings.launchOptions);
  try {
    const first = await initialPage(browser, settings);
    const canonicalBaseURL = new URL("/", first.finalURL.origin);
    const routes: DiscoveredPublicRoute[] = [
      Object.freeze({ path: pathFor(first.finalURL) }),
    ];
    const acceptedPaths = new Set(routes.map((route) => route.path));
    const seenCandidates = new Set(acceptedPaths);
    const queue: string[] = [];
    let attemptedPages = 1;
    let skippedPages = 0;
    let truncatedAnchorPages = first.anchors.truncated ? 1 : 0;

    const enqueue = (anchors: ExtractedAnchors): void => {
      for (const href of anchors.hrefs) {
        const path = normalizedCandidate(href, canonicalBaseURL.origin);
        if (path !== undefined && !seenCandidates.has(path)) {
          seenCandidates.add(path);
          queue.push(path);
        }
      }
    };
    enqueue(first.anchors);

    while (queue.length > 0 && attemptedPages < settings.maxPages) {
      const requestedPath = queue.shift()!;
      if (acceptedPaths.has(requestedPath)) {
        continue;
      }
      const requestedURL = new URL(canonicalBaseURL);
      requestedURL.pathname = requestedPath;
      attemptedPages += 1;
      const candidate = await candidatePage(
        browser,
        requestedURL,
        canonicalBaseURL,
        settings,
      );
      if (candidate.kind === "skipped") {
        skippedPages += 1;
        continue;
      }

      const acceptedPath =
        candidate.kind === "accepted" && candidate.finalPath !== undefined
          ? candidate.finalPath
          : requestedPath;
      seenCandidates.add(acceptedPath);
      if (!acceptedPaths.has(acceptedPath)) {
        acceptedPaths.add(acceptedPath);
        routes.push(Object.freeze({ path: acceptedPath }));
      }
      if (candidate.anchors !== undefined) {
        if (candidate.anchors.truncated) {
          truncatedAnchorPages += 1;
        }
        enqueue(candidate.anchors);
      }
    }

    return Object.freeze({
      attemptedPages,
      baseURL: canonicalBaseURL.href,
      routes: Object.freeze(routes),
      skippedPages,
      truncatedAnchorPages,
    });
  } finally {
    await browser.close();
  }
}

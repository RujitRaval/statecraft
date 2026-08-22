import type { Page, Request } from "playwright";

export const defaultNavigationTimeoutMs = 30_000;
export const defaultReadinessTimeoutMs = 10_000;

const stabilityStyles = `
*, *::before, *::after {
  animation: none !important;
  caret-color: transparent !important;
  scroll-behavior: auto !important;
  transition: none !important;
}
`;

export interface DeterministicReadinessSettings {
  readonly baseURL: URL;
  readonly selector?: string | undefined;
  readonly timeoutMs: number;
}

/** @internal A live guard against replacement main-frame documents. */
export interface DocumentNavigationGuard {
  assertStable(): void;
  stop(): void;
}

/** A main-frame document changed during a deterministic evidence window. */
export class DocumentNavigationError extends Error {
  constructor(origin: string | undefined) {
    super(
      origin === undefined
        ? "Navigation cannot change the document during deterministic evidence capture."
        : `Navigation must stay on the configured origin (received ${origin}).`,
    );
    this.name = "DocumentNavigationError";
  }
}

export function positiveSafeInteger(
  value: number | undefined,
  defaultValue: number,
  label: string,
): number {
  if (value === undefined) {
    return defaultValue;
  }
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new TypeError(`${label} must be a positive safe integer.`);
  }
  return value;
}

export function assertPageOrigin(page: Page, baseURL: URL): void {
  const pageOrigin = new URL(page.url()).origin;
  if (pageOrigin !== baseURL.origin) {
    throw new TypeError(
      `Navigation must stay on the configured origin (received ${pageOrigin}).`,
    );
  }
}

/** @internal Watches until stopped and reports any replacement document request. */
export function guardDocumentNavigation(
  page: Page,
  baseURL: URL,
): DocumentNavigationGuard {
  let replacementOrigin: string | undefined;
  let replacementStarted = false;
  const track = (request: Request): void => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
      replacementStarted = true;
      try {
        const origin = new URL(request.url()).origin;
        if (origin !== baseURL.origin) {
          replacementOrigin = origin;
        }
      } catch {
        replacementOrigin = "[invalid origin]";
      }
    }
  };
  page.on("request", track);
  return Object.freeze({
    assertStable(): void {
      if (replacementStarted) {
        throw new DocumentNavigationError(replacementOrigin);
      }
    },
    stop(): void {
      page.off("request", track);
    },
  });
}

export async function settleDeterministicReadiness(
  page: Page,
  settings: DeterministicReadinessSettings,
): Promise<void> {
  let documentNavigationURL: URL | undefined;
  const trackDocumentNavigation = (request: Request): void => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
      documentNavigationURL = new URL(request.url());
    }
  };
  const rejectDocumentNavigation = (): never => {
    if (
      documentNavigationURL !== undefined &&
      documentNavigationURL.origin !== settings.baseURL.origin
    ) {
      throw new TypeError(
        `Navigation must stay on the configured origin (received ${documentNavigationURL.origin}).`,
      );
    }
    throw new TypeError(
      "Navigation cannot change the document during deterministic readiness.",
    );
  };

  page.on("request", trackDocumentNavigation);
  try {
    try {
      await page.addStyleTag({ content: stabilityStyles });
      await page.waitForLoadState("load", { timeout: settings.timeoutMs });
      if (settings.selector !== undefined) {
        await page.locator(settings.selector).waitFor({
          state: "visible",
          timeout: settings.timeoutMs,
        });
      }
      await page.waitForFunction(
        () => !("fonts" in document) || document.fonts.status === "loaded",
        undefined,
        { timeout: settings.timeoutMs },
      );
    } catch (cause: unknown) {
      if (documentNavigationURL !== undefined) {
        rejectDocumentNavigation();
      }
      throw cause;
    }

    if (documentNavigationURL !== undefined) {
      rejectDocumentNavigation();
    }
  } finally {
    page.off("request", trackDocumentNavigation);
  }
}

import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  AuthenticationStateError,
  validateAuthenticationStorageState,
  type AuthenticationConfig,
  type AuthenticationStorageState,
} from "uiwitness-core";
import type { Browser, BrowserContext, Page } from "playwright";

/** Playwright primitives supplied to one trusted once-per-run login hook. */
export interface AuthSetupContext {
  readonly context: BrowserContext;
  readonly page: Page;
}

/** Trusted local authentication code. It must return no value. */
export type AuthSetup = (context: AuthSetupContext) => Promise<void>;

/** Inputs for one memory-only shared-read-only authentication setup. */
export interface RunAuthenticationOptions {
  readonly baseURL: string;
  readonly config: AuthenticationConfig;
  readonly setupBaseDirectory?: string | undefined;
}

/** Stable run-level authentication failure categories. */
export type AuthenticationErrorCode =
  | "AUTH_COOKIE_NOT_ALLOWED"
  | "AUTH_ORIGIN_NOT_ALLOWED"
  | "AUTH_SETUP_FAILED"
  | "AUTH_SETUP_INVALID";

/** Authentication failed before any execution cell could be created. */
export class AuthenticationError extends Error {
  readonly code: AuthenticationErrorCode;
  readonly setupPath: string;

  constructor(code: AuthenticationErrorCode, setupPath: string) {
    super(`${code}: Authentication setup could not seed the run (${setupPath}).`);
    this.name = "AuthenticationError";
    this.code = code;
    this.setupPath = setupPath;
  }
}

async function loadAuthSetup(
  setupPath: string,
  baseDirectory: string,
): Promise<AuthSetup> {
  const moduleUrl = pathToFileURL(path.resolve(baseDirectory, setupPath));
  let namespace: unknown;
  try {
    namespace = await import(moduleUrl.href);
  } catch {
    throw new AuthenticationError("AUTH_SETUP_INVALID", setupPath);
  }
  const hook = typeof namespace === "object" && namespace !== null
    ? (namespace as Readonly<Record<string, unknown>>)["default"]
    : undefined;
  if (typeof hook !== "function") {
    throw new AuthenticationError("AUTH_SETUP_INVALID", setupPath);
  }
  return hook as AuthSetup;
}

/** @internal Runs trusted login once and returns only validated in-memory state. */
export async function prepareAuthenticationState(
  browser: Browser,
  options: RunAuthenticationOptions,
): Promise<AuthenticationStorageState> {
  const setupPath = options.config.setup;
  let baseURL: URL;
  try {
    baseURL = new URL(options.baseURL);
  } catch {
    throw new AuthenticationError("AUTH_SETUP_INVALID", setupPath);
  }
  if (
    setupPath.trim().length === 0 ||
    setupPath.length > 1_024 ||
    baseURL.username.length > 0 ||
    baseURL.password.length > 0 ||
    (options.config.mode !== undefined &&
      options.config.mode !== "shared-readonly")
  ) {
    throw new AuthenticationError("AUTH_SETUP_INVALID", setupPath);
  }
  try {
    validateAuthenticationStorageState({ cookies: [], origins: [] }, {
      authentication: options.config,
      baseURL: options.baseURL,
    });
  } catch (error: unknown) {
    if (error instanceof AuthenticationStateError) {
      throw new AuthenticationError(error.code, setupPath);
    }
    throw new AuthenticationError("AUTH_SETUP_INVALID", setupPath);
  }
  const setup = await loadAuthSetup(
    setupPath,
    options.setupBaseDirectory ?? process.cwd(),
  );
  let context: BrowserContext | undefined;
  let state: AuthenticationStorageState | undefined;
  let failure: AuthenticationError | undefined;
  try {
    context = await browser.newContext();
    const page = await context.newPage();
    let result: unknown;
    try {
      result = await setup(Object.freeze({ context, page }));
    } catch {
      throw new AuthenticationError("AUTH_SETUP_FAILED", setupPath);
    }
    if (result !== undefined) {
      throw new AuthenticationError("AUTH_SETUP_INVALID", setupPath);
    }
    const rawState = await context.storageState();
    try {
      state = validateAuthenticationStorageState(rawState, {
        authentication: options.config,
        baseURL: options.baseURL,
      });
    } catch (error: unknown) {
      if (error instanceof AuthenticationStateError) {
        throw new AuthenticationError(error.code, setupPath);
      }
      throw new AuthenticationError("AUTH_SETUP_FAILED", setupPath);
    }
  } catch (error: unknown) {
    failure = error instanceof AuthenticationError
      ? error
      : new AuthenticationError("AUTH_SETUP_FAILED", setupPath);
  }
  if (context !== undefined) {
    try {
      await context.close();
    } catch {
      failure = new AuthenticationError("AUTH_SETUP_FAILED", setupPath);
    }
  }
  if (failure !== undefined) throw failure;
  if (state === undefined) {
    throw new AuthenticationError("AUTH_SETUP_FAILED", setupPath);
  }
  return state;
}

import { describe, expect, it } from "vitest";

import {
  AuthenticationStateError,
  parseConfig,
  validateAuthenticationStorageState,
  type AuthenticationConfig,
} from "../src/index.js";

function authentication(): AuthenticationConfig {
  const config = parseConfig({
    authentication: {
      additionalOrigins: ["https://id.example.com"],
      cookieScopes: [{
        domain: ".example.com",
        partitionKeys: ["https://app.example.com"],
        pathPrefix: "/account",
        secure: "required",
      }],
      setup: "./uiwitness/auth.mjs",
    },
    baseURL: "https://app.example.com",
    routes: [{
      id: "settings",
      path: "/settings",
      states: [{ id: "billing", setup: "./uiwitness/billing.mjs" }],
    }],
    themes: ["light"],
    viewports: { desktop: { height: 900, width: 1_440 } },
  });
  return config.authentication!;
}

function credentialedURL(value: string): string {
  const url = new URL(value);
  url.username = "test-user";
  url.password = "test-password";
  return url.href;
}

function cookie(overrides: Readonly<Record<string, unknown>> = {}): unknown {
  return {
    domain: "app.example.com",
    expires: -1,
    httpOnly: true,
    name: "session",
    path: "/",
    sameSite: "Lax",
    secure: true,
    value: "SECRET_COOKIE_CANARY",
    ...overrides,
  };
}

function state(overrides: Readonly<Record<string, unknown>> = {}): unknown {
  return {
    cookies: [cookie()],
    origins: [{
      localStorage: [{ name: "token", value: "SECRET_STORAGE_CANARY" }],
      origin: "https://app.example.com",
    }],
    ...overrides,
  };
}

function capture(input: unknown): AuthenticationStateError {
  try {
    validateAuthenticationStorageState(input, {
      authentication: authentication(),
      baseURL: "https://app.example.com/dashboard",
    });
  } catch (error: unknown) {
    expect(error).toBeInstanceOf(AuthenticationStateError);
    return error as AuthenticationStateError;
  }
  throw new Error("Expected authentication storage validation to fail.");
}

describe("validateAuthenticationStorageState", () => {
  it("accepts exact app cookies and allowlisted local storage without mutation", () => {
    const input = state();
    const result = validateAuthenticationStorageState(input, {
      authentication: authentication(),
      baseURL: "https://app.example.com/dashboard",
    });

    expect(result).toEqual({
      cookies: [cookie()],
      origins: [{
        localStorage: [{ name: "token", value: "SECRET_STORAGE_CANARY" }],
        origin: "https://app.example.com:443",
      }],
    });
    expect(result).not.toBe(input);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.cookies)).toBe(true);
    expect(Object.isFrozen(result.origins[0]?.localStorage)).toBe(true);
  });

  it("accepts explicit parent-domain, path, secure, and partition scope", () => {
    const result = validateAuthenticationStorageState(state({
      cookies: [cookie({
        domain: ".example.com",
        partitionKey: "https://app.example.com",
        path: "/account/settings",
      })],
      origins: [{ localStorage: [], origin: "https://id.example.com" }],
    }), {
      authentication: authentication(),
      baseURL: "https://app.example.com",
    });

    expect(result.cookies[0]?.partitionKey).toBe(
      "https://app.example.com:443",
    );
    expect(result.origins[0]?.origin).toBe("https://id.example.com:443");
  });

  it("accepts a scoped insecure cookie only when insecure use is permitted", () => {
    const configured = authentication();
    const result = validateAuthenticationStorageState(state({
      cookies: [cookie({
        domain: ".example.com",
        path: "/account",
        secure: false,
      })],
      origins: [],
    }), {
      authentication: {
        ...configured,
        cookieScopes: [{
          domain: ".example.com",
          pathPrefix: "/account",
          secure: "permitted",
        }],
      },
      baseURL: "https://app.example.com",
    });

    expect(result.cookies[0]?.secure).toBe(false);
  });

  it("accepts one exact localhost cookie for local development", () => {
    const result = validateAuthenticationStorageState({
      cookies: [cookie({ domain: "localhost", secure: false })],
      origins: [],
    }, {
      authentication: { setup: "./auth.mjs" },
      baseURL: "http://localhost:3000",
    });

    expect(result.cookies[0]?.domain).toBe("localhost");
  });

  it.each([
    ["parent domain", cookie({ domain: ".example.com" })],
    ["sibling domain", cookie({ domain: "id.example.com" })],
    ["public suffix", cookie({ domain: ".com" })],
    ["private public suffix", cookie({ domain: ".github.io" })],
    ["default-rule public suffix", cookie({ domain: ".internal" })],
    ["insecure scoped cookie", cookie({ domain: ".example.com", path: "/account", secure: false })],
    ["wrong scoped path", cookie({ domain: ".example.com", path: "/admin" })],
    ["unexpected partition", cookie({ partitionKey: "https://app.example.com" })],
    ["wrong partition", cookie({ domain: ".example.com", path: "/account", partitionKey: "https://id.example.com" })],
    ["unrelated domain", cookie({ domain: ".attacker.example" })],
    ["uppercase domain", cookie({ domain: "APP.EXAMPLE.COM" })],
  ])("rejects a %s cookie opaquely", (_label, scopedCookie) => {
    const error = capture(state({ cookies: [scopedCookie] }));

    expect(error.code).toBe("AUTH_COOKIE_NOT_ALLOWED");
    expect(error.message).not.toMatch(/SECRET|session|example\.com/u);
  });

  it.each([
    "https://other.example.com",
    "https://app.example.com/path",
    credentialedURL("https://app.example.com"),
    "file:///tmp/state",
  ])("rejects local storage for unsafe origin %s opaquely", (origin) => {
    const error = capture(state({
      origins: [{
        localStorage: [{ name: "token", value: "SECRET_STORAGE_CANARY" }],
        origin,
      }],
    }));

    expect(error.code).toBe("AUTH_ORIGIN_NOT_ALLOWED");
    expect(error.message).not.toMatch(/SECRET|token|other\.example/u);
  });

  it.each([
    null,
    {},
    { cookies: "not-an-array", origins: [] },
    { cookies: [], origins: [{ localStorage: [{ name: "token" }], origin: "https://app.example.com" }] },
  ])("rejects malformed storage state opaquely", (input) => {
    const error = capture(input);

    expect(error.message).not.toMatch(/token|SECRET/u);
  });

  it("rejects a credentialed validator base URL opaquely", () => {
    const error = (() => {
      try {
        validateAuthenticationStorageState(state(), {
          authentication: authentication(),
          baseURL: credentialedURL("https://app.example.com"),
        });
      } catch (reason: unknown) {
        return reason as AuthenticationStateError;
      }
      throw new Error("Expected credentialed auth validation to fail.");
    })();

    expect(error.code).toBe("AUTH_ORIGIN_NOT_ALLOWED");
    expect(String(error)).not.toContain("user:secret");
  });
});

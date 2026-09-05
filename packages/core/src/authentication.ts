import { parse as parseDomain } from "tldts";

/** The only authentication reuse mode supported by the first auth protocol. */
export type AuthenticationMode = "shared-readonly";

/** An explicit cookie boundary that may be copied into fresh execution contexts. */
export interface AuthenticationCookieScope {
  readonly domain: string;
  readonly partitionKeys?: readonly string[] | undefined;
  readonly pathPrefix: string;
  readonly secure: "permitted" | "required";
}

/** Trusted local login setup plus the exact browser-state boundaries it may seed. */
export interface AuthenticationConfig {
  readonly additionalOrigins?: readonly string[] | undefined;
  readonly cookieScopes?: readonly AuthenticationCookieScope[] | undefined;
  readonly mode?: AuthenticationMode | undefined;
  readonly setup: string;
}

/** Browser-neutral cookie shape accepted from Playwright's in-memory storage state. */
export interface AuthenticationStorageCookie {
  readonly domain: string;
  readonly expires: number;
  readonly httpOnly: boolean;
  readonly name: string;
  readonly partitionKey?: string | undefined;
  readonly path: string;
  readonly sameSite: "Lax" | "None" | "Strict";
  readonly secure: boolean;
  readonly value: string;
}

/** Browser-neutral local-storage entry accepted from Playwright. */
export interface AuthenticationLocalStorageEntry {
  readonly name: string;
  readonly value: string;
}

/** Browser-neutral origin state accepted from Playwright. */
export interface AuthenticationOriginStorage {
  readonly localStorage: readonly AuthenticationLocalStorageEntry[];
  readonly origin: string;
}

/** Validated ephemeral state that may seed an otherwise-fresh browser context. */
export interface AuthenticationStorageState {
  readonly cookies: readonly AuthenticationStorageCookie[];
  readonly origins: readonly AuthenticationOriginStorage[];
}

/** Stable authentication-state rejection categories. */
export type AuthenticationStateErrorCode =
  | "AUTH_COOKIE_NOT_ALLOWED"
  | "AUTH_ORIGIN_NOT_ALLOWED";

/** An authentication setup produced browser state outside its declared boundary. */
export class AuthenticationStateError extends Error {
  readonly code: AuthenticationStateErrorCode;

  constructor(code: AuthenticationStateErrorCode, message: string) {
    super(message);
    this.name = "AuthenticationStateError";
    this.code = code;
  }
}

interface ValidateAuthenticationStorageStateOptions {
  readonly authentication: AuthenticationConfig;
  readonly baseURL: string;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function effectivePort(url: URL): string {
  if (url.port.length > 0) return url.port;
  return url.protocol === "https:" ? "443" : "80";
}

/** @internal Returns one canonical HTTP(S) origin or null for an unsafe input. */
export function normalizedAuthenticationOrigin(value: string): string | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (
    (url.protocol !== "http:" && url.protocol !== "https:") ||
    url.username.length > 0 ||
    url.password.length > 0 ||
    url.pathname !== "/" ||
    url.search.length > 0 ||
    url.hash.length > 0
  ) {
    return null;
  }
  return `${url.protocol}//${url.hostname}:${effectivePort(url)}`;
}

const domainLabel = "[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?";
const cookieDomainPattern = new RegExp(
  `^\\.?${domainLabel}(?:\\.${domainLabel})*$`,
  "u",
);

/** @internal Validates the normalized ASCII form required by cookie scopes. */
export function validAuthenticationCookieDomain(value: string): boolean {
  if (value.length > 253) return false;
  if (cookieDomainPattern.test(value)) return true;
  return !value.startsWith(".") && parseDomain(value, {
    allowPrivateDomains: true,
    extractHostname: false,
  }).isIp === true;
}

/** @internal Rejects both ICANN and private Public Suffix List boundaries. */
export function authenticationCookieDomainIsPublicSuffix(value: string): boolean {
  const domain = value.startsWith(".") ? value.slice(1) : value;
  const parsed = parseDomain(domain, {
    allowPrivateDomains: true,
    extractHostname: false,
  });
  if (parsed.isIp === true || domain === "localhost") return false;
  return parsed.domain === null && parsed.publicSuffix === domain;
}

function cookieFailure(): never {
  throw new AuthenticationStateError(
    "AUTH_COOKIE_NOT_ALLOWED",
    "Authentication setup produced a cookie outside the configured scope.",
  );
}

function originFailure(): never {
  throw new AuthenticationStateError(
    "AUTH_ORIGIN_NOT_ALLOWED",
    "Authentication setup produced local storage outside the configured origins.",
  );
}

function stringField(record: Readonly<Record<string, unknown>>, key: string): string {
  const value = record[key];
  if (typeof value !== "string") cookieFailure();
  return value;
}

function booleanField(record: Readonly<Record<string, unknown>>, key: string): boolean {
  const value = record[key];
  if (typeof value !== "boolean") cookieFailure();
  return value;
}

function cookieDomainMatchesHost(cookieDomain: string, host: string): boolean {
  const domain = cookieDomain.startsWith(".")
    ? cookieDomain.slice(1)
    : cookieDomain;
  return host === domain || host.endsWith(`.${domain}`);
}

function allowedOriginHosts(origins: ReadonlySet<string>): readonly string[] {
  return Object.freeze([...origins].map((origin) => new URL(origin).hostname));
}

function matchingScope(
  cookie: AuthenticationStorageCookie,
  scopes: readonly AuthenticationCookieScope[],
): AuthenticationCookieScope | undefined {
  return scopes.find((scope) => {
    if (scope.domain !== cookie.domain || !cookie.path.startsWith(scope.pathPrefix)) {
      return false;
    }
    if (scope.secure === "required" && !cookie.secure) return false;
    if (cookie.partitionKey === undefined) return true;
    return scope.partitionKeys?.some(
      (key) => normalizedAuthenticationOrigin(key) === cookie.partitionKey,
    ) === true;
  });
}

function validatedScopes(
  scopes: readonly AuthenticationCookieScope[],
  originHosts: readonly string[],
): readonly AuthenticationCookieScope[] {
  return Object.freeze(scopes.map((scope) => {
    if (
      !validAuthenticationCookieDomain(scope.domain) ||
      authenticationCookieDomainIsPublicSuffix(scope.domain) ||
      scope.pathPrefix.length === 0 ||
      scope.pathPrefix.length > 1_024 ||
      !scope.pathPrefix.startsWith("/") ||
      (scope.secure !== "permitted" && scope.secure !== "required") ||
      !originHosts.some((host) => cookieDomainMatchesHost(scope.domain, host))
    ) {
      cookieFailure();
    }
    const partitionKeys = scope.partitionKeys?.map((key) => {
      const normalized = normalizedAuthenticationOrigin(key);
      if (normalized === null) cookieFailure();
      return normalized;
    });
    return Object.freeze({
      domain: scope.domain,
      ...(partitionKeys === undefined
        ? {}
        : { partitionKeys: Object.freeze(partitionKeys) }),
      pathPrefix: scope.pathPrefix,
      secure: scope.secure,
    });
  }));
}

function validatedCookie(
  input: unknown,
  applicationHost: string,
  originHosts: readonly string[],
  scopes: readonly AuthenticationCookieScope[],
): AuthenticationStorageCookie {
  if (!isRecord(input)) cookieFailure();
  const domain = stringField(input, "domain");
  const path = stringField(input, "path");
  const expires = input["expires"];
  const sameSite = input["sameSite"];
  const partitionKey = input["partitionKey"];
  if (
    !validAuthenticationCookieDomain(domain) ||
    authenticationCookieDomainIsPublicSuffix(domain) ||
    path.length === 0 ||
    !path.startsWith("/") ||
    typeof expires !== "number" ||
    !Number.isFinite(expires) ||
    (sameSite !== "Lax" && sameSite !== "None" && sameSite !== "Strict") ||
    (partitionKey !== undefined && typeof partitionKey !== "string")
  ) {
    cookieFailure();
  }
  let normalizedPartitionKey: string | undefined;
  if (partitionKey !== undefined) {
    const normalized = normalizedAuthenticationOrigin(partitionKey);
    if (normalized === null) cookieFailure();
    normalizedPartitionKey = normalized;
  }
  const cookie: AuthenticationStorageCookie = Object.freeze({
    domain,
    expires,
    httpOnly: booleanField(input, "httpOnly"),
    name: stringField(input, "name"),
    ...(normalizedPartitionKey === undefined
      ? {}
      : { partitionKey: normalizedPartitionKey }),
    path,
    sameSite,
    secure: booleanField(input, "secure"),
    value: stringField(input, "value"),
  });
  if (!originHosts.some((host) => cookieDomainMatchesHost(domain, host))) {
    cookieFailure();
  }
  const implicitApplicationCookie =
    !domain.startsWith(".") &&
    domain === applicationHost &&
    cookie.partitionKey === undefined;
  if (!implicitApplicationCookie && matchingScope(cookie, scopes) === undefined) {
    cookieFailure();
  }
  return cookie;
}

function validatedOrigin(
  input: unknown,
  allowedOrigins: ReadonlySet<string>,
): AuthenticationOriginStorage {
  if (!isRecord(input) || !Array.isArray(input["localStorage"])) originFailure();
  const rawOrigin = input["origin"];
  if (typeof rawOrigin !== "string") originFailure();
  const origin = normalizedAuthenticationOrigin(rawOrigin);
  if (origin === null || !allowedOrigins.has(origin)) originFailure();
  const localStorage = input["localStorage"].map((entry) => {
    if (!isRecord(entry) || typeof entry["name"] !== "string" ||
      typeof entry["value"] !== "string") {
      originFailure();
    }
    return Object.freeze({ name: entry["name"], value: entry["value"] });
  });
  return Object.freeze({ localStorage: Object.freeze(localStorage), origin });
}

/**
 * Validates a memory-only browser storage state against one exact auth policy.
 * Rejections intentionally never include cookie, local-storage, or secret values.
 */
export function validateAuthenticationStorageState(
  input: unknown,
  options: ValidateAuthenticationStorageStateOptions,
): AuthenticationStorageState {
  if (!isRecord(input) || !Array.isArray(input["cookies"]) ||
    !Array.isArray(input["origins"])) {
    originFailure();
  }
  let baseURL: URL;
  try {
    baseURL = new URL(options.baseURL);
  } catch {
    originFailure();
  }
  if (baseURL.username.length > 0 || baseURL.password.length > 0) {
    originFailure();
  }
  const applicationOrigin = normalizedAuthenticationOrigin(baseURL.origin);
  if (applicationOrigin === null) originFailure();
  const allowedOrigins = new Set<string>([applicationOrigin]);
  for (const value of options.authentication.additionalOrigins ?? []) {
    const normalized = normalizedAuthenticationOrigin(value);
    if (normalized === null) originFailure();
    allowedOrigins.add(normalized);
  }
  const origins = input["origins"].map((origin) =>
    validatedOrigin(origin, allowedOrigins)
  );
  const originHosts = allowedOriginHosts(allowedOrigins);
  const applicationHost = new URL(applicationOrigin).hostname;
  const scopes = validatedScopes(
    options.authentication.cookieScopes ?? [],
    originHosts,
  );
  const cookies = input["cookies"].map((cookie) =>
    validatedCookie(cookie, applicationHost, originHosts, scopes)
  );
  return Object.freeze({
    cookies: Object.freeze(cookies),
    origins: Object.freeze(origins),
  });
}

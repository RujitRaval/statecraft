import assert from "node:assert/strict";
import { once } from "node:events";
import {
  lstat,
  mkdtemp,
  readFile,
  realpath,
  rm,
} from "node:fs/promises";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { RELEASE_PACKAGES } from "./check-release-packages.mjs";
import { runCommand } from "./release-package-smoke.mjs";

export const NPM_REGISTRY = "https://registry.npmjs.org/";
const runnerManifest = JSON.parse(
  readFileSync(
    path.resolve(import.meta.dirname, "..", "packages", "runner-playwright", "package.json"),
    "utf8",
  ),
);
export const PLAYWRIGHT_VERSION = runnerManifest.dependencies.playwright;
if (!/^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/u.test(PLAYWRIGHT_VERSION)) {
  throw new Error("The runner must declare one exact stable Playwright version.");
}

export const REGISTRY_INSTALL_RETRY_WINDOW_MS = 600_000;
export const REGISTRY_INSTALL_RETRY_DELAY_MS = 10_000;
const installAttempts =
  Math.ceil(REGISTRY_INSTALL_RETRY_WINDOW_MS / REGISTRY_INSTALL_RETRY_DELAY_MS) + 1;
const initializeTimeout = 60_000;
const installTimeout = 30_000;
const chromiumTimeout = 180_000;
const cliTimeout = 120_000;
const publicRoutes = ["/", "/about"];
const publicViewports = ["desktop", "mobile"];
const publicThemes = ["light", "dark"];

export function normalizeRegistrySmokeVersion(value) {
  if (typeof value !== "string") {
    throw new TypeError("Registry smoke version must be a string.");
  }
  const normalized = value.startsWith("v") ? value.slice(1) : value;
  if (!/^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/u.test(normalized)) {
    throw new Error(`Expected an npm version such as 0.24.9, received ${JSON.stringify(value)}.`);
  }
  return normalized;
}

export function parseRegistrySmokeArguments(arguments_) {
  let tag;
  let version;
  let withDeps = false;
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === "--with-deps") {
      if (withDeps) throw new Error("--with-deps can be specified only once.");
      withDeps = true;
      continue;
    }
    if (!["--tag", "--version"].includes(argument)) {
      throw new Error(`Unknown option: ${argument}`);
    }
    const value = arguments_[index + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`${argument} requires a value.`);
    }
    if (argument === "--tag") {
      if (tag !== undefined) throw new Error("--tag can be specified only once.");
      tag = value;
    } else {
      if (version !== undefined) throw new Error("--version can be specified only once.");
      version = value;
    }
    index += 1;
  }
  if ((tag === undefined) === (version === undefined)) {
    throw new Error("Specify exactly one of --tag <vMAJOR.MINOR.PATCH> or --version <MAJOR.MINOR.PATCH>.");
  }
  return { version: normalizeRegistrySmokeVersion(tag ?? version), withDeps };
}

function assertCommand(result, label, expectedCode = 0) {
  assert.equal(
    result.code,
    expectedCode,
    `${label} exited ${String(result.code)}${result.signal ? ` (${result.signal})` : ""}:\n${result.stderr || result.stdout}`,
  );
}

function retryableRegistryFailure(result) {
  const output = `${result.stderr}\n${result.stdout}`;
  return /(?:E404|ETARGET|EAI_AGAIN|ECONNRESET|ETIMEDOUT|No matching version|notarget|not in this registry|\b50[234]\b)/iu.test(output);
}

function retryableRegistryError(error) {
  return error instanceof Error && /(?:npm exceeded \d+ms|EAI_AGAIN|ECONNRESET|ETIMEDOUT)/iu.test(error.message);
}

export async function installRegistryConsumer({
  consumerRoot,
  execute = runCommand,
  registry = NPM_REGISTRY,
  sleep = (duration) => new Promise((resolve) => setTimeout(resolve, duration)),
  now = Date.now,
  version,
  withDeps = false,
} = {}) {
  assert.equal(typeof consumerRoot, "string");
  const normalizedVersion = normalizeRegistrySmokeVersion(version);
  const initialize = await execute("npm", ["init", "--yes"], {
    cwd: consumerRoot,
    timeout: initializeTimeout,
  });
  assertCommand(initialize, "Initializing an empty npm consumer");

  const installArguments = [
    "install",
    "--save-dev",
    "--save-exact",
    "--ignore-scripts",
    "--no-audit",
    "--no-fund",
    "--package-lock=false",
    "--registry",
    registry,
  ];
  const installSpecifications = [
    `uiwitness@${normalizedVersion}`,
    `playwright@${PLAYWRIGHT_VERSION}`,
  ];
  const installRetryDeadline = now() + REGISTRY_INSTALL_RETRY_WINDOW_MS;
  let install;
  for (let attempt = 1; attempt <= installAttempts; attempt += 1) {
    const attemptArguments = [
      ...installArguments,
      "--prefer-online",
      "--cache",
      path.join(consumerRoot, ".npm-cache", `install-${attempt}`),
      ...installSpecifications,
    ];
    try {
      install = await execute("npm", attemptArguments, {
        cwd: consumerRoot,
        timeout: installTimeout,
      });
    } catch (error) {
      if (attempt === installAttempts || !retryableRegistryError(error)) throw error;
      const remainingRetryWindow = installRetryDeadline - now();
      if (remainingRetryWindow <= 0) throw error;
      await sleep(Math.min(REGISTRY_INSTALL_RETRY_DELAY_MS, remainingRetryWindow));
      continue;
    }
    if (install.code === 0) break;
    if (attempt === installAttempts || !retryableRegistryFailure(install)) {
      assertCommand(install, "Installing exact npm registry packages");
    }
    const remainingRetryWindow = installRetryDeadline - now();
    if (remainingRetryWindow <= 0) {
      assertCommand(install, "Installing exact npm registry packages");
    }
    await sleep(Math.min(REGISTRY_INSTALL_RETRY_DELAY_MS, remainingRetryWindow));
  }
  assertCommand(install, "Installing exact npm registry packages");

  const chromium = await execute(
    "npm",
    [
      "exec",
      "--offline",
      "--",
      "playwright",
      "install",
      ...(withDeps ? ["--with-deps"] : []),
      "chromium",
    ],
    { cwd: consumerRoot, timeout: chromiumTimeout },
  );
  assertCommand(chromium, "Installing Chromium from the registry consumer");
  return { version: normalizedVersion };
}

async function installedManifest(consumerRoot, packageName) {
  return JSON.parse(
    await readFile(path.join(consumerRoot, "node_modules", packageName, "package.json"), "utf8"),
  );
}

export async function assertRegistryInstall(consumerRoot, version) {
  const rootManifest = JSON.parse(await readFile(path.join(consumerRoot, "package.json"), "utf8"));
  assert.equal(
    rootManifest.type === undefined || rootManifest.type === "commonjs",
    true,
    "npm init -y must produce either implicit or explicit CommonJS package mode.",
  );
  assert.equal(rootManifest.devDependencies["uiwitness"], version);
  assert.equal(rootManifest.devDependencies.playwright, PLAYWRIGHT_VERSION);

  for (const contract of RELEASE_PACKAGES) {
    const manifest = await installedManifest(consumerRoot, contract.name);
    assert.equal(manifest.name, contract.name);
    assert.equal(manifest.version, version, `${contract.name} did not resolve to the release version.`);
  }
  const runner = await installedManifest(consumerRoot, "uiwitness-runner-playwright");
  assert.equal(runner.dependencies.playwright, PLAYWRIGHT_VERSION);
  const playwright = await installedManifest(consumerRoot, "playwright");
  assert.equal(playwright.version, PLAYWRIGHT_VERSION);

  const cliManifest = await installedManifest(consumerRoot, "uiwitness");
  assert.equal(cliManifest.bin.uiwitness, "./dist/bin.js");
  return path.join(consumerRoot, "node_modules", "uiwitness", cliManifest.bin.uiwitness);
}

function expectedCoordinates() {
  return publicRoutes.flatMap((routePath) =>
    publicViewports.flatMap((viewportId) =>
      publicThemes.map((theme) => `${routePath}|public|${viewportId}|${theme}|passed`),
    ),
  ).sort();
}

export async function assertPublicReport(consumerRoot) {
  const reportPath = path.join(consumerRoot, ".uiwitness", "report", "uiwitness.json");
  const report = JSON.parse(await readFile(reportPath, "utf8"));
  assert.equal(report.schemaVersion, 1);
  assert.deepEqual(
    {
      executions: report.summary.executions,
      failed: report.summary.failed,
      passed: report.summary.passed,
    },
    { executions: 8, failed: 0, passed: 8 },
  );
  assert.deepEqual(
    report.executions.map((execution) =>
      [
        execution.routePath,
        execution.stateId,
        execution.viewportId,
        execution.theme,
        execution.status,
      ].join("|"),
    ).sort(),
    expectedCoordinates(),
  );

  const artifactRoot = path.join(consumerRoot, ".uiwitness", "artifacts");
  const consumerRootReal = await realpath(consumerRoot);
  const artifactRootReal = await realpath(artifactRoot);
  assert.equal(
    artifactRootReal.startsWith(`${consumerRootReal}${path.sep}`),
    true,
    "Artifact root resolved outside the registry consumer.",
  );
  const artifactPrefix = `${artifactRootReal}${path.sep}`;
  for (const execution of report.executions) {
    assert.equal(typeof execution.screenshotPath, "string");
    const screenshot = path.resolve(consumerRoot, execution.screenshotPath);
    const screenshotReal = await realpath(screenshot);
    assert.equal(screenshotReal.startsWith(artifactPrefix), true);
    const metadata = await lstat(screenshot);
    assert.equal(metadata.isSymbolicLink(), false);
    assert.equal(metadata.isFile(), true);
    assert.equal(metadata.size > 0, true);
  }
  const html = await readFile(path.join(consumerRoot, ".uiwitness", "report", "index.html"), "utf8");
  assert.match(html, /data-brand-system="kinetic-evidence-v1"/u);
  return expectedCoordinates();
}

export async function runRegistryJourney({
  cliBinPath,
  consumerRoot,
  execute = runCommand,
  fixtureUrl,
} = {}) {
  const runCli = (arguments_) => execute(process.execPath, [cliBinPath, ...arguments_], {
    cwd: consumerRoot,
    timeout: cliTimeout,
  });
  const configPath = path.join(consumerRoot, "statecraft.config.mts");
  const scenarioPath = path.join(consumerRoot, "statecraft", "scenarios", "public", "default.mts");

  const check = await runCli(["check", fixtureUrl, "--max-pages", "2"]);
  assertCommand(check, "Running registry-only public Quick Check");
  assert.match(check.stdout, /All 8 checks passed\./u);
  assert.equal(
    check.stdout.includes(`npx statecraft check ${fixtureUrl} --write-config`),
    true,
    "Quick Check did not print the exact promotion command.",
  );
  await assert.rejects(lstat(configPath), { code: "ENOENT" });
  await assert.rejects(lstat(scenarioPath), { code: "ENOENT" });
  const checkCoordinates = await assertPublicReport(consumerRoot);

  const promote = await runCli([
    "check",
    fixtureUrl,
    "--write-config",
  ]);
  assertCommand(promote, "Promoting the registry-only public surface");
  assert.match(promote.stdout, /Saved the discovered public surface\./u);
  assert.match(promote.stdout, /Next: add real product states, then run `npx statecraft scan`\./u);
  const config = await readFile(configPath, "utf8");
  const scenario = await readFile(scenarioPath, "utf8");
  assert.match(config, /from "uiwitness"/u);
  assert.match(scenario, /from "uiwitness\/public-site-scenario"/u);
  assert.deepEqual(await assertPublicReport(consumerRoot), checkCoordinates);

  const scan = await runCli(["scan"]);
  assertCommand(scan, "Scanning the untouched promoted project");
  assert.match(scan.stdout, /All 8 executions passed\./u);
  assert.equal(await readFile(configPath, "utf8"), config);
  assert.equal(await readFile(scenarioPath, "utf8"), scenario);
  assert.deepEqual(await assertPublicReport(consumerRoot), checkCoordinates);
  return { executions: checkCoordinates.length };
}

function fixtureDocument({ heading, linkHref, linkLabel }) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${heading} · Statecraft registry fixture</title>
    <style>
      * { box-sizing: border-box; }
      html { color-scheme: light dark; font-family: system-ui, sans-serif; }
      body { margin: 0; min-height: 100vh; padding: 2rem; overflow-wrap: anywhere; }
      main { max-width: 48rem; margin: 0 auto; }
      a { display: inline-block; min-height: 44px; padding-block: 0.75rem; }
    </style>
  </head>
  <body>
    <main>
      <p>Authorized deterministic release fixture</p>
      <h1>${heading}</h1>
      <p>This page proves Statecraft can capture a public success surface from an empty npm project.</p>
      <a href="${linkHref}">${linkLabel}</a>
    </main>
  </body>
</html>`;
}

export async function startRegistryFixture() {
  const server = createServer((request, response) => {
    const pathname = new URL(request.url ?? "/", "http://fixture.test").pathname;
    if (pathname === "/favicon.ico") {
      response.writeHead(204);
      response.end();
      return;
    }
    if (pathname === "/") {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(fixtureDocument({ heading: "Release home", linkHref: "/about", linkLabel: "About the fixture" }));
      return;
    }
    if (pathname === "/about") {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(fixtureDocument({ heading: "Release about", linkHref: "/", linkLabel: "Back home" }));
      return;
    }
    response.writeHead(404, { "content-type": "text/html; charset=utf-8" });
    response.end(fixtureDocument({ heading: "Not found", linkHref: "/", linkLabel: "Back home" }));
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.notEqual(address, null);
  assert.equal(typeof address, "object");
  return {
    close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
    url: `http://127.0.0.1:${address.port}/`,
  };
}

export async function cleanRegistryConsumer({
  consumerRoot,
  fixture,
  remove = rm,
} = {}) {
  try {
    if (fixture !== undefined) await fixture.close();
  } finally {
    await remove(consumerRoot, { force: true, recursive: true });
  }
}

export async function runPublicUrlRegistrySmoke({ version, withDeps = false } = {}) {
  const normalizedVersion = normalizeRegistrySmokeVersion(version);
  const consumerRoot = await mkdtemp(path.join(os.tmpdir(), "statecraft-registry-public-url-"));
  let fixture;
  try {
    await installRegistryConsumer({ consumerRoot, version: normalizedVersion, withDeps });
    const cliBinPath = await assertRegistryInstall(consumerRoot, normalizedVersion);
    fixture = await startRegistryFixture();
    const journey = await runRegistryJourney({
      cliBinPath,
      consumerRoot,
      fixtureUrl: fixture.url,
    });
    return { ...journey, version: normalizedVersion };
  } finally {
    await cleanRegistryConsumer({ consumerRoot, fixture });
  }
}

async function main() {
  const { version, withDeps } = parseRegistrySmokeArguments(process.argv.slice(2));
  const result = await runPublicUrlRegistrySmoke({ version, withDeps });
  console.log(
    `Registry public URL smoke passed: uiwitness@${result.version} completed check -> --write-config -> scan with ${result.executions}/${result.executions} cells from npm registry artifacts.`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

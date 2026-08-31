import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { createServer } from "node:http";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { RELEASE_PACKAGES, validateReleaseWorkspace } from "./check-release-packages.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const commandTimeout = 180_000;

function capture(stream) {
  let value = "";
  stream?.setEncoding("utf8");
  stream?.on("data", (chunk) => {
    value = `${value}${chunk}`.slice(-100_000);
  });
  return () => value;
}

export async function runCommand(command, args, { cwd, env = process.env, timeout = commandTimeout } = {}) {
  const child = spawn(command, args, {
    cwd,
    env,
    shell: process.platform === "win32" && command === "corepack",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const stdout = capture(child.stdout);
  const stderr = capture(child.stderr);
  let killTimer;
  let timedOut = false;
  const result = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      killTimer = setTimeout(() => child.kill("SIGKILL"), 5_000);
    }, timeout);
    const cleanUp = () => {
      clearTimeout(timer);
      clearTimeout(killTimer);
    };
    child.once("error", (error) => {
      cleanUp();
      reject(error);
    });
    child.once("close", (code, signal) => {
      cleanUp();
      if (timedOut) {
        reject(new Error(`${command} exceeded ${timeout}ms.`));
        return;
      }
      resolve({ code, signal });
    });
  });
  return { ...result, stderr: stderr(), stdout: stdout() };
}

function assertCommand(result, label) {
  assert.equal(
    result.code,
    0,
    `${label} failed${result.signal ? ` (${result.signal})` : ""}:\n${result.stderr || result.stdout}`,
  );
}

export function releaseTarballName(packageName, packageVersion) {
  return `${packageName.replace(/^@/u, "").replaceAll("/", "-")}-${packageVersion}.tgz`;
}

export function assertPublishSummaryIdentity(summary, packageName, packageVersion) {
  assert.equal(
    summary !== null && typeof summary === "object" && !Array.isArray(summary),
    true,
    `npm returned an invalid publish summary for ${packageName}.`,
  );
  const summaryKeys = Object.keys(summary);
  const packageSummary = summaryKeys.length === 1 && Object.hasOwn(summary, packageName)
    ? summary[packageName]
    : summary;
  assert.equal(
    packageSummary !== null && typeof packageSummary === "object" && !Array.isArray(packageSummary),
    true,
    `npm returned an invalid package summary for ${packageName}.`,
  );
  assert.equal(
    packageSummary.name,
    packageName,
    `npm dry-run reported the wrong package name for ${packageName}.`,
  );
  assert.equal(
    packageSummary.version,
    packageVersion,
    `npm dry-run reported the wrong package version for ${packageName}.`,
  );
  if (packageSummary.id !== undefined) {
    assert.equal(
      packageSummary.id,
      `${packageName}@${packageVersion}`,
      `npm dry-run reported an inconsistent package id for ${packageName}.`,
    );
  }
}

async function createOutputDirectory(requestedPath) {
  const resolved = path.resolve(requestedPath);
  const parent = await realpath(path.dirname(resolved));
  const output = path.join(parent, path.basename(resolved));
  await mkdir(output, { recursive: false, mode: 0o700 });
  return output;
}

async function assertInstalledPackage(packageRoot, contract, packageVersion) {
  const manifest = JSON.parse(await readFile(path.join(packageRoot, "package.json"), "utf8"));
  assert.equal(manifest.name, contract.name);
  assert.equal(manifest.version, packageVersion);
  assert.equal(manifest.private, undefined);
  assert.equal(manifest.repository.url, "git+https://github.com/RujitRaval/uiwitness.git");
  assert.equal(manifest.publishConfig.access, "public");
  for (const dependency of Object.keys(contract.dependencies)) {
    assert.equal(manifest.dependencies[dependency], packageVersion);
  }

  const entries = await readdir(packageRoot);
  const allowed = new Set(["LICENSE", "README.md", "dist", "package.json"]);
  assert.deepEqual(
    entries.filter((entry) => !allowed.has(entry)),
    [],
    `${contract.name} packed unexpected top-level files.`,
  );
  assert.equal((await lstat(path.join(packageRoot, "dist"))).isDirectory(), true);
  assert.equal(
    await readFile(path.join(packageRoot, "LICENSE"), "utf8"),
    await readFile(path.join(repositoryRoot, "LICENSE"), "utf8"),
  );
  assert.equal(
    (await readdir(path.join(packageRoot, "dist"), { recursive: true })).some(
      (entry) => entry.endsWith(".tsbuildinfo"),
    ),
    false,
    `${contract.name} packed a TypeScript compiler cache.`,
  );
}

export async function runReleasePackageSmoke({
  output,
  root = repositoryRoot,
} = {}) {
  const { packageVersion } = await validateReleaseWorkspace({ root });
  const localRoot = output === undefined
    ? await mkdtemp(path.join(os.tmpdir(), "statecraft-package-smoke-"))
    : undefined;
  const packageOutput = output === undefined
    ? path.join(localRoot, "packages")
    : await createOutputDirectory(output);
  if (output === undefined) await mkdir(packageOutput, { mode: 0o700 });
  const consumerRoot = await mkdtemp(path.join(os.tmpdir(), "statecraft-package-consumer-"));
  let fixtureServer;

  try {
    const tarballs = [];
    for (const contract of RELEASE_PACKAGES) {
      const buildEntry = path.join(root, contract.directory, "dist", "index.js");
      assert.equal((await lstat(buildEntry)).isFile(), true, `${contract.name} must be built before packing.`);
      const pack = await runCommand(
        "corepack",
        ["pnpm", "--filter", contract.name, "pack", "--pack-destination", packageOutput],
        { cwd: root },
      );
      assertCommand(pack, `Packing ${contract.name}`);
      const tarball = path.join(packageOutput, releaseTarballName(contract.name, packageVersion));
      assert.equal((await lstat(tarball)).isFile(), true, `${contract.name} tarball was not created.`);
      const dryRun = await runCommand("npm", ["publish", tarball, "--dry-run", "--json"], { cwd: root });
      assertCommand(dryRun, `Dry-run publishing ${contract.name}`);
      const publishSummary = JSON.parse(dryRun.stdout);
      assertPublishSummaryIdentity(publishSummary, contract.name, packageVersion);
      tarballs.push(tarball);
    }

    const npmInit = await runCommand("npm", ["init", "--yes"], { cwd: consumerRoot });
    assertCommand(npmInit, "Initializing a default npm consumer");
    const consumerManifest = JSON.parse(
      await readFile(path.join(consumerRoot, "package.json"), "utf8"),
    );
    assert.notEqual(
      consumerManifest.type,
      "module",
      "npm init must leave the consumer outside package-wide ESM mode.",
    );
    const install = await runCommand(
      "npm",
      [
        "install",
        "--ignore-scripts",
        "--no-audit",
        "--no-fund",
        "--package-lock=false",
        ...tarballs,
      ],
      { cwd: consumerRoot },
    );
    assertCommand(install, "Installing packed packages");

    const chromiumInstall = await runCommand(
      "npm",
      ["exec", "--offline", "--", "playwright", "install", "chromium"],
      { cwd: consumerRoot },
    );
    assertCommand(chromiumInstall, "Installing Chromium from the packed consumer");

    for (const contract of RELEASE_PACKAGES) {
      await assertInstalledPackage(
        path.join(consumerRoot, "node_modules", contract.name),
        contract,
        packageVersion,
      );
    }

    const importProbe = path.join(consumerRoot, "import-probe.mjs");
    await writeFile(
      importProbe,
      [
        'import { defineConfig, parseReport } from "uiwitness-core";',
        'import { renderReportHtml } from "uiwitness-report";',
        'import { runExecutionCells } from "uiwitness-runner-playwright";',
        'import { runCli } from "uiwitness";',
        "if (![defineConfig, parseReport, renderReportHtml, runExecutionCells, runCli].every((value) => typeof value === \"function\")) process.exit(1);",
        "",
      ].join("\n"),
      "utf8",
    );
    const imports = await runCommand(process.execPath, [importProbe], { cwd: consumerRoot });
    assertCommand(imports, "Importing packed package APIs");

    const cliManifest = JSON.parse(
      await readFile(path.join(consumerRoot, "node_modules", "uiwitness", "package.json"), "utf8"),
    );
    assert.equal(cliManifest.bin.uiwitness, "./dist/bin.js");
    const cliBinPath = path.join(
      consumerRoot,
      "node_modules",
      "uiwitness",
      cliManifest.bin.uiwitness,
    );
    const help = await runCommand("npm", ["exec", "--offline", "--", "uiwitness", "--help"], {
      cwd: consumerRoot,
    });
    assertCommand(help, "Running the packed CLI");
    assert.match(help.stdout, /statecraft scan/u);

    const init = await runCommand("npm", ["exec", "--offline", "--", "uiwitness", "init"], {
      cwd: consumerRoot,
    });
    assertCommand(init, "Initializing with the packed CLI");
    const generatedConfigPath = path.join(consumerRoot, "statecraft.config.mts");
    assert.match(await readFile(generatedConfigPath, "utf8"), /from "uiwitness"/u);
    assert.match(
      await readFile(path.join(consumerRoot, "statecraft", "scenarios", "home", "success.mts"), "utf8"),
      /export default scenario/u,
    );

    fixtureServer = createServer((_request, response) => {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end("<!doctype html><html><head><title>Ready</title></head><body><h1>Ready</h1></body></html>");
    });
    fixtureServer.listen(0, "127.0.0.1");
    await once(fixtureServer, "listening");
    const fixtureAddress = fixtureServer.address();
    assert.notEqual(fixtureAddress, null);
    assert.equal(typeof fixtureAddress, "object");
    const generatedConfig = await readFile(generatedConfigPath, "utf8");
    assert.match(generatedConfig, /http:\/\/localhost:3000/u);
    await writeFile(
      generatedConfigPath,
      generatedConfig.replace(
        "http://localhost:3000",
        `http://127.0.0.1:${fixtureAddress.port}`,
      ),
      "utf8",
    );

    const scan = await runCommand(
      process.execPath,
      [cliBinPath, "scan"],
      { cwd: consumerRoot },
    );
    assertCommand(scan, "Scanning the default CommonJS npm consumer");
    assert.match(scan.stdout, /All 4 executions passed\./u);
    const report = JSON.parse(
      await readFile(path.join(consumerRoot, ".uiwitness", "report", "uiwitness.json"), "utf8"),
    );
    assert.equal(report.schemaVersion, 1);
    assert.deepEqual(
      {
        executions: report.summary.executions,
        failed: report.summary.failed,
        passed: report.summary.passed,
      },
      { executions: 4, failed: 0, passed: 4 },
    );
    assert.equal(report.executions.length, 4);
    const artifactRoot = path.join(consumerRoot, ".uiwitness", "artifacts");
    const artifactPrefix = `${artifactRoot}${path.sep}`;
    const artifactRealRoot = await realpath(artifactRoot);
    const artifactRealPrefix = `${artifactRealRoot}${path.sep}`;
    for (const execution of report.executions) {
      assert.equal(typeof execution.screenshotPath, "string");
      const screenshot = path.resolve(consumerRoot, execution.screenshotPath);
      assert.equal(
        screenshot.startsWith(artifactPrefix),
        true,
        `Screenshot escaped the consumer artifact root: ${execution.screenshotPath}`,
      );
      assert.equal(
        (await realpath(screenshot)).startsWith(artifactRealPrefix),
        true,
        `Screenshot resolved outside the consumer artifact root: ${execution.screenshotPath}`,
      );
      const screenshotMetadata = await lstat(screenshot);
      assert.equal(screenshotMetadata.isSymbolicLink(), false);
      assert.equal(screenshotMetadata.isFile(), true);
      assert.equal(screenshotMetadata.size > 0, true);
    }
    assert.match(
      await readFile(path.join(consumerRoot, ".uiwitness", "report", "index.html"), "utf8"),
      /UI State Coverage Report/u,
    );

    return { packageOutput, packageVersion, tarballs };
  } finally {
    if (fixtureServer?.listening) {
      await new Promise((resolve, reject) => {
        fixtureServer.close((error) => (error ? reject(error) : resolve()));
      });
    }
    await rm(consumerRoot, { force: true, recursive: true });
    if (localRoot !== undefined) await rm(localRoot, { force: true, recursive: true });
  }
}

function argumentValue(arguments_, name) {
  const index = arguments_.indexOf(name);
  return index === -1 ? undefined : arguments_[index + 1];
}

async function main() {
  const result = await runReleasePackageSmoke({
    output: argumentValue(process.argv, "--output"),
  });
  console.log(
    `Release package smoke passed: ${result.tarballs.length} tarballs at ${result.packageVersion} install, import, and run from npm artifacts.`,
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

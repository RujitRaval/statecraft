import assert from "node:assert/strict";
import { spawn } from "node:child_process";
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
  assert.equal(manifest.repository.url, "git+https://github.com/RujitRaval/statecraft.git");
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
      assert.equal(publishSummary.id, `${contract.name}@${packageVersion}`);
      tarballs.push(tarball);
    }

    await writeFile(
      path.join(consumerRoot, "package.json"),
      `${JSON.stringify({ name: "statecraft-package-consumer", private: true, type: "module" }, null, 2)}\n`,
      "utf8",
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
        'import { defineConfig, parseReport } from "statecraft-ui-core";',
        'import { renderReportHtml } from "statecraft-ui-report";',
        'import { runExecutionCells } from "statecraft-ui-runner-playwright";',
        'import { runCli } from "statecraft-ui";',
        "if (![defineConfig, parseReport, renderReportHtml, runExecutionCells, runCli].every((value) => typeof value === \"function\")) process.exit(1);",
        "",
      ].join("\n"),
      "utf8",
    );
    const imports = await runCommand(process.execPath, [importProbe], { cwd: consumerRoot });
    assertCommand(imports, "Importing packed package APIs");

    const cliManifest = JSON.parse(
      await readFile(path.join(consumerRoot, "node_modules", "statecraft-ui", "package.json"), "utf8"),
    );
    assert.equal(cliManifest.bin.statecraft, "./dist/bin.js");
    const help = await runCommand("npm", ["exec", "--offline", "--", "statecraft", "--help"], {
      cwd: consumerRoot,
    });
    assertCommand(help, "Running the packed CLI");
    assert.match(help.stdout, /statecraft scan/u);

    const init = await runCommand("npm", ["exec", "--offline", "--", "statecraft", "init"], {
      cwd: consumerRoot,
    });
    assertCommand(init, "Initializing with the packed CLI");
    assert.match(await readFile(path.join(consumerRoot, "statecraft.config.ts"), "utf8"), /from "statecraft-ui"/u);
    assert.match(
      await readFile(path.join(consumerRoot, "statecraft", "scenarios", "home", "success.ts"), "utf8"),
      /export default scenario/u,
    );

    return { packageOutput, packageVersion, tarballs };
  } finally {
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

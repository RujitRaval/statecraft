import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { lstat, readFile, readdir, realpath } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { RELEASE_PACKAGES, validateReleaseWorkspace } from "./check-release-packages.mjs";
import { releaseTarballName, runCommand } from "./release-package-smoke.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
function compareVersions(left, right) {
  const parse = (version) => {
    const match = /^(\d+)\.(\d+)\.(\d+)$/u.exec(version);
    assert.notEqual(match, null, `npm returned an invalid version: ${version}.`);
    return match.slice(1).map(Number);
  };
  const leftParts = parse(left);
  const rightParts = parse(right);
  for (let index = 0; index < leftParts.length; index += 1) {
    if (leftParts[index] !== rightParts[index]) return leftParts[index] - rightParts[index];
  }
  return 0;
}

export function packageIntegrity(contents) {
  return `sha512-${createHash("sha512").update(contents).digest("base64")}`;
}

export function createPublicationPlan(packages) {
  return packages.map((entry) => {
    if (entry.latestVersion !== undefined) {
      assert.equal(
        compareVersions(entry.version, entry.latestVersion) >= 0,
        true,
        `${entry.name}@${entry.version} is older than npm latest ${entry.latestVersion}.`,
      );
      if (entry.latestVersion === entry.version) {
        assert.notEqual(
          entry.registryIntegrity,
          undefined,
          `${entry.name} latest points to ${entry.version}, but that version has no integrity.`,
        );
      }
    }
    if (entry.registryIntegrity === undefined) return { ...entry, action: "publish" };
    assert.equal(
      entry.registryIntegrity,
      entry.integrity,
      `${entry.name}@${entry.version} already exists with different contents.`,
    );
    assert.equal(
      entry.latestVersion,
      entry.version,
      `${entry.name}@${entry.version} exists with matching bytes but is not npm latest; trusted publishing cannot repair dist-tags.`,
    );
    return { ...entry, action: "skip" };
  });
}

async function registryLatestVersion(name, execute) {
  const result = await execute(
    "npm",
    ["view", name, "dist-tags.latest", "--json"],
    { cwd: repositoryRoot, timeout: 60_000 },
  );
  if (result.code === 0) {
    const parsed = JSON.parse(result.stdout);
    assert.equal(typeof parsed, "string", `npm returned invalid latest version for ${name}.`);
    compareVersions(parsed, parsed);
    return parsed;
  }
  if (/E404|404 Not Found|is not in this registry/u.test(`${result.stderr}\n${result.stdout}`)) {
    return undefined;
  }
  throw new Error(`Could not inspect the latest version for ${name}:\n${result.stderr || result.stdout}`);
}

async function registryIntegrity(name, version, execute) {
  const result = await execute(
    "npm",
    ["view", `${name}@${version}`, "dist.integrity", "--json"],
    { cwd: repositoryRoot, timeout: 60_000 },
  );
  if (result.code === 0) {
    const parsed = JSON.parse(result.stdout);
    assert.equal(typeof parsed, "string", `npm returned invalid integrity for ${name}@${version}.`);
    return parsed;
  }
  if (/E404|404 Not Found|is not in this registry/u.test(`${result.stderr}\n${result.stdout}`)) {
    return undefined;
  }
  throw new Error(`Could not inspect ${name}@${version}:\n${result.stderr || result.stdout}`);
}

export async function publishReleasePackages({
  execute = runCommand,
  input,
  root = repositoryRoot,
  tag,
} = {}) {
  assert.equal(typeof input, "string", "--input is required.");
  const requested = path.resolve(input);
  const requestedMetadata = await lstat(requested);
  assert.equal(requestedMetadata.isSymbolicLink(), false, "Release package input must not be a symbolic link.");
  assert.equal(requestedMetadata.isDirectory(), true, "Release package input must be a directory.");
  const packageRoot = await realpath(requested);
  const { packageVersion } = await validateReleaseWorkspace({ root, tag });
  const expectedNames = RELEASE_PACKAGES.map(({ name }) => releaseTarballName(name, packageVersion)).sort();
  assert.deepEqual((await readdir(packageRoot)).sort(), expectedNames, "Release package directory is incomplete.");

  const candidates = [];
  for (const contract of RELEASE_PACKAGES) {
    const tarball = path.join(packageRoot, releaseTarballName(contract.name, packageVersion));
    const metadata = await lstat(tarball);
    assert.equal(metadata.isSymbolicLink(), false, `${contract.name} tarball must not be a symbolic link.`);
    assert.equal(metadata.isFile(), true, `${contract.name} tarball must be a regular file.`);
    const integrity = packageIntegrity(await readFile(tarball));
    candidates.push({
      integrity,
      latestVersion: await registryLatestVersion(contract.name, execute),
      name: contract.name,
      registryIntegrity: await registryIntegrity(contract.name, packageVersion, execute),
      tarball,
      version: packageVersion,
    });
  }

  const plan = createPublicationPlan(candidates);
  for (const entry of plan) {
    if (entry.action === "skip") continue;
    const result = await execute(
      "npm",
      ["publish", entry.tarball, "--access", "public", "--provenance"],
      { cwd: root, timeout: 180_000 },
    );
    assert.equal(result.code, 0, `Publishing ${entry.name} failed:\n${result.stderr || result.stdout}`);
  }

  return plan;
}

function argumentValue(arguments_, name) {
  const index = arguments_.indexOf(name);
  return index === -1 ? undefined : arguments_[index + 1];
}

async function main() {
  const plan = await publishReleasePackages({
    input: argumentValue(process.argv, "--input"),
    tag: argumentValue(process.argv, "--tag"),
  });
  const published = plan.filter(({ action }) => action === "publish").length;
  const skipped = plan.length - published;
  console.log(`npm release complete: ${published} published, ${skipped} identical packages already present.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

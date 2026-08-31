import { appendFile, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const repositoryRoot = path.resolve(import.meta.dirname, "..");

export const RELEASE_PACKAGES = [
  {
    dependencies: {},
    directory: "packages/core",
    name: "uiwitness-core",
  },
  {
    dependencies: { "uiwitness-core": "workspace:*" },
    directory: "packages/report",
    name: "uiwitness-report",
  },
  {
    dependencies: {
      "uiwitness-core": "workspace:*",
      "uiwitness-report": "workspace:*",
    },
    directory: "packages/runner-playwright",
    name: "uiwitness-runner-playwright",
  },
  {
    dependencies: {
      "uiwitness-core": "workspace:*",
      "uiwitness-runner-playwright": "workspace:*",
    },
    directory: "packages/cli",
    name: "uiwitness",
  },
];

const expectedRepository = "git+https://github.com/RujitRaval/uiwitness.git";
const expectedHomepage = "https://github.com/RujitRaval/uiwitness#readme";
const expectedBugs = "https://github.com/RujitRaval/uiwitness/issues";
const expectedEngine = "^22.20.0 || ^24.0.0";
const expectedFiles = [
  "dist/**/*.js",
  "dist/**/*.js.map",
  "dist/**/*.d.ts",
  "dist/**/*.d.ts.map",
];

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

export function npmVersionFromRelease(releaseVersion) {
  const match = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/u.exec(releaseVersion);
  invariant(match !== null, `VERSION must use MAJOR.MINOR.PATCH.MICRO: ${releaseVersion}`);
  invariant(
    match[4] === "0",
    `npm releases require a zero MICRO component; ${releaseVersion} would collide after npm's three-part translation.`,
  );
  return `${match[1]}.${match[2]}.${match[3]}`;
}

export function validateManifest(manifest, contract, packageVersion) {
  const label = contract.directory;
  invariant(manifest.name === contract.name, `${label}: unexpected package name.`);
  invariant(manifest.version === packageVersion, `${label}: version must be ${packageVersion}.`);
  invariant(manifest.private === undefined, `${label}: publishable packages must not set private.`);
  invariant(manifest.description?.length > 20, `${label}: description is missing.`);
  invariant(manifest.license === "MIT", `${label}: license must be MIT.`);
  invariant(manifest.type === "module", `${label}: package must remain ESM.`);
  invariant(manifest.sideEffects === false, `${label}: sideEffects must remain false.`);
  invariant(manifest.main === "./dist/index.js", `${label}: main entry is invalid.`);
  invariant(manifest.types === "./dist/index.d.ts", `${label}: types entry is invalid.`);
  invariant(
    Array.isArray(manifest.files) &&
      manifest.files.length === expectedFiles.length &&
      manifest.files.every((entry, index) => entry === expectedFiles[index]),
    `${label}: publication file allowlist is invalid.`,
  );
  invariant(manifest.exports?.["."]?.import === "./dist/index.js", `${label}: import export is invalid.`);
  invariant(manifest.exports?.["."]?.types === "./dist/index.d.ts", `${label}: type export is invalid.`);
  invariant(manifest.engines?.node === expectedEngine, `${label}: Node engine contract drifted.`);
  invariant(manifest.repository?.type === "git", `${label}: repository type is invalid.`);
  invariant(manifest.repository?.url === expectedRepository, `${label}: repository URL is invalid.`);
  invariant(manifest.repository?.directory === contract.directory, `${label}: repository directory is invalid.`);
  invariant(manifest.homepage === expectedHomepage, `${label}: homepage is invalid.`);
  invariant(manifest.bugs?.url === expectedBugs, `${label}: bugs URL is invalid.`);
  invariant(Array.isArray(manifest.keywords) && manifest.keywords.length >= 3, `${label}: keywords are incomplete.`);
  invariant(manifest.publishConfig?.access === "public", `${label}: npm access must be public.`);
  invariant(
    manifest.publishConfig?.registry === "https://registry.npmjs.org/",
    `${label}: publication must be pinned to npmjs.`,
  );
  invariant(manifest.publishConfig?.provenance === true, `${label}: provenance must be enabled.`);

  for (const [name, specifier] of Object.entries(contract.dependencies)) {
    invariant(manifest.dependencies?.[name] === specifier, `${label}: ${name} must use ${specifier}.`);
  }

  if (contract.name === "uiwitness") {
    invariant(manifest.bin?.uiwitness === "./dist/bin.js", `${label}: uiwitness bin target is invalid.`);
  }
}

export async function validateReleaseWorkspace({ root = repositoryRoot, tag } = {}) {
  const releaseVersion = (await readFile(path.join(root, "VERSION"), "utf8")).trim();
  const packageVersion = npmVersionFromRelease(releaseVersion);
  const rootManifest = await readJson(path.join(root, "package.json"));
  invariant(rootManifest.private === true, "The workspace root must remain private.");
  invariant(rootManifest.version === packageVersion, `Root package version must be ${packageVersion}.`);
  if (tag !== undefined) {
    invariant(tag === `v${packageVersion}`, `Release tag must be v${packageVersion}; received ${tag}.`);
  }

  for (const contract of RELEASE_PACKAGES) {
    const packageRoot = path.join(root, contract.directory);
    const manifest = await readJson(path.join(packageRoot, "package.json"));
    validateManifest(manifest, contract, packageVersion);
    const readme = await readFile(path.join(packageRoot, "README.md"), "utf8");
    invariant(readme.startsWith(`# ${contract.name}\n`), `${contract.directory}: README title is invalid.`);
    invariant(
      (await readFile(path.join(packageRoot, "LICENSE"), "utf8")) ===
        (await readFile(path.join(root, "LICENSE"), "utf8")),
      `${contract.directory}: LICENSE must match the repository license.`,
    );
  }

  await readFile(path.join(root, "LICENSE"), "utf8");
  return { packageVersion, releaseVersion };
}

export async function syncReleaseVersions({ root = repositoryRoot } = {}) {
  const releaseVersion = (await readFile(path.join(root, "VERSION"), "utf8")).trim();
  const packageVersion = npmVersionFromRelease(releaseVersion);
  for (const relativePath of ["package.json", ...RELEASE_PACKAGES.map(({ directory }) => `${directory}/package.json`)]) {
    const filePath = path.join(root, relativePath);
    const manifest = await readJson(filePath);
    manifest.version = packageVersion;
    await writeFile(filePath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  }
  return { packageVersion, releaseVersion };
}

function argumentValue(arguments_, name) {
  const index = arguments_.indexOf(name);
  return index === -1 ? undefined : arguments_[index + 1];
}

async function main() {
  const arguments_ = process.argv.slice(2);
  if (arguments_.includes("--sync")) await syncReleaseVersions();
  const result = await validateReleaseWorkspace({ tag: argumentValue(arguments_, "--tag") });
  const outputFile = argumentValue(arguments_, "--github-output");
  if (outputFile !== undefined) {
    await appendFile(
      outputFile,
      `package-version=${result.packageVersion}\nrelease-version=${result.releaseVersion}\n`,
      "utf8",
    );
  }
  console.log(
    `Release package contracts passed for ${RELEASE_PACKAGES.length} packages at ${result.packageVersion}.`,
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

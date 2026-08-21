import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { appendFile, mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const exampleRoot = path.join(repositoryRoot, "apps", "example-nextjs");
const expectedFailureCoordinates = [
  "orders:error:mobile:dark",
  "orders:error:desktop:dark",
  "customers:long-content:mobile:light",
  "customers:long-content:mobile:dark",
];

function captureStream(stream, limit = 100_000) {
  let output = "";
  stream?.setEncoding("utf8");
  stream?.on("data", (chunk) => {
    if (output.length < limit) output += chunk.slice(0, limit - output.length);
  });
  return () => output;
}

function waitForExit(child) {
  return new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => resolve({ code, signal }));
  });
}

async function availablePort() {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      if (address === null || typeof address === "string") {
        reject(new Error("Could not allocate a release-smoke port."));
        return;
      }
      probe.close((error) =>
        error === undefined ? resolve(address.port) : reject(error),
      );
    });
  });
}

export async function waitForServer(
  url,
  child,
  getStdout,
  getStderr,
  {
    fetchPage = fetch,
    now = Date.now,
    pause = (milliseconds) =>
      new Promise((resolve) => setTimeout(resolve, milliseconds)),
    timeoutMs = 30_000,
  } = {},
) {
  const deadline = now() + timeoutMs;
  while (now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(
        `Example server exited before readiness.\n${getStdout()}${getStderr()}`,
      );
    }
    try {
      const response = await fetchPage(url);
      if (response.ok) return;
    } catch {
      // The production server is still starting.
    }
    await pause(100);
  }
  throw new Error(
    `Example server did not become ready at ${url}.\n${getStdout()}${getStderr()}`,
  );
}

export async function stopProcess(child, exit, graceMs = 5_000) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill("SIGTERM");
  let timeout;
  const stopped = await Promise.race([
    exit.then(() => true),
    new Promise((resolve) => {
      timeout = setTimeout(() => resolve(false), graceMs);
    }),
  ]).finally(() => clearTimeout(timeout));
  if (!stopped && child.exitCode === null && child.signalCode === null) {
    child.kill("SIGKILL");
    await exit;
  }
}

export async function runCommand(
  command,
  args,
  { timeoutMs = 120_000, terminateGraceMs = 5_000, ...options } = {},
) {
  const child = spawn(command, args, {
    ...options,
    shell: false,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const getStdout = captureStream(child.stdout);
  const getStderr = captureStream(child.stderr);
  const exit = waitForExit(child);
  let timeout;
  const result = await Promise.race([
    exit,
    new Promise((resolve) => {
      timeout = setTimeout(() => resolve(null), timeoutMs);
    }),
  ]).finally(() => clearTimeout(timeout));
  if (result === null) {
    await stopProcess(child, exit, terminateGraceMs);
    throw new Error(
      `Command timed out after ${timeoutMs}ms: ${command}\n${getStdout()}${getStderr()}`,
    );
  }
  const { code, signal } = result;
  return { code, signal, stderr: getStderr(), stdout: getStdout() };
}

function executionCoordinate(execution) {
  return [
    execution.routeId,
    execution.stateId,
    execution.viewportId,
    execution.theme,
  ].join(":");
}

export function assertExpectedScanOutcome({ code, signal, stderr, stdout }) {
  assert.equal(signal, null, `Statecraft scan terminated with signal ${signal}.`);
  assert.equal(
    code,
    1,
    `Expected the known-failure scan to exit 1, received ${code}.\n${stderr}`,
  );
  assert.equal(stderr, "", `Statecraft scan wrote to stderr:\n${stderr}`);
  assert.match(stdout, /4 of 60 executions failed\./u);
}

export async function parseBuiltReport(
  value,
  {
    loadModule = (moduleUrl) => import(moduleUrl),
    moduleUrl = pathToFileURL(
      path.join(repositoryRoot, "packages", "core", "dist", "index.js"),
    ).href,
  } = {},
) {
  const module = await loadModule(moduleUrl);
  assert.equal(
    typeof module.parseReport,
    "function",
    "Built @statecraft/core does not export parseReport.",
  );
  return module.parseReport(value);
}

export async function validateExpectedReleaseReport(
  report,
  { projectRoot, statFile = stat },
) {
  assert.equal(report.schemaVersion, 1);
  assert.deepEqual(report.summary, {
    coverage: {
      execution: { covered: 56, percentage: 93.33, total: 60 },
      responsive: { covered: 14, percentage: 93.33, total: 15 },
      state: { covered: 15, percentage: 100, total: 15 },
      theme: { covered: 14, percentage: 93.33, total: 15 },
    },
    durationMs: report.summary.durationMs,
    executions: 60,
    failed: 4,
    passed: 56,
    routes: 3,
    states: 15,
  });
  assert.equal(Number.isSafeInteger(report.summary.durationMs), true);
  assert.equal(report.summary.durationMs >= 0, true);
  assert.equal(report.executions.length, 60);

  const failures = report.executions.filter(
    (execution) => execution.status === "failed",
  );
  assert.deepEqual(
    failures.map(executionCoordinate),
    expectedFailureCoordinates,
  );
  for (const failure of failures) {
    assert.deepEqual(
      failure.failures.map(({ code }) => code),
      ["ASSERTION_FAILED"],
    );
  }

  const canonicalRoot = path.resolve(projectRoot);
  const rootPrefix = `${canonicalRoot}${path.sep}`;
  for (const execution of report.executions) {
    assert.equal(typeof execution.screenshotPath, "string");
    const screenshotPath = path.resolve(canonicalRoot, execution.screenshotPath);
    assert.equal(
      screenshotPath.startsWith(rootPrefix),
      true,
      `Screenshot escaped the smoke project: ${execution.screenshotPath}`,
    );
    const screenshot = await statFile(screenshotPath);
    assert.equal(
      screenshot.isFile(),
      true,
      `Screenshot is not a regular file: ${execution.screenshotPath}`,
    );
    assert.equal(
      screenshot.size > 0,
      true,
      `Screenshot is empty: ${execution.screenshotPath}`,
    );
  }
}

async function resolveCliBin() {
  const packageRoot = path.join(repositoryRoot, "packages", "cli");
  const manifest = JSON.parse(
    await readFile(path.join(packageRoot, "package.json"), "utf8"),
  );
  assert.equal(
    typeof manifest.bin?.statecraft,
    "string",
    "@statecraft/cli does not declare the statecraft bin target.",
  );
  return path.resolve(packageRoot, manifest.bin.statecraft);
}

async function recordArtifactPath(projectRoot, outputFile) {
  if (outputFile === undefined) return;
  await appendFile(
    outputFile,
    `artifact-path=${path.join(projectRoot, ".statecraft")}\n`,
    "utf8",
  );
}

export async function runReleaseSmoke({
  allocatePort = availablePort,
  createProject = () => mkdtemp(path.join(tmpdir(), "statecraft-release-smoke-")),
  execute = runCommand,
  keepOutput = process.env["GITHUB_OUTPUT"] !== undefined,
  loadReport = parseBuiltReport,
  log = console.log,
  outputFile = keepOutput ? process.env["GITHUB_OUTPUT"] : undefined,
  readText = readFile,
  recordOutput = recordArtifactPath,
  removeProject = (projectRoot) =>
    rm(projectRoot, { force: true, recursive: true }),
  spawnProcess = spawn,
  validateReport = validateExpectedReleaseReport,
  waitUntilReady = waitForServer,
} = {}) {
  const smokeProjectRoot = await createProject();
  let server;
  let serverExit;

  try {
    await recordOutput(smokeProjectRoot, outputFile);
    const port = await allocatePort();
    const baseURL = `http://127.0.0.1:${port}`;
    const environment = {
      ...process.env,
      STATECRAFT_EXAMPLE_BASE_URL: baseURL,
    };
    server = spawnProcess(
      process.execPath,
      [
        path.join(exampleRoot, "scripts", "next.mjs"),
        "start",
        "--hostname",
        "127.0.0.1",
        "--port",
        String(port),
      ],
      {
        cwd: exampleRoot,
        env: environment,
        shell: false,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    const getServerStdout = captureStream(server.stdout);
    const getServerStderr = captureStream(server.stderr);
    serverExit = waitForExit(server);
    await waitUntilReady(
      `${baseURL}/api/dashboard`,
      server,
      getServerStdout,
      getServerStderr,
    );
    const scan = await execute(
      process.execPath,
      [
        await resolveCliBin(),
        "scan",
        "--config",
        path.join(exampleRoot, "statecraft.config.ts"),
      ],
      { cwd: smokeProjectRoot, env: environment },
    );
    assertExpectedScanOutcome(scan);

    const reportDirectory = path.join(
      smokeProjectRoot,
      ".statecraft",
      "report",
    );
    const report = await loadReport(
      JSON.parse(
        await readText(path.join(reportDirectory, "statecraft.json"), "utf8"),
      ),
    );
    await validateReport(report, { projectRoot: smokeProjectRoot });

    const html = await readText(path.join(reportDirectory, "index.html"), "utf8");
    assert.match(html, /Execution coverage/u);
    assert.match(html, /93\.33%/u);
    assert.match(html, /<span>Failed<\/span><strong>4<\/strong>/u);
    log(
      "Release smoke passed: built CLI produced 56 passes, four known failures, 60 screenshots, schema-v1 JSON, and offline HTML.",
    );
  } finally {
    try {
      if (server !== undefined && serverExit !== undefined) {
        await stopProcess(server, serverExit);
      }
    } finally {
      if (!keepOutput) await removeProject(smokeProjectRoot);
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await runReleaseSmoke();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

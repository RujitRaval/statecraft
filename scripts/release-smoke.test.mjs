import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import test from "node:test";

import {
  assertExpectedScanOutcome,
  parseBuiltReport,
  runCommand,
  runReleaseSmoke,
  stopProcess,
  validateExpectedReleaseReport,
  waitForServer,
} from "./release-smoke.mjs";

const failureCoordinates = [
  ["orders", "error", "mobile", "dark"],
  ["orders", "error", "desktop", "dark"],
  ["customers", "long-content", "mobile", "light"],
  ["customers", "long-content", "mobile", "dark"],
];

function makeReport() {
  const executions = [];
  for (let index = 0; index < 56; index += 1) {
    executions.push({
      failures: [],
      routeId: "dashboard",
      screenshotPath: `.statecraft/artifacts/dashboard/success/${index}.png`,
      stateId: "success",
      status: "passed",
      theme: index % 2 === 0 ? "light" : "dark",
      viewportId: index % 2 === 0 ? "mobile" : "desktop",
    });
  }
  for (const [routeId, stateId, viewportId, theme] of failureCoordinates) {
    executions.push({
      failures: [{ code: "ASSERTION_FAILED" }],
      routeId,
      screenshotPath: `.statecraft/artifacts/${routeId}/${stateId}/${viewportId}-${theme}.png`,
      stateId,
      status: "failed",
      theme,
      viewportId,
    });
  }
  return {
    executions,
    schemaVersion: 1,
    summary: {
      coverage: {
        execution: { covered: 56, percentage: 93.33, total: 60 },
        responsive: { covered: 14, percentage: 93.33, total: 15 },
        state: { covered: 15, percentage: 100, total: 15 },
        theme: { covered: 14, percentage: 93.33, total: 15 },
      },
      durationMs: 1_234,
      executions: 60,
      failed: 4,
      passed: 56,
      routes: 3,
      states: 15,
    },
  };
}

test("accepts only the known-failure CLI exit contract", () => {
  assert.doesNotThrow(() =>
    assertExpectedScanOutcome({
      code: 1,
      signal: null,
      stderr: "",
      stdout: "4 of 60 executions failed.\n",
    }),
  );
  assert.throws(
    () =>
      assertExpectedScanOutcome({
        code: 0,
        signal: null,
        stderr: "",
        stdout: "All 60 executions passed.\n",
      }),
    /Expected the known-failure scan to exit 1/u,
  );
  assert.throws(
    () =>
      assertExpectedScanOutcome({
        code: 2,
        signal: null,
        stderr: "Invalid config.\n",
        stdout: "",
      }),
    /received 2/u,
  );
});

test("validates the complete release report and every screenshot", async () => {
  const visited = [];
  await validateExpectedReleaseReport(makeReport(), {
    projectRoot: "/tmp/statecraft-release-smoke",
    statFile: async (screenshotPath) => {
      visited.push(screenshotPath);
      return { isFile: () => true, size: 128 };
    },
  });
  assert.equal(visited.length, 60);
});

test("rejects drift in known failures and screenshot containment", async () => {
  const drifted = makeReport();
  drifted.executions[56].theme = "light";
  await assert.rejects(
    validateExpectedReleaseReport(drifted, {
      projectRoot: "/tmp/statecraft-release-smoke",
      statFile: async () => ({ isFile: () => true, size: 128 }),
    }),
  );

  const escaped = makeReport();
  escaped.executions[0].screenshotPath = "../outside.png";
  await assert.rejects(
    validateExpectedReleaseReport(escaped, {
      projectRoot: "/tmp/statecraft-release-smoke",
      statFile: async () => ({ isFile: () => true, size: 128 }),
    }),
    /Screenshot escaped the smoke project/u,
  );
});

test("rejects missing, non-file, and empty screenshot evidence", async () => {
  const cases = [
    {
      expected: /missing screenshot/u,
      statFile: async () => {
        throw new Error("missing screenshot");
      },
    },
    {
      expected: /not a regular file/u,
      statFile: async () => ({ isFile: () => false, size: 128 }),
    },
    {
      expected: /Screenshot is empty/u,
      statFile: async () => ({ isFile: () => true, size: 0 }),
    },
  ];

  for (const { expected, statFile } of cases) {
    await assert.rejects(
      validateExpectedReleaseReport(makeReport(), {
        projectRoot: "/tmp/statecraft-release-smoke",
        statFile,
      }),
      expected,
    );
  }
});

test("delegates schema validation to the built core parser", async () => {
  const source = { schemaVersion: 1 };
  const parsed = { parsed: true };
  let loadedUrl;
  let received;
  assert.equal(
    await parseBuiltReport(source, {
      loadModule: async (moduleUrl) => {
        loadedUrl = moduleUrl;
        return {
          parseReport(value) {
            received = value;
            return parsed;
          },
        };
      },
      moduleUrl: "file:///built/core/index.js",
    }),
    parsed,
  );
  assert.equal(loadedUrl, "file:///built/core/index.js");
  assert.equal(received, source);
  await assert.rejects(
    parseBuiltReport(source, {
      loadModule: async () => ({}),
      moduleUrl: "file:///missing-parser.js",
    }),
    /does not export parseReport/u,
  );
});

test("handles readiness success, early exit, and timeout", async () => {
  const runningChild = { exitCode: null, signalCode: null };
  await waitForServer("http://127.0.0.1:3000", runningChild, () => "", () => "", {
    fetchPage: async () => ({ ok: true }),
  });

  await assert.rejects(
    waitForServer(
      "http://127.0.0.1:3000",
      { exitCode: 1, signalCode: null },
      () => "server output\n",
      () => "server error\n",
    ),
    /exited before readiness[\s\S]*server output[\s\S]*server error/u,
  );

  let time = 0;
  await assert.rejects(
    waitForServer("http://127.0.0.1:3000", runningChild, () => "", () => "", {
      fetchPage: async () => {
        throw new Error("not ready");
      },
      now: () => time,
      pause: async (milliseconds) => {
        time += milliseconds;
      },
      timeoutMs: 200,
    }),
    /did not become ready/u,
  );
});

test("terminates a command that exceeds its deadline", async () => {
  await assert.rejects(
    runCommand(
      process.execPath,
      ["-e", "setInterval(() => undefined, 1_000)"],
      { terminateGraceMs: 50, timeoutMs: 50 },
    ),
    /Command timed out after 50ms/u,
  );
});

test("stops processes gracefully and escalates when needed", async () => {
  const gracefulSignals = [];
  const graceful = {
    exitCode: null,
    kill(signal) {
      gracefulSignals.push(signal);
      this.exitCode = 0;
      return true;
    },
    signalCode: null,
  };
  await stopProcess(graceful, Promise.resolve({ code: 0, signal: null }), 1);
  assert.deepEqual(gracefulSignals, ["SIGTERM"]);

  const forcedSignals = [];
  let resolveExit;
  const forcedExit = new Promise((resolve) => {
    resolveExit = resolve;
  });
  const forced = {
    exitCode: null,
    kill(signal) {
      forcedSignals.push(signal);
      if (signal === "SIGKILL") {
        this.signalCode = signal;
        resolveExit({ code: null, signal });
      }
      return true;
    },
    signalCode: null,
  };
  await stopProcess(forced, forcedExit, 1);
  assert.deepEqual(forcedSignals, ["SIGTERM", "SIGKILL"]);
});

class FakeServer extends EventEmitter {
  constructor() {
    super();
    this.exitCode = null;
    this.signalCode = null;
    this.stderr = new PassThrough();
    this.stdout = new PassThrough();
  }

  kill(signal) {
    this.signalCode = signal;
    this.emit("exit", null, signal);
    return true;
  }
}

test("orchestrates the built bin target and always cleans local output", async () => {
  const projectRoot = "/tmp/statecraft-release-smoke-owned";
  const removed = [];
  const recorded = [];
  const commands = [];
  const server = new FakeServer();
  const report = makeReport();

  await runReleaseSmoke({
    allocatePort: async () => 4_321,
    createProject: async () => projectRoot,
    execute: async (command, args, options) => {
      commands.push({ args, command, options });
      return {
        code: 1,
        signal: null,
        stderr: "",
        stdout: "4 of 60 executions failed.\n",
      };
    },
    keepOutput: false,
    loadReport: async (value) => value,
    log: () => {},
    readText: async (filePath) =>
      filePath.endsWith("statecraft.json")
        ? JSON.stringify(report)
        : "Execution coverage 93.33% <span>Failed</span><strong>4</strong>",
    recordOutput: async (...args) => recorded.push(args),
    removeProject: async (removedRoot) => removed.push(removedRoot),
    spawnProcess: () => server,
    validateReport: async (value, options) => {
      assert.deepEqual(value, report);
      assert.equal(options.projectRoot, projectRoot);
    },
    waitUntilReady: async (url) => {
      assert.equal(url, "http://127.0.0.1:4321/api/dashboard");
    },
  });

  assert.equal(commands.length, 1);
  assert.equal(commands[0].command, process.execPath);
  assert.match(commands[0].args[0], /packages\/cli\/dist\/bin\.js$/u);
  assert.equal(commands[0].options.cwd, projectRoot);
  assert.deepEqual(recorded, [[projectRoot, undefined]]);
  assert.deepEqual(removed, [projectRoot]);
  assert.equal(server.signalCode, "SIGTERM");
});

test("cleans an owned project when setup fails before server spawn", async () => {
  const removed = [];
  await assert.rejects(
    runReleaseSmoke({
      allocatePort: async () => {
        throw new Error("no port");
      },
      createProject: async () => "/tmp/statecraft-release-smoke-owned",
      keepOutput: false,
      recordOutput: async () => {},
      removeProject: async (projectRoot) => removed.push(projectRoot),
    }),
    /no port/u,
  );
  assert.deepEqual(removed, ["/tmp/statecraft-release-smoke-owned"]);
});

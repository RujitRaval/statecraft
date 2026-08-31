import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rename, rm, symlink, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  NPM_REGISTRY,
  PLAYWRIGHT_VERSION,
  REGISTRY_INSTALL_RETRY_DELAY_MS,
  REGISTRY_INSTALL_RETRY_WINDOW_MS,
  assertPublicReport,
  assertRegistryInstall,
  cleanRegistryConsumer,
  installRegistryConsumer,
  normalizeRegistrySmokeVersion,
  parseRegistrySmokeArguments,
  runRegistryJourney,
  startRegistryFixture,
} from "./public-url-registry-smoke.mjs";

test("parses one exact stable npm version or GitHub tag", () => {
  assert.deepEqual(parseRegistrySmokeArguments(["--version", "0.24.9"]), { version: "0.24.9", withDeps: false });
  assert.deepEqual(parseRegistrySmokeArguments(["--with-deps", "--tag", "v0.24.9"]), { version: "0.24.9", withDeps: true });
  assert.equal(normalizeRegistrySmokeVersion("1.2.3"), "1.2.3");
  for (const arguments_ of [
    [],
    ["--version", "0.24.9", "--tag", "v0.24.9"],
    ["--version"],
    ["--version", "0.24.9", "--version", "0.24.9"],
    ["--version", "0.24.9", "--with-deps", "--with-deps"],
    ["--latest", "0.24.9"],
  ]) {
    assert.throws(() => parseRegistrySmokeArguments(arguments_));
  }
  for (const version of ["0.24", "0.24.9.0", "0.24.9-beta.1", "00.24.9", "latest", "v"] ) {
    assert.throws(() => normalizeRegistrySmokeVersion(version), /npm version/u);
  }
});

test("retries thrown npm timeouts but not permanent execution errors", async () => {
  const delays = [];
  let installs = 0;
  await installRegistryConsumer({
    consumerRoot: "/tmp/statecraft-timeout-consumer",
    execute: async (_command, args) => {
      if (args[0] === "install") {
        installs += 1;
        if (installs === 1) throw new Error("npm exceeded 30000ms.");
      }
      return { code: 0, signal: null, stderr: "", stdout: "" };
    },
    sleep: async (duration) => delays.push(duration),
    version: "0.24.9",
  });
  assert.equal(installs, 2);
  assert.deepEqual(delays, [REGISTRY_INSTALL_RETRY_DELAY_MS]);

  await assert.rejects(
    installRegistryConsumer({
      consumerRoot: "/tmp/statecraft-spawn-consumer",
      execute: async (_command, args) => {
        if (args[0] === "install") throw new Error("spawn npm ENOENT");
        return { code: 0, signal: null, stderr: "", stdout: "" };
      },
      sleep: async () => assert.fail("permanent execution errors must not retry"),
      version: "0.24.9",
    }),
    /spawn npm ENOENT/u,
  );
});

test("installs exact registry packages with bounded propagation retries", async () => {
  const commands = [];
  const delays = [];
  let installAttempt = 0;
  const execute = async (command, args, options) => {
    commands.push({ args, command, options });
    if (args[0] === "install") {
      installAttempt += 1;
      if (installAttempt < 3) {
        return { code: 1, signal: null, stderr: "npm error ETARGET No matching version", stdout: "" };
      }
    }
    return { code: 0, signal: null, stderr: "", stdout: "" };
  };

  await installRegistryConsumer({
    consumerRoot: "/tmp/statecraft-empty-consumer",
    execute,
    sleep: async (duration) => delays.push(duration),
    version: "0.24.9",
  });

  assert.equal(installAttempt, 3);
  assert.equal(commands[0].args.join(" "), "init --yes");
  assert.equal(commands[0].options.timeout, 60_000);
  assert.deepEqual(delays, [
    REGISTRY_INSTALL_RETRY_DELAY_MS,
    REGISTRY_INSTALL_RETRY_DELAY_MS,
  ]);
  const install = commands[1].args;
  assert.deepEqual(install.slice(-2), ["uiwitness@0.24.9", `playwright@${PLAYWRIGHT_VERSION}`]);
  assert.deepEqual(install.slice(install.indexOf("--registry"), install.indexOf("--registry") + 2), ["--registry", NPM_REGISTRY]);
  const installCommands = commands.filter(({ args }) => args[0] === "install");
  assert.equal(installCommands.every(({ args }) => args.includes("--prefer-online")), true);
  assert.deepEqual(
    installCommands.map(({ args }) => args[args.indexOf("--cache") + 1]),
    [1, 2, 3].map((attempt) =>
      path.join("/tmp/statecraft-empty-consumer", ".npm-cache", `install-${attempt}`),
    ),
  );
  assert.equal(commands[1].options.timeout, 30_000);
  assert.deepEqual(commands.at(-1).args, ["exec", "--offline", "--", "playwright", "install", "chromium"]);
  assert.equal(commands.at(-1).options.timeout, 180_000);
});

test("does not reuse a registry cache after a missing-version response", async () => {
  const cachePaths = new Set();
  let installAttempts = 0;
  await installRegistryConsumer({
    consumerRoot: "/tmp/statecraft-cache-revalidation-consumer",
    execute: async (_command, args) => {
      if (args[0] !== "install") {
        return { code: 0, signal: null, stderr: "", stdout: "" };
      }
      installAttempts += 1;
      const cachePath = args[args.indexOf("--cache") + 1];
      if (cachePaths.has(cachePath)) {
        return { code: 1, signal: null, stderr: "npm error ETARGET cached missing version", stdout: "" };
      }
      cachePaths.add(cachePath);
      return installAttempts === 1
        ? { code: 1, signal: null, stderr: "npm error ETARGET No matching version", stdout: "" }
        : { code: 0, signal: null, stderr: "", stdout: "" };
    },
    sleep: async () => {},
    version: "0.24.9",
  });
  assert.equal(installAttempts, 2);
  assert.equal(cachePaths.size, 2);
});

test("retries registry propagation for the complete elapsed-time window", async () => {
  let clock = 0;
  let installAttempts = 0;
  const delays = [];
  await assert.rejects(
    installRegistryConsumer({
      consumerRoot: "/tmp/statecraft-propagation-consumer",
      execute: async (_command, args) => {
        if (args[0] === "install") {
          installAttempts += 1;
          return {
            code: 1,
            signal: null,
            stderr: "npm error ETARGET No matching version",
            stdout: "",
          };
        }
        return { code: 0, signal: null, stderr: "", stdout: "" };
      },
      now: () => clock,
      sleep: async (duration) => {
        delays.push(duration);
        clock += duration;
      },
      version: "0.24.9",
    }),
    /Installing exact npm registry packages exited 1/u,
  );
  assert.equal(installAttempts, 61);
  assert.equal(delays.length, 60);
  assert.equal(
    delays.reduce((total, duration) => total + duration, 0),
    REGISTRY_INSTALL_RETRY_WINDOW_MS,
  );
  assert.equal(delays.every((duration) => duration === REGISTRY_INSTALL_RETRY_DELAY_MS), true);
});

test("counts command timeouts against the registry retry window", async () => {
  let clock = 0;
  let installAttempts = 0;
  const delays = [];
  await assert.rejects(
    installRegistryConsumer({
      consumerRoot: "/tmp/statecraft-time-bounded-consumer",
      execute: async (_command, args) => {
        if (args[0] === "install") {
          installAttempts += 1;
          clock += 30_000;
          throw new Error("npm exceeded 30000ms.");
        }
        return { code: 0, signal: null, stderr: "", stdout: "" };
      },
      now: () => clock,
      sleep: async (duration) => {
        delays.push(duration);
        clock += duration;
      },
      version: "0.24.9",
    }),
    /npm exceeded 30000ms/u,
  );
  assert.equal(installAttempts, 16);
  assert.deepEqual(delays, Array.from({ length: 15 }, () => 10_000));
  assert.equal(clock, REGISTRY_INSTALL_RETRY_WINDOW_MS + 30_000);
});

test("caps retryable thrown errors even when the clock does not advance", async () => {
  let installAttempts = 0;
  const delays = [];
  await assert.rejects(
    installRegistryConsumer({
      consumerRoot: "/tmp/statecraft-thrown-cap-consumer",
      execute: async (_command, args) => {
        if (args[0] === "install") {
          installAttempts += 1;
          throw new Error("npm exceeded 30000ms.");
        }
        return { code: 0, signal: null, stderr: "", stdout: "" };
      },
      now: () => 0,
      sleep: async (duration) => delays.push(duration),
      version: "0.24.9",
    }),
    /npm exceeded 30000ms/u,
  );
  assert.equal(installAttempts, 61);
  assert.equal(delays.length, 60);
});

test("uses the remaining partial window before rejecting a thrown timeout", async () => {
  let clock = 0;
  let installAttempts = 0;
  const delays = [];
  await assert.rejects(
    installRegistryConsumer({
      consumerRoot: "/tmp/statecraft-partial-window-consumer",
      execute: async (_command, args) => {
        if (args[0] === "install") {
          installAttempts += 1;
          if (installAttempts === 1) clock += REGISTRY_INSTALL_RETRY_WINDOW_MS - 5_000;
          throw new Error("npm exceeded 30000ms.");
        }
        return { code: 0, signal: null, stderr: "", stdout: "" };
      },
      now: () => clock,
      sleep: async (duration) => {
        delays.push(duration);
        clock += duration;
      },
      version: "0.24.9",
    }),
    /npm exceeded 30000ms/u,
  );
  assert.equal(installAttempts, 2);
  assert.deepEqual(delays, [5_000]);
});

test("uses the partial window before a slow failed result exhausts the deadline", async () => {
  let clock = 0;
  let installAttempts = 0;
  const delays = [];
  await assert.rejects(
    installRegistryConsumer({
      consumerRoot: "/tmp/statecraft-result-deadline-consumer",
      execute: async (_command, args) => {
        if (args[0] === "install") {
          installAttempts += 1;
          clock += installAttempts === 1 ? REGISTRY_INSTALL_RETRY_WINDOW_MS - 5_000 : 1;
          return { code: 1, signal: null, stderr: "npm error ETARGET No matching version", stdout: "" };
        }
        return { code: 0, signal: null, stderr: "", stdout: "" };
      },
      now: () => clock,
      sleep: async (duration) => {
        delays.push(duration);
        clock += duration;
      },
      version: "0.24.9",
    }),
    /Installing exact npm registry packages exited 1/u,
  );
  assert.equal(installAttempts, 2);
  assert.deepEqual(delays, [5_000]);
});

test("provisions browser system dependencies only when requested", async () => {
  const commands = [];
  await installRegistryConsumer({
    consumerRoot: "/tmp/statecraft-with-deps-consumer",
    execute: async (command, args, options) => {
      commands.push({ args, command, options });
      return { code: 0, signal: null, stderr: "", stdout: "" };
    },
    version: "0.24.9",
    withDeps: true,
  });
  assert.deepEqual(commands.at(-1).args, [
    "exec", "--offline", "--", "playwright", "install", "--with-deps", "chromium",
  ]);
});

test("does not retry permanent npm installation failures", async () => {
  let attempts = 0;
  await assert.rejects(
    installRegistryConsumer({
      consumerRoot: "/tmp/statecraft-empty-consumer",
      execute: async (_command, args) => {
        if (args[0] === "install") {
          attempts += 1;
          return { code: 1, signal: null, stderr: "npm error EACCES permission denied", stdout: "" };
        }
        return { code: 0, signal: null, stderr: "", stdout: "" };
      },
      sleep: async () => assert.fail("permanent errors must not retry"),
      version: "0.24.9",
    }),
    /Installing exact npm registry packages exited 1/u,
  );
  assert.equal(attempts, 1);
});

test("verifies every installed public package and both CommonJS npm project shapes", async (context) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "statecraft-registry-install-test-"));
  context.after(() => rm(root, { force: true, recursive: true }));
  for (const name of [
    "uiwitness-core",
    "uiwitness-report",
    "uiwitness-runner-playwright",
    "uiwitness",
    "playwright",
  ]) {
    await mkdir(path.join(root, "node_modules", name), { recursive: true });
    await writeFile(path.join(root, "node_modules", name, "package.json"), JSON.stringify({
      ...(name === "uiwitness" ? { bin: { uiwitness: "./dist/bin.js" } } : {}),
      ...(name === "uiwitness-runner-playwright" ? { dependencies: { playwright: PLAYWRIGHT_VERSION } } : {}),
      name,
      version: name === "playwright" ? PLAYWRIGHT_VERSION : "0.24.9",
    }));
  }

  for (const type of [undefined, "commonjs"]) {
    await writeFile(path.join(root, "package.json"), JSON.stringify({
      ...(type === undefined ? {} : { type }),
      devDependencies: { playwright: PLAYWRIGHT_VERSION, "uiwitness": "0.24.9" },
    }));
    assert.equal(
      await assertRegistryInstall(root, "0.24.9"),
      path.join(root, "node_modules", "uiwitness", "dist", "bin.js"),
    );
  }
  await writeFile(path.join(root, "package.json"), JSON.stringify({
    type: "module",
    devDependencies: { playwright: PLAYWRIGHT_VERSION, "uiwitness": "0.24.9" },
  }));
  await assert.rejects(assertRegistryInstall(root, "0.24.9"), /CommonJS package mode/u);
  await writeFile(path.join(root, "package.json"), JSON.stringify({
    type: "commonjs",
    devDependencies: { playwright: PLAYWRIGHT_VERSION, "uiwitness": "0.24.9" },
  }));
  await writeFile(
    path.join(root, "node_modules", "uiwitness-core", "package.json"),
    JSON.stringify({ name: "uiwitness-core", version: "0.24.8" }),
  );
  await assert.rejects(assertRegistryInstall(root, "0.24.9"), /did not resolve to the release version/u);
});

function fixtureReport() {
  const executions = ["/", "/about"].flatMap((routePath, routeIndex) =>
    ["desktop", "mobile"].flatMap((viewportId) =>
      ["light", "dark"].map((theme) => ({
        durationMs: 1,
        failures: [],
        id: `${routeIndex}-${viewportId}-${theme}`,
        navigation: { requestedUrl: `http://127.0.0.1:4321${routePath}`, status: 200, url: `http://127.0.0.1:4321${routePath}` },
        routeId: routeIndex === 0 ? "home" : "about",
        routePath,
        screenshotPath: `.uiwitness/artifacts/${routeIndex}/public/${viewportId}-${theme}.png`,
        stateId: "public",
        status: "passed",
        theme,
        viewportId,
      })),
    ),
  );
  return {
    executions,
    generatedAt: "2026-08-22T00:00:00.000Z",
    project: { baseURL: "http://127.0.0.1:4321/", name: "Quick Check" },
    schemaVersion: 1,
    summary: {
      coverage: {
        execution: { covered: 8, percentage: 100, total: 8 },
        responsive: { covered: 2, percentage: 100, total: 2 },
        state: { covered: 2, percentage: 100, total: 2 },
        theme: { covered: 2, percentage: 100, total: 2 },
      },
      durationMs: 8,
      executions: 8,
      failed: 0,
      passed: 8,
      routes: 2,
      states: 2,
    },
  };
}

async function writeEvidence(root) {
  const report = fixtureReport();
  await mkdir(path.join(root, ".uiwitness", "report"), { recursive: true });
  for (const execution of report.executions) {
    const screenshot = path.join(root, execution.screenshotPath);
    await mkdir(path.dirname(screenshot), { recursive: true });
    await writeFile(screenshot, "png");
  }
  await writeFile(path.join(root, ".uiwitness", "report", "uiwitness.json"), JSON.stringify(report));
  await writeFile(path.join(root, ".uiwitness", "report", "index.html"), '<main data-brand-system="kinetic-evidence-v1"></main>');
}

test("rejects screenshot evidence that resolves outside the artifact boundary", async (context) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "statecraft-registry-boundary-test-"));
  context.after(() => rm(root, { force: true, recursive: true }));
  await writeEvidence(root);
  const reportPath = path.join(root, ".uiwitness", "report", "uiwitness.json");
  const report = JSON.parse(await readFile(reportPath, "utf8"));
  const screenshot = path.join(root, report.executions[0].screenshotPath);
  const outside = path.join(root, "outside.png");
  await writeFile(outside, "png");
  await unlink(screenshot);
  await symlink(outside, screenshot);
  await assert.rejects(assertPublicReport(root));
});

test("rejects an artifact root that resolves outside the temporary consumer", async (context) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "statecraft-registry-root-boundary-test-"));
  const outside = await mkdtemp(path.join(os.tmpdir(), "statecraft-registry-outside-test-"));
  context.after(async () => {
    await rm(root, { force: true, recursive: true });
    await rm(outside, { force: true, recursive: true });
  });
  await writeEvidence(root);
  const artifactRoot = path.join(root, ".uiwitness", "artifacts");
  const movedArtifacts = path.join(outside, "artifacts");
  await rename(artifactRoot, movedArtifacts);
  await symlink(movedArtifacts, artifactRoot);
  await assert.rejects(
    assertPublicReport(root),
    /Artifact root resolved outside the registry consumer/u,
  );
});

test("removes the temporary consumer even when fixture shutdown fails", async () => {
  const removals = [];
  await assert.rejects(
    cleanRegistryConsumer({
      consumerRoot: "/tmp/statecraft-registry-cleanup-test",
      fixture: { close: async () => { throw new Error("fixture close failed"); } },
      remove: async (...arguments_) => removals.push(arguments_),
    }),
    /fixture close failed/u,
  );
  assert.deepEqual(removals, [[
    "/tmp/statecraft-registry-cleanup-test",
    { force: true, recursive: true },
  ]]);
});

test("serves only the deterministic two-page authorized fixture", async () => {
  const fixture = await startRegistryFixture();
  try {
    const home = await fetch(fixture.url);
    const about = await fetch(new URL("/about", fixture.url));
    const missing = await fetch(new URL("/missing", fixture.url));
    assert.equal(home.status, 200);
    assert.match(await home.text(), /Release home/u);
    assert.equal(about.status, 200);
    assert.match(await about.text(), /Release about/u);
    assert.equal(missing.status, 404);
  } finally {
    await fixture.close();
  }
});

test("runs check, explicit promotion, and untouched scan in order", async (context) => {
  const consumerRoot = await mkdtemp(path.join(os.tmpdir(), "statecraft-registry-journey-test-"));
  context.after(() => rm(consumerRoot, { force: true, recursive: true }));
  const commands = [];
  const fixtureUrl = "http://127.0.0.1:4321/";
  const execute = async (command, args, options) => {
    commands.push({ args, command, options });
    await writeEvidence(consumerRoot);
    if (args.includes("--write-config")) {
      await mkdir(path.join(consumerRoot, "statecraft", "scenarios", "public"), { recursive: true });
      await writeFile(path.join(consumerRoot, "statecraft.config.mts"), 'import { defineConfig } from "uiwitness";\nexport default defineConfig({});\n');
      await writeFile(path.join(consumerRoot, "statecraft", "scenarios", "public", "default.mts"), 'import { publicSiteScenario } from "uiwitness/public-site-scenario";\nexport default publicSiteScenario;\n');
      return { code: 0, signal: null, stderr: "", stdout: "Saved the discovered public surface.\nNext: add real product states, then run `npx statecraft scan`.\n" };
    }
    if (args.at(-1) === "scan") {
      return { code: 0, signal: null, stderr: "", stdout: "All 8 executions passed.\n" };
    }
    return { code: 0, signal: null, stderr: "", stdout: `All 8 checks passed.\nNext: npx statecraft check ${fixtureUrl} --write-config\n` };
  };

  await assert.rejects(readFile(path.join(consumerRoot, "statecraft.config.mts")), { code: "ENOENT" });
  await runRegistryJourney({
    cliBinPath: "/registry/node_modules/uiwitness/dist/bin.js",
    consumerRoot,
    execute,
    fixtureUrl,
  });

  assert.deepEqual(commands.map(({ args }) => args.slice(1)), [
    ["check", fixtureUrl, "--max-pages", "2"],
    ["check", fixtureUrl, "--write-config"],
    ["scan"],
  ]);
  assert.equal(commands.every(({ command }) => command === process.execPath), true);
  assert.equal(commands.every(({ options }) => options.cwd === consumerRoot), true);
  assert.equal(commands.every(({ options }) => options.timeout === 120_000), true);
  assert.match(await readFile(path.join(consumerRoot, "statecraft.config.mts"), "utf8"), /defineConfig/u);
});

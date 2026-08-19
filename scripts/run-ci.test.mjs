import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { runCi } from "./run-ci.mjs";

async function makeFixture(packageJson) {
  const root = await mkdtemp(path.join(tmpdir(), "statecraft-ci-"));
  if (packageJson) {
    await writeFile(path.join(root, "package.json"), JSON.stringify(packageJson));
  }
  return root;
}

test("skips implementation checks before package.json exists", async (t) => {
  const root = await makeFixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  const messages = [];
  const result = await runCi({ root, log: (message) => messages.push(message) });

  assert.deepEqual(result.scriptsRun, []);
  assert.match(messages[0], /No package\.json/u);
});

test("requires every root quality script", async (t) => {
  const root = await makeFixture({ scripts: { lint: "eslint ." } });
  t.after(() => rm(root, { recursive: true, force: true }));

  await assert.rejects(
    runCi({ root, log: () => {} }),
    /Missing required package scripts: typecheck, test, build/u,
  );
});

test("runs quality scripts in deterministic order", async (t) => {
  const root = await makeFixture({
    scripts: {
      lint: "lint",
      typecheck: "typecheck",
      test: "test",
      build: "build",
    },
  });
  t.after(() => rm(root, { recursive: true, force: true }));
  const calls = [];
  const result = await runCi({
    root,
    log: () => {},
    runCommand: (script, commandRoot) => {
      calls.push([script, commandRoot]);
      return { status: 0 };
    },
  });

  assert.deepEqual(result.scriptsRun, ["lint", "typecheck", "test", "build"]);
  assert.deepEqual(calls.map(([script]) => script), result.scriptsRun);
  assert.ok(calls.every(([, commandRoot]) => commandRoot === root));
});

test("stops at the first failing quality script", async (t) => {
  const root = await makeFixture({
    scripts: {
      lint: "lint",
      typecheck: "typecheck",
      test: "test",
      build: "build",
    },
  });
  t.after(() => rm(root, { recursive: true, force: true }));
  const calls = [];

  await assert.rejects(
    runCi({
      root,
      log: () => {},
      runCommand: (script) => {
        calls.push(script);
        return { status: script === "test" ? 1 : 0 };
      },
    }),
    /Repository check failed: test exited with 1/u,
  );
  assert.deepEqual(calls, ["lint", "typecheck", "test"]);
});

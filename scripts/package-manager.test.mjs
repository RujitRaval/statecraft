import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("root scripts use the pinned Corepack package manager", async () => {
  const manifestUrl = new URL("../package.json", import.meta.url);
  const manifest = JSON.parse(await readFile(manifestUrl, "utf8"));

  assert.equal(manifest.engines.node, "^22.20.0 || ^24.0.0");
  assert.match(manifest.scripts.build, /^corepack pnpm /u);
  assert.match(manifest.scripts.test, /^corepack pnpm /u);
  assert.match(manifest.scripts.typecheck, /&& corepack pnpm /u);
});

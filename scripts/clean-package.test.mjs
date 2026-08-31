import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { cleanPackage } from "./clean-package.mjs";

test("removes only the package dist directory", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "uiwitness-clean-"));
  t.after(() => rm(root, { force: true, recursive: true }));
  await mkdir(path.join(root, "dist"));
  await writeFile(path.join(root, "dist", "stale.js"), "stale");
  await writeFile(path.join(root, "source.ts"), "source");

  assert.equal(await cleanPackage({ root }), path.join(root, "dist"));
  await assert.rejects(access(path.join(root, "dist")), { code: "ENOENT" });
  await assert.doesNotReject(access(path.join(root, "source.ts")));
});

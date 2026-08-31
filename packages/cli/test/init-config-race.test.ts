import * as originalFs from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("node:fs/promises", async (importOriginal) => {
  const original = await importOriginal<typeof import("node:fs/promises")>();
  return {
    ...original,
    open: vi.fn(async (...args: Parameters<typeof original.open>) => {
      const path = String(args[0]);
      if (path.endsWith("uiwitness.config.mts")) {
        await original.writeFile(
          join(dirname(path), "uiwitness.config.mjs"),
          "export default {};",
          "utf8",
        );
      }
      return original.open(...args);
    }),
  };
});

import { initProject } from "../src/init.js";

const projects: string[] = [];

afterEach(async () => {
  await Promise.all(
    projects.splice(0).map((project) =>
      originalFs.rm(project, { force: true, recursive: true }),
    ),
  );
});

describe("initProject config races", () => {
  it("detects an alternate config created during publication", async () => {
    const project = await originalFs.realpath(
      await originalFs.mkdtemp(join(tmpdir(), "uiwitness-cli-init-race-")),
    );
    projects.push(project);

    await expect(initProject({ cwd: project })).rejects.toMatchObject({
      code: "INIT_CONFLICT",
      paths: [join(project, "uiwitness.config.mjs")],
    });
    await expect(
      originalFs.readFile(join(project, "uiwitness.config.mts"), "utf8"),
    ).resolves.toContain("defineConfig");
    await expect(
      originalFs.readFile(join(project, "uiwitness.config.mjs"), "utf8"),
    ).resolves.toBe("export default {};");
  });
});

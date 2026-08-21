import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { InitError, initProject } from "../src/init.js";

const temporaryProjects: string[] = [];

async function temporaryProject(): Promise<string> {
  const project = await realpath(
    await mkdtemp(join(tmpdir(), "statecraft-cli-init-")),
  );
  temporaryProjects.push(project);
  return project;
}

afterEach(async () => {
  const { rm } = await import("node:fs/promises");
  await Promise.all(
    temporaryProjects.splice(0).map((project) =>
      rm(project, { force: true, recursive: true }),
    ),
  );
});

describe("initProject", () => {
  it("creates a minimal typed config and scenario", async () => {
    const project = await temporaryProject();

    const result = await initProject({ cwd: project });

    expect(result).toEqual({
      configPath: join(project, "statecraft.config.ts"),
      files: [
        join(project, "statecraft.config.ts"),
        join(project, "statecraft", "scenarios", "home", "success.ts"),
      ],
      projectRoot: project,
      scenarioPath: join(
        project,
        "statecraft",
        "scenarios",
        "home",
        "success.ts",
      ),
    });
    await expect(readFile(result.configPath, "utf8")).resolves.toContain(
      'import { defineConfig } from "statecraft-ui";',
    );
    await expect(readFile(result.configPath, "utf8")).resolves.toContain(
      'setup: "./statecraft/scenarios/home/success.ts"',
    );
    await expect(readFile(result.scenarioPath, "utf8")).resolves.toContain(
      "const scenario = {",
    );
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.files)).toBe(true);
  });

  it("preserves existing directories and unrelated files", async () => {
    const project = await temporaryProject();
    const scenarios = join(project, "statecraft", "scenarios");
    const unrelated = join(project, "statecraft", "notes.txt");
    await mkdir(scenarios, { recursive: true });
    await writeFile(unrelated, "keep me", "utf8");

    await initProject({ cwd: project });

    await expect(readFile(unrelated, "utf8")).resolves.toBe("keep me");
    await expect(
      lstat(join(scenarios, "home", "success.ts")),
    ).resolves.toMatchObject({});
  });

  it("does not create a scenario when the config already exists", async () => {
    const project = await temporaryProject();
    const configPath = join(project, "statecraft.config.ts");
    const scenarioPath = join(
      project,
      "statecraft",
      "scenarios",
      "home",
      "success.ts",
    );
    await writeFile(configPath, "existing config", "utf8");

    await expect(initProject({ cwd: project })).rejects.toMatchObject({
      code: "INIT_CONFLICT",
      paths: [configPath],
    });
    await expect(readFile(configPath, "utf8")).resolves.toBe(
      "existing config",
    );
    await expect(lstat(scenarioPath)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("does not create files when another supported config already exists", async () => {
    const project = await temporaryProject();
    const existingConfig = join(project, "statecraft.config.mjs");
    const generatedConfig = join(project, "statecraft.config.ts");
    const scenarioPath = join(
      project,
      "statecraft",
      "scenarios",
      "home",
      "success.ts",
    );
    await writeFile(existingConfig, "export default {};", "utf8");

    await expect(initProject({ cwd: project })).rejects.toMatchObject({
      code: "INIT_CONFLICT",
      paths: [existingConfig],
    });
    await expect(readFile(existingConfig, "utf8")).resolves.toBe(
      "export default {};",
    );
    await expect(lstat(generatedConfig)).rejects.toMatchObject({
      code: "ENOENT",
    });
    await expect(lstat(scenarioPath)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("does not create a config when the scenario already exists", async () => {
    const project = await temporaryProject();
    const configPath = join(project, "statecraft.config.ts");
    const scenarioPath = join(
      project,
      "statecraft",
      "scenarios",
      "home",
      "success.ts",
    );
    await mkdir(join(project, "statecraft", "scenarios", "home"), {
      recursive: true,
    });
    await writeFile(scenarioPath, "existing scenario", "utf8");

    await expect(initProject({ cwd: project })).rejects.toMatchObject({
      code: "INIT_CONFLICT",
      paths: [scenarioPath],
    });
    await expect(readFile(scenarioPath, "utf8")).resolves.toBe(
      "existing scenario",
    );
    await expect(lstat(configPath)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("keeps both generated files unchanged when init is repeated", async () => {
    const project = await temporaryProject();
    const first = await initProject({ cwd: project });
    const originalConfig = await readFile(first.configPath, "utf8");
    const originalScenario = await readFile(first.scenarioPath, "utf8");

    await expect(initProject({ cwd: project })).rejects.toBeInstanceOf(
      InitError,
    );
    await expect(readFile(first.configPath, "utf8")).resolves.toBe(
      originalConfig,
    );
    await expect(readFile(first.scenarioPath, "utf8")).resolves.toBe(
      originalScenario,
    );
  });

  it.skipIf(process.platform === "win32")(
    "refuses a symbolic-link starter directory",
    async () => {
      const project = await temporaryProject();
      const outside = await temporaryProject();
      await symlink(outside, join(project, "statecraft"));

      await expect(initProject({ cwd: project })).rejects.toMatchObject({
        code: "INIT_CONFLICT",
        paths: [join(project, "statecraft")],
      });
      await expect(lstat(join(outside, "scenarios"))).rejects.toMatchObject({
        code: "ENOENT",
      });
    },
  );

  it.skipIf(process.platform === "win32")(
    "returns canonical paths when cwd is a symbolic link",
    async () => {
      const project = await temporaryProject();
      const links = await temporaryProject();
      const projectLink = join(links, "project-link");
      await symlink(project, projectLink);

      const result = await initProject({ cwd: projectLink });

      expect(result.projectRoot).toBe(project);
      expect(result.configPath).toBe(join(project, "statecraft.config.ts"));
      expect(result.scenarioPath).toBe(
        join(project, "statecraft", "scenarios", "home", "success.ts"),
      );
    },
  );

  it("refuses a non-directory starter boundary", async () => {
    const project = await temporaryProject();
    const boundary = join(project, "statecraft");
    await writeFile(boundary, "keep", "utf8");

    await expect(initProject({ cwd: project })).rejects.toMatchObject({
      code: "INIT_CONFLICT",
      paths: [boundary],
    });
    await expect(readFile(boundary, "utf8")).resolves.toBe("keep");
    await expect(
      lstat(join(project, "statecraft.config.ts")),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("lets only one concurrent initialization publish each target", async () => {
    const project = await temporaryProject();

    const outcomes = await Promise.allSettled([
      initProject({ cwd: project }),
      initProject({ cwd: project }),
    ]);

    expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(
      1,
    );
    const rejected = outcomes.find((outcome) => outcome.status === "rejected");
    expect(rejected).toMatchObject({
      reason: { code: "INIT_CONFLICT" },
      status: "rejected",
    });
    await expect(
      readFile(join(project, "statecraft.config.ts"), "utf8"),
    ).resolves.toContain("defineConfig");
    await expect(
      readFile(
        join(project, "statecraft", "scenarios", "home", "success.ts"),
        "utf8",
      ),
    ).resolves.toContain("export default scenario;");
  });

  it("rejects missing and non-directory roots", async () => {
    const project = await temporaryProject();
    const file = join(project, "file.txt");
    await writeFile(file, "not a directory", "utf8");

    await expect(
      initProject({ cwd: join(project, "missing") }),
    ).rejects.toMatchObject({ code: "INIT_ROOT_INVALID" });
    await expect(initProject({ cwd: file })).rejects.toMatchObject({
      code: "INIT_ROOT_INVALID",
      paths: [file],
    });
  });

  it.skipIf(process.platform === "win32" || process.getuid?.() === 0)(
    "rejects a non-writable root without creating files",
    async () => {
      const project = await temporaryProject();
      await chmod(project, 0o500);
      try {
        await expect(initProject({ cwd: project })).rejects.toMatchObject({
          code: "INIT_ROOT_INVALID",
        });
      } finally {
        await chmod(project, 0o700);
      }
      await expect(
        lstat(join(project, "statecraft.config.ts")),
      ).rejects.toMatchObject({ code: "ENOENT" });
    },
  );
});

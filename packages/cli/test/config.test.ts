import {
  chmod,
  mkdtemp,
  mkdir,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { ConfigValidationError } from "statecraft-ui-core";
import { afterEach, describe, expect, it } from "vitest";

import {
  ConfigDiscoveryError,
  ConfigLoadError,
  DEFAULT_CONFIG_FILENAMES,
  discoverConfig,
  loadConfig,
} from "../src/index.js";

const temporaryDirectories: string[] = [];

async function temporaryProject(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "statecraft-cli-"));
  temporaryDirectories.push(directory);
  return directory;
}

async function writeConfig(
  directory: string,
  filename = "statecraft.config.mjs",
  source = `export default {
    baseURL: "http://localhost:3000",
    routes: [{
      id: "dashboard",
      path: "/dashboard",
      states: [{ id: "success", setup: "./scenarios/success.mjs" }]
    }],
    themes: ["light"],
    viewports: { desktop: { height: 900, width: 1440 } }
  };`,
): Promise<string> {
  const configPath = join(directory, filename);
  await writeFile(configPath, source, "utf8");
  return configPath;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { force: true, recursive: true }),
    ),
  );
});

describe("discoverConfig", () => {
  it("returns the canonical path for one default config", async () => {
    const project = await temporaryProject();
    const configPath = await writeConfig(project, "statecraft.config.ts");

    await expect(discoverConfig({ cwd: project })).resolves.toBe(
      await realpath(configPath),
    );
  });

  it("resolves an explicit config path relative to the search root", async () => {
    const project = await temporaryProject();
    const configDirectory = join(project, "config");
    await mkdir(configDirectory);
    const configPath = await writeConfig(configDirectory, "custom.mjs");

    await expect(
      discoverConfig({ configPath: "config/custom.mjs", cwd: project }),
    ).resolves.toBe(await realpath(configPath));
  });

  it("does not require cwd when the explicit config path is absolute", async () => {
    const project = await temporaryProject();
    const configPath = await writeConfig(project, "custom.mjs");

    await expect(
      discoverConfig({
        configPath,
        cwd: join(project, "missing-root"),
      }),
    ).resolves.toBe(await realpath(configPath));
  });

  it.skipIf(process.platform === "win32")(
    "resolves explicit parent segments from the caller-supplied symlink path",
    async () => {
      const project = await temporaryProject();
      const linksDirectory = join(project, "links");
      const targetDirectory = join(project, "targets", "deep", "project");
      const configDirectory = join(project, "outside");
      await mkdir(linksDirectory);
      await mkdir(targetDirectory, { recursive: true });
      await mkdir(configDirectory);
      const configPath = await writeConfig(configDirectory, "custom.mjs");
      const linkedRoot = join(linksDirectory, "project");
      await symlink(targetDirectory, linkedRoot, "dir");

      await expect(
        discoverConfig({ configPath: "../../outside/custom.mjs", cwd: linkedRoot }),
      ).resolves.toBe(await realpath(configPath));
    },
  );

  it("reports all supported candidates when no config exists", async () => {
    const project = await temporaryProject();

    const error = await discoverConfig({ cwd: project }).catch(
      (cause: unknown) => cause,
    );

    expect(error).toBeInstanceOf(ConfigDiscoveryError);
    expect(error).toMatchObject({ code: "CONFIG_NOT_FOUND" });
    const canonicalProject = await realpath(project);
    expect((error as ConfigDiscoveryError).candidates).toEqual(
      DEFAULT_CONFIG_FILENAMES.map((filename) =>
        join(canonicalProject, filename),
      ),
    );
  });

  it("requires an explicit path when multiple default configs exist", async () => {
    const project = await temporaryProject();
    const first = await writeConfig(project, "statecraft.config.mjs");
    const second = await writeConfig(project, "statecraft.config.cjs");

    const error = await discoverConfig({ cwd: project }).catch(
      (cause: unknown) => cause,
    );

    expect(error).toBeInstanceOf(ConfigDiscoveryError);
    expect(error).toMatchObject({ code: "CONFIG_AMBIGUOUS" });
    expect((error as ConfigDiscoveryError).candidates).toEqual(
      [await realpath(first), await realpath(second)].sort(),
    );
  });

  it("rejects missing explicit paths and non-file candidates", async () => {
    const project = await temporaryProject();
    await mkdir(join(project, "statecraft.config.ts"));

    await expect(
      discoverConfig({ configPath: "missing.mjs", cwd: project }),
    ).rejects.toMatchObject({ code: "CONFIG_PATH_INVALID" });
    await expect(discoverConfig({ cwd: project })).rejects.toMatchObject({
      code: "CONFIG_PATH_INVALID",
    });
  });

  it("rejects a missing or non-directory search root", async () => {
    const project = await temporaryProject();
    const filePath = join(project, "not-a-directory");
    await writeFile(filePath, "not a directory", "utf8");

    await expect(
      discoverConfig({ cwd: join(project, "missing") }),
    ).rejects.toMatchObject({ code: "CONFIG_ROOT_INVALID" });
    await expect(discoverConfig({ cwd: filePath })).rejects.toMatchObject({
      code: "CONFIG_ROOT_INVALID",
    });
  });

  it.skipIf(process.platform === "win32")(
    "rejects unreadable default and explicit config files during discovery",
    async () => {
      const project = await temporaryProject();
      const configPath = await writeConfig(project);
      await chmod(configPath, 0o000);

      await expect(discoverConfig({ cwd: project })).rejects.toMatchObject({
        code: "CONFIG_PATH_INVALID",
      });
      await expect(
        discoverConfig({ configPath, cwd: project }),
      ).rejects.toMatchObject({ code: "CONFIG_PATH_INVALID" });
    },
  );

  it.skipIf(process.platform === "win32")(
    "classifies an unreadable search root before checking candidates",
    async () => {
      const project = await temporaryProject();
      await chmod(project, 0o000);

      try {
        await expect(discoverConfig({ cwd: project })).rejects.toMatchObject({
          code: "CONFIG_ROOT_INVALID",
          configPath: project,
        });
      } finally {
        await chmod(project, 0o700);
      }
    },
  );
});

describe("loadConfig", () => {
  it("imports a default export and validates it through core", async () => {
    const project = await temporaryProject();
    const configPath = await writeConfig(project, "statecraft.config.ts");

    await expect(loadConfig({ cwd: project })).resolves.toEqual({
      config: {
        baseURL: "http://localhost:3000",
        routes: [
          {
            id: "dashboard",
            path: "/dashboard",
            states: [
              { id: "success", setup: "./scenarios/success.mjs" },
            ],
          },
        ],
        themes: ["light"],
        viewports: { desktop: { height: 900, width: 1440 } },
      },
      path: await realpath(configPath),
    });
  });

  it("loads a CommonJS config through the same validation boundary", async () => {
    const project = await temporaryProject();
    await writeConfig(
      project,
      "statecraft.config.cjs",
      `module.exports = {
        baseURL: "http://localhost:3000",
        routes: [{
          id: "dashboard",
          path: "/dashboard",
          states: [{ id: "success", setup: "./scenarios/success.cjs" }]
        }],
        themes: ["light"],
        viewports: { desktop: { height: 900, width: 1440 } }
      };`,
    );

    await expect(loadConfig({ cwd: project })).resolves.toMatchObject({
      config: { baseURL: "http://localhost:3000" },
    });
  });

  it("preserves core validation errors for invalid config values", async () => {
    const project = await temporaryProject();
    await writeConfig(project, "statecraft.config.mjs", "export default {};");

    await expect(loadConfig({ cwd: project })).rejects.toBeInstanceOf(
      ConfigValidationError,
    );
  });

  it("rejects modules without a default export", async () => {
    const project = await temporaryProject();
    await writeConfig(
      project,
      "statecraft.config.mjs",
      "export const config = {};",
    );

    await expect(loadConfig({ cwd: project })).rejects.toMatchObject({
      code: "CONFIG_DEFAULT_EXPORT_MISSING",
    });
  });

  it("wraps module execution failures with the config path and cause", async () => {
    const project = await temporaryProject();
    const configPath = await writeConfig(
      project,
      "statecraft.config.mjs",
      'throw new Error("fixture exploded");',
    );

    const error = await loadConfig({ cwd: project }).catch(
      (cause: unknown) => cause,
    );

    expect(error).toBeInstanceOf(ConfigLoadError);
    expect(error).toMatchObject({
      code: "CONFIG_IMPORT_FAILED",
      configPath: await realpath(configPath),
    });
    expect((error as ConfigLoadError).cause).toMatchObject({
      message: "fixture exploded",
    });
  });
});

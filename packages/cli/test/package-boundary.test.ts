import { execFile } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);

interface PackageManifest {
  exports?: {
    "."?: {
      import?: string;
      types?: string;
    };
  };
  name?: string;
  private?: boolean;
  type?: string;
}

describe("@statecraft/cli package boundary", () => {
  it("defines a private ESM build with deterministic dist paths", async () => {
    const manifestUrl = new URL("../package.json", import.meta.url);
    const contents = await readFile(manifestUrl, "utf8");
    const manifest = JSON.parse(contents) as PackageManifest;

    expect(manifest).toMatchObject({
      name: "@statecraft/cli",
      private: true,
      type: "module",
      exports: {
        ".": {
          import: "./dist/index.js",
          types: "./dist/index.d.ts",
        },
      },
    });

    const importPath = manifest.exports?.["."]?.import;
    const typesPath = manifest.exports?.["."]?.types;
    expect(importPath).toBeDefined();
    expect(typesPath).toBeDefined();

    const packageRoot = new URL("../", import.meta.url);
    const importUrl = new URL(importPath ?? "", packageRoot);
    const typesUrl = new URL(typesPath ?? "", packageRoot);
    await expect(access(typesUrl)).resolves.toBeUndefined();
    const builtModule = await import(importUrl.href);
    expect(Object.keys(builtModule).sort()).toEqual([
      "ConfigDiscoveryError",
      "ConfigLoadError",
      "DEFAULT_CONFIG_FILENAMES",
      "discoverConfig",
      "loadConfig",
    ]);
  });

  it("compiles the documented public API through the package export", async () => {
    const typeScriptCli = require.resolve("typescript/bin/tsc");
    const typeContractConfig = fileURLToPath(
      new URL("../test-d/tsconfig.json", import.meta.url),
    );

    await expect(
      execFileAsync(process.execPath, [typeScriptCli, "-p", typeContractConfig]),
    ).resolves.toMatchObject({ stderr: "", stdout: "" });
  });
});

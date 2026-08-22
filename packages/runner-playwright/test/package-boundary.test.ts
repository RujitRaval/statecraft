import { execFile } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);

interface PackageManifest {
  dependencies?: Record<string, string>;
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

describe("statecraft-ui-runner-playwright package boundary", () => {
  it("defines a publishable ESM build with pinned runtime dependencies", async () => {
    const manifestUrl = new URL("../package.json", import.meta.url);
    const contents = await readFile(manifestUrl, "utf8");
    const manifest = JSON.parse(contents) as PackageManifest;

    expect(manifest).toMatchObject({
      dependencies: {
        "statecraft-ui-core": "workspace:*",
        "statecraft-ui-report": "workspace:*",
        playwright: "1.62.1",
      },
      name: "statecraft-ui-runner-playwright",
      type: "module",
      exports: {
        ".": {
          import: "./dist/index.js",
          types: "./dist/index.d.ts",
        },
      },
    });
    expect(manifest.private).toBeUndefined();

    const importPath = manifest.exports?.["."]?.import;
    const typesPath = manifest.exports?.["."]?.types;
    expect(importPath).toBeDefined();
    expect(typesPath).toBeDefined();

    const packageRoot = new URL("../", import.meta.url);
    const importUrl = new URL(importPath ?? "", packageRoot);
    const typesUrl = new URL(typesPath ?? "", packageRoot);
    await expect(access(typesUrl)).resolves.toBeUndefined();
    const builtModule = await import(importUrl.href);
    expect(Object.keys(builtModule)).toEqual([
      "discoverPublicRoutes",
      "PublicRouteDiscoveryError",
      "runExecutionCells",
      "runCapturedScenarioCells",
      "ScenarioCaptureError",
      "runPersistedScenarioCells",
      "loadScenario",
      "runScenarioCells",
      "runScenarioLifecycle",
      "ScenarioLoadError",
      "runNavigatedScenarioCells",
    ]);
  });

  it(
    "compiles the documented public API through the package export",
    async () => {
      const typeScriptCli = require.resolve("typescript/bin/tsc");
      const typeContractConfig = fileURLToPath(
        new URL("../test-d/tsconfig.json", import.meta.url),
      );

      await expect(
        execFileAsync(process.execPath, [typeScriptCli, "-p", typeContractConfig]),
      ).resolves.toMatchObject({ stderr: "", stdout: "" });
    },
    15_000,
  );
});

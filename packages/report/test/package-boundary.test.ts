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

describe("@statecraft/report package boundary", () => {
  it("defines a private ESM build with a small documented API", async () => {
    const manifestUrl = new URL("../package.json", import.meta.url);
    const manifest = JSON.parse(
      await readFile(manifestUrl, "utf8"),
    ) as PackageManifest;

    expect(manifest).toMatchObject({
      name: "@statecraft/report",
      private: true,
      type: "module",
      exports: {
        ".": {
          import: "./dist/index.js",
          types: "./dist/index.d.ts",
        },
      },
    });

    const packageRoot = new URL("../", import.meta.url);
    const importUrl = new URL(manifest.exports?.["."]?.import ?? "", packageRoot);
    const typesUrl = new URL(manifest.exports?.["."]?.types ?? "", packageRoot);
    await expect(access(typesUrl)).resolves.toBeUndefined();
    const module = await import(importUrl.href);
    expect(Object.keys(module).sort()).toEqual([
      "REPORT_HTML_PATH",
      "renderReportHtml",
      "transformReport",
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

import { access, readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

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
});

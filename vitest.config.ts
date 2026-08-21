import { fileURLToPath } from "node:url";

import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "server-only": fileURLToPath(new URL("./apps/example-nextjs/test/server-only.ts", import.meta.url)),
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          exclude: [
            ...configDefaults.exclude,
            "apps/example-nextjs/test/scenario-matrix.test.ts",
          ],
          include: ["apps/**/*.test.ts", "packages/**/*.test.ts"],
          name: "workspace",
          sequence: { groupOrder: 0 },
        },
      },
      {
        extends: true,
        test: {
          fileParallelism: false,
          include: ["apps/example-nextjs/test/scenario-matrix.test.ts"],
          name: "example-scenario-matrix",
          sequence: { groupOrder: 1 },
        },
      },
    ],
  },
});

import { expandMatrix } from "statecraft-ui-core";
import { describe, expect, it } from "vitest";

describe("example Statecraft config", () => {
  it("defaults to the documented local server and complete matrix", async () => {
    const environmentName = "STATECRAFT_EXAMPLE_BASE_URL";
    const previousBaseURL = process.env[environmentName];

    try {
      delete process.env[environmentName];
      const { default: config } = await import("../statecraft.config");

      expect(config.baseURL).toBe("http://127.0.0.1:3000");
      expect(expandMatrix(config)).toHaveLength(60);
    } finally {
      if (previousBaseURL === undefined) {
        delete process.env[environmentName];
      } else {
        process.env[environmentName] = previousBaseURL;
      }
    }
  });
});

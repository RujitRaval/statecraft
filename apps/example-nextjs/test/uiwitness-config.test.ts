import { expandMatrix } from "uiwitness-core";
import { describe, expect, it } from "vitest";

describe("example UIWitness config", () => {
  it("defaults to the documented local server and complete matrix", async () => {
    const environmentName = "UIWITNESS_EXAMPLE_BASE_URL";
    const previousBaseURL = process.env[environmentName];

    try {
      delete process.env[environmentName];
      const { default: config } = await import("../uiwitness.config");

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

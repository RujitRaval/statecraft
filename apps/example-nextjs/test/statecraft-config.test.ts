import { expandMatrix } from "@statecraft/core";
import { describe, expect, it } from "vitest";

import config from "../statecraft.config";

describe("example Statecraft config", () => {
  it("defaults to the documented local server and complete matrix", () => {
    expect(config.baseURL).toBe("http://127.0.0.1:3000");
    expect(expandMatrix(config)).toHaveLength(60);
  });
});

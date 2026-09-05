import { describe, expect, it } from "vitest";

import { contractExceptionLifecycle } from "../src/index.js";

describe("contract exception lifecycle", () => {
  it.each([
    ["2026-09-29", { daysUntilExpiry: 1, status: "active" }],
    ["2026-09-30", { daysUntilExpiry: 0, status: "active" }],
    ["2026-10-01", { daysUntilExpiry: -1, status: "expired" }],
  ] as const)("derives UTC active-through-expiry semantics on %s", (evaluatedOn, expected) => {
    expect(contractExceptionLifecycle({ expiresOn: "2026-09-30" }, evaluatedOn)).toEqual(expected);
  });

  it.each(["2026-02-30", "not-a-date", "0000-01-01"])(
    "rejects an invalid evaluation date %s",
    (evaluatedOn) => {
      expect(() => contractExceptionLifecycle({ expiresOn: "2026-09-30" }, evaluatedOn))
        .toThrow(RangeError);
    },
  );

  it.each(["2026-02-30", "not-a-date", "0000-01-01"])(
    "rejects an invalid expiry date %s",
    (expiresOn) => {
      expect(() => contractExceptionLifecycle({ expiresOn }, "2026-09-05"))
        .toThrow(RangeError);
    },
  );
});

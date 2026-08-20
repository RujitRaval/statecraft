import { describe, expect, it } from "vitest";

import {
  formatOrderAmount,
  ordersContentState,
  ordersData,
  parseOrdersData,
  summarizeOrders,
} from "../lib/orders";

describe("orders fixture contract", () => {
  it("keeps the default payload deterministic and successful", () => {
    const parsed = parseOrdersData(structuredClone(ordersData));

    expect(parsed).toEqual(ordersData);
    expect(ordersContentState(parsed)).toBe("success");
    expect(summarizeOrders(parsed.orders)).toEqual({
      atRisk: 2,
      ready: 2,
      total: 8,
      valueCents: 907190,
    });
    expect(formatOrderAmount(907190)).toBe("$9,071.90");
  });

  it("classifies a valid no-data response as empty", () => {
    const empty = parseOrdersData({ orders: [], updatedAt: "20 Aug 2026 · 14:32 EDT" });

    expect(ordersContentState(empty)).toBe("empty");
    expect(summarizeOrders(empty.orders)).toEqual({ atRisk: 0, ready: 0, total: 0, valueCents: 0 });
  });

  it.each([
    null,
    {},
    { ...ordersData, updatedAt: "" },
    { ...ordersData, orders: [ordersData.orders[0], ordersData.orders[0]] },
    { ...ordersData, orders: [{ ...ordersData.orders[0], status: "Unknown" }] },
    { ...ordersData, orders: [{ ...ordersData.orders[0], amountCents: Number.POSITIVE_INFINITY }] },
    { ...ordersData, orders: [{ ...ordersData.orders[0], amountCents: -1 }] },
    { ...ordersData, orders: [{ ...ordersData.orders[0], itemCount: 0 }] },
    { ...ordersData, orders: [{ ...ordersData.orders[0], customer: " " }] },
    {
      ...ordersData,
      orders: [
        { ...ordersData.orders[0], amountCents: Number.MAX_SAFE_INTEGER, id: "NL-MAX-1" },
        { ...ordersData.orders[1], amountCents: Number.MAX_SAFE_INTEGER, id: "NL-MAX-2" },
      ],
    },
  ])("rejects malformed API payload %#", (payload) => {
    expect(() => parseOrdersData(payload)).toThrow(
      /Orders response (must be an object|does not match)/,
    );
  });
});

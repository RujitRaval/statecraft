import { describe, expect, it } from "vitest";

import {
  formatCustomerAmount,
  parseCustomerData,
} from "../lib/customer-contract";
import { customerData, longCustomerData } from "../lib/customers";

describe("customer fixture contract", () => {
  it("keeps the default customer deterministic", () => {
    const parsed = parseCustomerData(structuredClone(customerData));

    expect(parsed).toEqual(customerData);
    expect(parsed.metrics).toEqual({
      atRiskOrders: 1,
      lifetimeValueCents: 4_287_600,
      openOrders: 3,
      orderCount: 86,
    });
    expect(formatCustomerAmount(parsed.metrics.lifetimeValueCents)).toBe("$42,876");
    expect(formatCustomerAmount(18_750)).toBe("$187.50");
  });

  it("accepts long content through the same production contract", () => {
    const parsed = parseCustomerData(structuredClone(longCustomerData));

    expect(parsed.name.length).toBeGreaterThan(60);
    expect(parsed.primaryContact.role.length).toBeGreaterThan(80);
    expect(parsed.note.body.length).toBeGreaterThan(400);
  });

  it.each([
    null,
    {},
    { ...customerData, name: " " },
    { ...customerData, deliveryAddress: [] },
    { ...customerData, deliveryAddress: [""] },
    { ...customerData, status: "Archived" },
    { ...customerData, primaryContact: { ...customerData.primaryContact, email: "" } },
    { ...customerData, metrics: { ...customerData.metrics, lifetimeValueCents: -1 } },
    { ...customerData, metrics: { ...customerData.metrics, openOrders: 87 } },
    { ...customerData, metrics: { ...customerData.metrics, atRiskOrders: 4 } },
    { ...customerData, metrics: { ...customerData.metrics, orderCount: 2 } },
    { ...customerData, metrics: { ...customerData.metrics, openOrders: 1 } },
    { ...customerData, metrics: { ...customerData.metrics, orderCount: Number.MAX_SAFE_INTEGER + 1 } },
    { ...customerData, recentOrders: [customerData.recentOrders[0], customerData.recentOrders[0]] },
    { ...customerData, recentOrders: [{ ...customerData.recentOrders[0], status: "Unknown" }] },
    { ...customerData, activities: [customerData.activities[0], customerData.activities[0]] },
  ])("rejects malformed customer payload %#", (payload) => {
    expect(() => parseCustomerData(payload)).toThrow(
      /Customer response (must be an object|does not match)/,
    );
  });
});

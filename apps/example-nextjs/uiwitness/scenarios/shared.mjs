export const longCustomerFixture = Object.freeze({
  accountOwner: "Mara Chen",
  activities: [
    {
      detail: "Carrier appointment moved forward after the East dock cleared, but the receiving team asked Northline to preserve a detailed handoff covering pallet sequence, temperature-sensitive display materials, store-allocation labels, and the contingency route for every replenishment location across the northeastern regional network.",
      id: "activity-1048-3",
      occurredAt: "Today · 13:18 EDT",
      title: "Dispatch window improved for the multi-location autumn retail replenishment programme",
    },
    {
      detail: "Priya confirmed the autumn replenishment forecast for the Boston and Providence stores.",
      id: "activity-1048-2",
      occurredAt: "19 Aug · 16:42 EDT",
      title: "Forecast confirmed",
    },
    {
      detail: "Account moved to Northline Priority after twelve consecutive on-time wholesale deliveries.",
      id: "activity-1048-1",
      occurredAt: "12 Aug · 09:10 EDT",
      title: "Service tier advanced",
    },
  ],
  deliveryAddress: [
    "Northline receiving entrance behind the Harbor Exchange distribution campus",
    "Building Twelve, Mezzanine Three, Attention: Regional Merchandising Operations and Inventory Planning",
    "Boston, Massachusetts 02210-2408",
  ],
  deliveryWindow: "Weekdays · 08:00–14:00 EDT",
  id: "cus-1048",
  joinedAt: "Partner since March 2023",
  metrics: {
    atRiskOrders: 1,
    lifetimeValueCents: 4_287_600,
    openOrders: 3,
    orderCount: 86,
  },
  name: "Lumen Supply Company and Northeast Independent Retail Cooperative",
  note: {
    author: "Mara Chen",
    body: "Prioritize split shipments whenever the Boston receiving window is at risk, and include a location-by-location carton manifest for every storefront. The customer would rather receive core inventory early than hold the full order for one delayed line, provided the advance shipment includes installation hardware, merchandising instructions, replacement labels, and a named escalation contact for each destination. Preserve the final delivery sequence in the dispatch note so the overnight receiving team can reconcile partial arrivals without contacting the account owner.",
    title: "Fulfillment, receiving, merchandising, and escalation preferences for regional replenishment",
    updatedAt: "Updated 19 Aug · 16:48 EDT",
  },
  primaryContact: {
    email: "priya.nanduri+regional-merchandising-operations@lumensupply.example",
    name: "Priya Nanduri-Sutherland, Northeast Regional Purchasing and Merchandising Operations",
    phone: "+1 617 555 0148",
    role: "Executive director of purchasing, inventory planning, store allocation, and seasonal merchandising operations",
  },
  recentOrders: [
    {
      amountCents: 284_000,
      id: "NL-4821",
      inLiveQueue: true,
      placedAt: "20 Aug · 12:42",
      status: "At risk",
    },
    {
      amountCents: 176_400,
      id: "NL-4796",
      inLiveQueue: false,
      placedAt: "18 Aug · 09:16",
      status: "In transit",
    },
    {
      amountCents: 93_200,
      id: "NL-4738",
      inLiveQueue: false,
      placedAt: "12 Aug · 15:04",
      status: "Delivered",
    },
  ],
  region: "Boston · East",
  status: "Active",
  tier: "Northline Priority · Multi-location wholesale and independent retail cooperative",
  updatedAt: "20 Aug 2026 · 14:32 EDT",
  warehouse: "East warehouse · Dock 04",
});

export function holdRequest() {
  return new Promise(() => undefined);
}

export async function fulfillJson(route, status, body) {
  await route.fulfill({
    body: JSON.stringify(body),
    contentType: "application/json",
    status,
  });
}

export async function waitForProductState(page, attribute, state) {
  await page.locator(`[${attribute}="${state}"]`).waitFor({ timeout: 5_000 });
}

export async function assertVisibleProductState(page, attribute, state) {
  const visible = await page.locator(`[${attribute}="${state}"]`).isVisible();
  if (!visible) {
    throw new Error(`Expected ${state} product state to be visible.`);
  }
}

export async function assertForegroundContrast(page, selector) {
  const palette = await page.locator(selector).evaluate((element) => {
    const view = element.ownerDocument.defaultView;
    if (view === null) throw new Error("Element has no browser window.");
    const style = view.getComputedStyle(element);
    return { backgroundColor: style.backgroundColor, color: style.color };
  });
  if (palette.color === palette.backgroundColor) {
    throw new Error(
      `Expected ${selector} foreground to contrast with its background.`,
    );
  }
}

export async function assertNoHorizontalOverflow(page) {
  const overflow = await page.evaluate(
    () => globalThis.document.documentElement.scrollWidth - globalThis.innerWidth,
  );
  if (overflow > 0) {
    throw new Error(
      `Expected the document to fit the viewport; horizontal overflow was ${overflow}px.`,
    );
  }
}

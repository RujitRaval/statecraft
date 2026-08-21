import "server-only";

import type { CustomerData } from "./customer-contract";

export const customerData = {
  accountOwner: "Mara Chen",
  activities: [
    {
      detail: "Carrier appointment moved forward by ninety minutes after the East dock cleared.",
      id: "activity-1048-3",
      occurredAt: "Today · 13:18 EDT",
      title: "Dispatch window improved",
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
  deliveryAddress: ["44 Drydock Avenue", "Floor 3", "Boston, MA 02210"],
  deliveryWindow: "Weekdays · 08:00–14:00 EDT",
  id: "cus-1048",
  joinedAt: "Partner since March 2023",
  metrics: {
    atRiskOrders: 1,
    lifetimeValueCents: 4287600,
    openOrders: 3,
    orderCount: 86,
  },
  name: "Lumen Supply Co.",
  note: {
    author: "Mara Chen",
    body: "Prioritize split shipments when the Boston receiving window is at risk. The customer would rather receive core inventory early than hold the full order for one delayed line.",
    title: "Fulfillment preference",
    updatedAt: "Updated 19 Aug · 16:48 EDT",
  },
  primaryContact: {
    email: "priya@lumensupply.example",
    name: "Priya Nanduri",
    phone: "+1 617 555 0148",
    role: "Director of purchasing",
  },
  recentOrders: [
    { amountCents: 284000, id: "NL-4821", placedAt: "20 Aug · 12:42", status: "Processing" },
    { amountCents: 176400, id: "NL-4796", placedAt: "18 Aug · 09:16", status: "In transit" },
    { amountCents: 93200, id: "NL-4738", placedAt: "12 Aug · 15:04", status: "Delivered" },
  ],
  region: "Boston · East",
  status: "Active",
  tier: "Northline Priority · Wholesale",
  updatedAt: "20 Aug 2026 · 14:32 EDT",
  warehouse: "East warehouse · Dock 04",
} as const satisfies CustomerData;

export const longCustomerData = {
  ...customerData,
  activities: [
    {
      ...customerData.activities[0],
      detail: "Carrier appointment moved forward after the East dock cleared, but the receiving team asked Northline to preserve a detailed handoff covering pallet sequence, temperature-sensitive display materials, store-allocation labels, and the contingency route for every replenishment location across the northeastern regional network.",
      title: "Dispatch window improved for the multi-location autumn retail replenishment programme",
    },
    ...customerData.activities.slice(1),
  ],
  deliveryAddress: [
    "Northline receiving entrance behind the Harbor Exchange distribution campus",
    "Building Twelve, Mezzanine Three, Attention: Regional Merchandising Operations and Inventory Planning",
    "Boston, Massachusetts 02210-2408",
  ],
  id: "cus-long-content",
  name: "Lumen Supply Company and Northeast Independent Retail Cooperative",
  note: {
    ...customerData.note,
    body: "Prioritize split shipments whenever the Boston receiving window is at risk, and include a location-by-location carton manifest for every storefront. The customer would rather receive core inventory early than hold the full order for one delayed line, provided the advance shipment includes installation hardware, merchandising instructions, replacement labels, and a named escalation contact for each destination. Preserve the final delivery sequence in the dispatch note so the overnight receiving team can reconcile partial arrivals without contacting the account owner.",
    title: "Fulfillment, receiving, merchandising, and escalation preferences for regional replenishment",
  },
  primaryContact: {
    ...customerData.primaryContact,
    email: "priya.nanduri+regional-merchandising-operations@lumensupply.example",
    name: "Priya Nanduri-Sutherland, Northeast Regional Purchasing and Merchandising Operations",
    role: "Executive director of purchasing, inventory planning, store allocation, and seasonal merchandising operations",
  },
  tier: "Northline Priority · Multi-location wholesale and independent retail cooperative",
} as const satisfies CustomerData;

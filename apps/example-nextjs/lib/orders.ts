export const orderStatuses = ["At risk", "Processing", "Ready", "In transit", "Delivered"] as const;

export type OrderStatus = (typeof orderStatuses)[number];

export interface OrderRecord {
  readonly amountCents: number;
  readonly channel: string;
  readonly customer: string;
  readonly id: string;
  readonly itemCount: number;
  readonly placedAt: string;
  readonly promise: string;
  readonly region: string;
  readonly status: OrderStatus;
}

export interface OrdersData {
  readonly orders: readonly OrderRecord[];
  readonly updatedAt: string;
}

export interface OrdersSummary {
  readonly atRisk: number;
  readonly ready: number;
  readonly total: number;
  readonly valueCents: number;
}

export const ordersData = {
  orders: [
    {
      amountCents: 284000,
      channel: "Wholesale",
      customer: "Lumen Supply Co.",
      id: "NL-4821",
      itemCount: 12,
      placedAt: "12:42 EDT",
      promise: "Today · 16:30",
      region: "Boston · East",
      status: "At risk",
    },
    {
      amountCents: 18750,
      channel: "Online",
      customer: "Aster & Field",
      id: "NL-4820",
      itemCount: 3,
      placedAt: "12:18 EDT",
      promise: "Today · 18:00",
      region: "Denver · Mountain",
      status: "Ready",
    },
    {
      amountCents: 126800,
      channel: "Retail",
      customer: "Common Thread Market",
      id: "NL-4819",
      itemCount: 8,
      placedAt: "11:54 EDT",
      promise: "21 Aug · 12:00",
      region: "Austin · Central",
      status: "Processing",
    },
    {
      amountCents: 49200,
      channel: "Online",
      customer: "Morrow House",
      id: "NL-4818",
      itemCount: 4,
      placedAt: "11:31 EDT",
      promise: "21 Aug · 14:00",
      region: "Portland · West",
      status: "In transit",
    },
    {
      amountCents: 316500,
      channel: "Wholesale",
      customer: "Harbor Standard",
      id: "NL-4817",
      itemCount: 18,
      placedAt: "10:46 EDT",
      promise: "Today · 16:30",
      region: "New York · East",
      status: "At risk",
    },
    {
      amountCents: 7640,
      channel: "Online",
      customer: "Juniper Studio",
      id: "NL-4816",
      itemCount: 1,
      placedAt: "10:22 EDT",
      promise: "21 Aug · 18:00",
      region: "Savannah · East",
      status: "Ready",
    },
    {
      amountCents: 88900,
      channel: "Retail",
      customer: "North & Pine",
      id: "NL-4815",
      itemCount: 6,
      placedAt: "09:57 EDT",
      promise: "22 Aug · 12:00",
      region: "Chicago · Central",
      status: "Processing",
    },
    {
      amountCents: 15400,
      channel: "Online",
      customer: "Daybreak Goods",
      id: "NL-4814",
      itemCount: 2,
      placedAt: "09:18 EDT",
      promise: "Delivered · 11:08",
      region: "Richmond · East",
      status: "Delivered",
    },
  ],
  updatedAt: "20 Aug 2026 · 14:32 EDT",
} as const satisfies OrdersData;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === "string" && orderStatuses.includes(value as OrderStatus);
}

function isOrderRecord(value: unknown): value is OrderRecord {
  if (!isRecord(value)) return false;
  return (
    Number.isSafeInteger(value["amountCents"]) &&
    (value["amountCents"] as number) >= 0 &&
    isNonEmptyString(value["channel"]) &&
    isNonEmptyString(value["customer"]) &&
    isNonEmptyString(value["id"]) &&
    Number.isSafeInteger(value["itemCount"]) &&
    (value["itemCount"] as number) > 0 &&
    isNonEmptyString(value["placedAt"]) &&
    isNonEmptyString(value["promise"]) &&
    isNonEmptyString(value["region"]) &&
    isOrderStatus(value["status"])
  );
}

function hasSafeOrderTotal(orders: readonly OrderRecord[]): boolean {
  let total = 0;
  for (const order of orders) {
    total += order.amountCents;
    if (!Number.isSafeInteger(total)) return false;
  }
  return true;
}

export function parseOrdersData(value: unknown): OrdersData {
  if (!isRecord(value)) throw new Error("Orders response must be an object.");
  const orders = value["orders"];
  const updatedAt = value["updatedAt"];
  if (!Array.isArray(orders) || !orders.every(isOrderRecord) || !isNonEmptyString(updatedAt)) {
    throw new Error("Orders response does not match the expected contract.");
  }
  if (
    new Set(orders.map((order) => order.id)).size !== orders.length ||
    !hasSafeOrderTotal(orders)
  ) {
    throw new Error("Orders response does not match the expected contract.");
  }
  return { orders, updatedAt };
}

export function ordersContentState(data: OrdersData): "empty" | "success" {
  return data.orders.length === 0 ? "empty" : "success";
}

export function summarizeOrders(orders: readonly OrderRecord[]): OrdersSummary {
  return orders.reduce<OrdersSummary>(
    (summary, order) => ({
      atRisk: summary.atRisk + (order.status === "At risk" ? 1 : 0),
      ready: summary.ready + (order.status === "Ready" ? 1 : 0),
      total: summary.total + 1,
      valueCents: summary.valueCents + order.amountCents,
    }),
    { atRisk: 0, ready: 0, total: 0, valueCents: 0 },
  );
}

export function formatOrderAmount(amountCents: number): string {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: "currency",
  }).format(amountCents / 100);
}

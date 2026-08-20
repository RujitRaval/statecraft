export interface DashboardMetric {
  readonly change: string;
  readonly direction: "down" | "neutral" | "up";
  readonly id: string;
  readonly label: string;
  readonly note: string;
  readonly value: string;
}

export interface DashboardOrder {
  readonly amount: string;
  readonly customer: string;
  readonly id: string;
  readonly region: string;
  readonly status: "At risk" | "In transit" | "Ready";
}

export interface DashboardData {
  readonly metrics: readonly DashboardMetric[];
  readonly orders: readonly DashboardOrder[];
  readonly pulse: readonly number[];
  readonly summary: {
    readonly atRisk: number;
    readonly fulfilledToday: number;
    readonly nextDispatch: string;
  };
}

export const dashboardData: DashboardData = {
  metrics: [
    {
      change: "+18.4%",
      direction: "up",
      id: "gross-volume",
      label: "Gross volume",
      note: "vs. prior 30 days",
      value: "$284,912",
    },
    {
      change: "+7.2%",
      direction: "up",
      id: "orders",
      label: "Orders",
      note: "1.4 items per order",
      value: "1,248",
    },
    {
      change: "−1.8%",
      direction: "down",
      id: "fulfillment",
      label: "Fulfillment",
      note: "target 95%",
      value: "92.6%",
    },
    {
      change: "+3.1%",
      direction: "up",
      id: "repeat-rate",
      label: "Repeat rate",
      note: "476 returning customers",
      value: "38.2%",
    },
  ],
  orders: [
    {
      amount: "$428.00",
      customer: "Lena Moreau",
      id: "NL-4821",
      region: "Montréal, QC",
      status: "Ready",
    },
    {
      amount: "$186.50",
      customer: "Amara Okafor",
      id: "NL-4819",
      region: "Austin, TX",
      status: "At risk",
    },
    {
      amount: "$712.00",
      customer: "Yuto Tanaka",
      id: "NL-4816",
      region: "Portland, OR",
      status: "In transit",
    },
    {
      amount: "$94.00",
      customer: "Sofia Alvarez",
      id: "NL-4813",
      region: "Miami, FL",
      status: "Ready",
    },
  ],
  pulse: [42, 48, 45, 57, 53, 64, 61, 72, 68, 78, 75, 88],
  summary: {
    atRisk: 12,
    fulfilledToday: 148,
    nextDispatch: "16:30 EDT",
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isMetric(value: unknown): value is DashboardMetric {
  if (!isRecord(value)) return false;
  return (
    typeof value["change"] === "string" &&
    (value["direction"] === "down" ||
      value["direction"] === "neutral" ||
      value["direction"] === "up") &&
    typeof value["id"] === "string" &&
    typeof value["label"] === "string" &&
    typeof value["note"] === "string" &&
    typeof value["value"] === "string"
  );
}

function isOrder(value: unknown): value is DashboardOrder {
  if (!isRecord(value)) return false;
  return (
    typeof value["amount"] === "string" &&
    typeof value["customer"] === "string" &&
    typeof value["id"] === "string" &&
    typeof value["region"] === "string" &&
    (value["status"] === "At risk" ||
      value["status"] === "In transit" ||
      value["status"] === "Ready")
  );
}

function hasUniqueIds(values: readonly { readonly id: string }[]): boolean {
  return new Set(values.map((value) => value.id)).size === values.length;
}

export function parseDashboardData(value: unknown): DashboardData {
  if (!isRecord(value)) throw new Error("Dashboard response must be an object.");
  const metrics = value["metrics"];
  const orders = value["orders"];
  const pulse = value["pulse"];
  const summary = value["summary"];
  if (
    !Array.isArray(metrics) ||
    !metrics.every(isMetric) ||
    !Array.isArray(orders) ||
    !orders.every(isOrder) ||
    !Array.isArray(pulse) ||
    !pulse.every((point) => typeof point === "number" && Number.isFinite(point)) ||
    !isRecord(summary) ||
    typeof summary["atRisk"] !== "number" ||
    typeof summary["fulfilledToday"] !== "number" ||
    typeof summary["nextDispatch"] !== "string"
  ) {
    throw new Error("Dashboard response does not match the expected contract.");
  }
  const hasNoContent = metrics.length === 0 && orders.length === 0;
  if (
    !hasUniqueIds(metrics) ||
    !hasUniqueIds(orders) ||
    (pulse.length !== 12 && !(hasNoContent && pulse.length === 0))
  ) {
    throw new Error("Dashboard response does not match the expected contract.");
  }
  return {
    metrics,
    orders,
    pulse,
    summary: {
      atRisk: summary["atRisk"],
      fulfilledToday: summary["fulfilledToday"],
      nextDispatch: summary["nextDispatch"],
    },
  };
}

export function dashboardContentState(
  data: DashboardData,
): "empty" | "success" {
  return data.metrics.length === 0 && data.orders.length === 0
    ? "empty"
    : "success";
}

export const customerStatuses = ["Active", "Review"] as const;
export const customerOrderStatuses = ["Processing", "Ready", "In transit", "Delivered"] as const;

export type CustomerStatus = (typeof customerStatuses)[number];
export type CustomerOrderStatus = (typeof customerOrderStatuses)[number];

export interface CustomerActivity {
  readonly detail: string;
  readonly id: string;
  readonly occurredAt: string;
  readonly title: string;
}

export interface CustomerContact {
  readonly email: string;
  readonly name: string;
  readonly phone: string;
  readonly role: string;
}

export interface CustomerData {
  readonly accountOwner: string;
  readonly activities: readonly CustomerActivity[];
  readonly deliveryAddress: readonly string[];
  readonly deliveryWindow: string;
  readonly id: string;
  readonly joinedAt: string;
  readonly metrics: CustomerMetrics;
  readonly name: string;
  readonly note: CustomerNote;
  readonly primaryContact: CustomerContact;
  readonly recentOrders: readonly CustomerOrder[];
  readonly region: string;
  readonly status: CustomerStatus;
  readonly tier: string;
  readonly updatedAt: string;
  readonly warehouse: string;
}

export interface CustomerMetrics {
  readonly atRiskOrders: number;
  readonly lifetimeValueCents: number;
  readonly openOrders: number;
  readonly orderCount: number;
}

export interface CustomerNote {
  readonly author: string;
  readonly body: string;
  readonly title: string;
  readonly updatedAt: string;
}

export interface CustomerOrder {
  readonly amountCents: number;
  readonly id: string;
  readonly placedAt: string;
  readonly status: CustomerOrderStatus;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isSafeNonNegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function isCustomerContact(value: unknown): value is CustomerContact {
  return isRecord(value) &&
    isNonEmptyString(value["email"]) &&
    isNonEmptyString(value["name"]) &&
    isNonEmptyString(value["phone"]) &&
    isNonEmptyString(value["role"]);
}

function isCustomerMetrics(value: unknown): value is CustomerMetrics {
  return isRecord(value) &&
    isSafeNonNegativeInteger(value["atRiskOrders"]) &&
    isSafeNonNegativeInteger(value["lifetimeValueCents"]) &&
    isSafeNonNegativeInteger(value["openOrders"]) &&
    isSafeNonNegativeInteger(value["orderCount"]) &&
    (value["atRiskOrders"] as number) <= (value["openOrders"] as number) &&
    (value["openOrders"] as number) <= (value["orderCount"] as number);
}

function isCustomerNote(value: unknown): value is CustomerNote {
  return isRecord(value) &&
    isNonEmptyString(value["author"]) &&
    isNonEmptyString(value["body"]) &&
    isNonEmptyString(value["title"]) &&
    isNonEmptyString(value["updatedAt"]);
}

function isCustomerOrder(value: unknown): value is CustomerOrder {
  return isRecord(value) &&
    isSafeNonNegativeInteger(value["amountCents"]) &&
    isNonEmptyString(value["id"]) &&
    isNonEmptyString(value["placedAt"]) &&
    typeof value["status"] === "string" &&
    customerOrderStatuses.includes(value["status"] as CustomerOrderStatus);
}

function isCustomerActivity(value: unknown): value is CustomerActivity {
  return isRecord(value) &&
    isNonEmptyString(value["detail"]) &&
    isNonEmptyString(value["id"]) &&
    isNonEmptyString(value["occurredAt"]) &&
    isNonEmptyString(value["title"]);
}

function hasUniqueIds(values: readonly { readonly id: string }[]): boolean {
  return new Set(values.map((value) => value.id)).size === values.length;
}

export function parseCustomerData(value: unknown): CustomerData {
  if (!isRecord(value)) throw new Error("Customer response must be an object.");
  const activities = value["activities"];
  const deliveryAddress = value["deliveryAddress"];
  const metrics = value["metrics"];
  const recentOrders = value["recentOrders"];
  const valid =
    isNonEmptyString(value["accountOwner"]) &&
    Array.isArray(activities) && activities.every(isCustomerActivity) && hasUniqueIds(activities) &&
    Array.isArray(deliveryAddress) && deliveryAddress.length > 0 && deliveryAddress.every(isNonEmptyString) &&
    isNonEmptyString(value["deliveryWindow"]) &&
    isNonEmptyString(value["id"]) &&
    isNonEmptyString(value["joinedAt"]) &&
    isCustomerMetrics(metrics) &&
    isNonEmptyString(value["name"]) &&
    isCustomerNote(value["note"]) &&
    isCustomerContact(value["primaryContact"]) &&
    Array.isArray(recentOrders) && recentOrders.every(isCustomerOrder) && hasUniqueIds(recentOrders) &&
    recentOrders.length <= metrics.orderCount &&
    recentOrders.filter((order) => order.status !== "Delivered").length <= metrics.openOrders &&
    isNonEmptyString(value["region"]) &&
    typeof value["status"] === "string" && customerStatuses.includes(value["status"] as CustomerStatus) &&
    isNonEmptyString(value["tier"]) &&
    isNonEmptyString(value["updatedAt"]) &&
    isNonEmptyString(value["warehouse"]);
  if (!valid) throw new Error("Customer response does not match the expected contract.");
  return value as unknown as CustomerData;
}

export function formatCustomerAmount(amountCents: number): string {
  const hasFractionalDollars = amountCents % 100 !== 0;
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: hasFractionalDollars ? 2 : 0,
    minimumFractionDigits: hasFractionalDollars ? 2 : 0,
    style: "currency",
  }).format(amountCents / 100);
}

export function formatCustomerMetricAmount(amountCents: number): string {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
    style: "currency",
  }).format(amountCents / 100);
}

import { ordersData } from "../../../lib/orders";

export const dynamic = "force-dynamic";

export function GET(): Response {
  return Response.json(ordersData, {
    headers: { "cache-control": "no-store" },
  });
}

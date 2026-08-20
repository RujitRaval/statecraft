import { dashboardData } from "../../../lib/dashboard";

export const dynamic = "force-dynamic";

export function GET(): Response {
  return Response.json(dashboardData, {
    headers: { "cache-control": "no-store" },
  });
}

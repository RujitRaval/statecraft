import { customerData } from "../../../../lib/customers";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: Readonly<{ params: Promise<{ id: string }> }>,
): Promise<Response> {
  const { id } = await params;
  if (id !== customerData.id) {
    return Response.json({ message: "Customer not found." }, {
      headers: { "cache-control": "no-store" },
      status: 404,
    });
  }
  return Response.json(customerData, {
    headers: { "cache-control": "no-store" },
  });
}

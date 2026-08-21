import { CustomerShell } from "../../../../components/customer-shell";

export default async function CustomerPage({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  return <CustomerShell customerId={id} />;
}

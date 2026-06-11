import { notFound } from "next/navigation";
import { withTenant } from "@/lib/tenant";
import { AppShell } from "@/components/AppShell";
import { CompanyDetail } from "@/components/CompanyDetail";
import { ensureSnapshot, getCompany, listAllContacts, listAllDeals } from "@/lib/data/spine";

export const dynamic = "force-dynamic";

export default async function CompanyPage({ params }: { params: Promise<{ id: string }> }) {
  return withTenant(async () => {
  const { id } = await params;
  await ensureSnapshot();

  const company = getCompany(id);
  if (!company) notFound();

  const contacts = listAllContacts().filter((c) => c.companyId === id);
  const deals = listAllDeals().filter((d) => d.companyId === id);

  return (
    <AppShell active="companies" title="Company">
      <CompanyDetail company={company} contacts={contacts} deals={deals} />
    </AppShell>
  );
  });
}

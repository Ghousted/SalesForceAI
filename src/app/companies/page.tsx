import { AppShell } from "@/components/AppShell";
import { withTenant } from "@/lib/tenant";
import { CompaniesView } from "@/components/CompaniesView";
import { ensureSnapshot, listAllCompanies, listAllContacts, listAllDeals } from "@/lib/data/spine";

export const dynamic = "force-dynamic";

export default async function CompaniesPage() {
  return withTenant(async () => {
  await ensureSnapshot();
  const contacts = listAllContacts();
  const deals = listAllDeals();
  const companies = listAllCompanies().map((c) => ({
    ...c,
    contactCount: contacts.filter((x) => x.companyId === c.id).length,
    dealCount: deals.filter((d) => d.companyId === c.id).length,
  }));
  return (
    <AppShell active="companies" title="Companies">
      <CompaniesView companies={companies} />
    </AppShell>
  );
  });
}

import { notFound } from "next/navigation";
import { withTenant } from "@/lib/tenant";
import { AppShell } from "@/components/AppShell";
import { ContactDetail } from "@/components/ContactDetail";
import {
  ensureSnapshot,
  getContact,
  getCompany,
  getRep,
  getDealForContact,
  listActivitiesForContact,
  listAllCompanies,
  listReps,
} from "@/lib/data/spine";
import { auditBook } from "@/agents/auditor";

export const dynamic = "force-dynamic";

export default async function ContactPage({ params }: { params: Promise<{ id: string }> }) {
  return withTenant(async () => {
  const { id } = await params;
  await ensureSnapshot();

  const contact = getContact(id);
  if (!contact) notFound();

  const company = getCompany(contact.companyId);
  const owner = getRep(contact.ownerRepId);
  const deal = getDealForContact(contact.id);
  const activities = listActivitiesForContact(contact.id);
  // The Auditor's read on this contact's deal — feeds the next-best-action panel.
  const audit = deal ? auditBook(undefined, (d) => d.id === deal.id)[0] ?? null : null;

  return (
    <AppShell active="contacts" title="Contact">
      <ContactDetail
        contact={contact}
        company={company ?? null}
        owner={owner ?? null}
        deal={deal ?? null}
        activities={activities}
        audit={audit}
        companies={listAllCompanies()}
        reps={listReps()}
      />
    </AppShell>
  );
  });
}

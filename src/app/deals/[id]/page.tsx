import { notFound } from "next/navigation";
import { withTenant } from "@/lib/tenant";
import { AppShell } from "@/components/AppShell";
import { DealDetail } from "@/components/DealDetail";
import {
  ensureSnapshot,
  getDeal,
  getContact,
  getCompany,
  getRep,
  listActivitiesForContact,
  listAllContacts,
  listReps,
} from "@/lib/data/spine";
import { auditBook } from "@/agents/auditor";

export const dynamic = "force-dynamic";

export default async function DealPage({ params }: { params: Promise<{ id: string }> }) {
  return withTenant(async () => {
  const { id } = await params;
  await ensureSnapshot();

  const deal = getDeal(id);
  if (!deal) notFound();

  const contact = getContact(deal.contactId);
  const company =
    getCompany(deal.companyId) ?? (contact ? getCompany(contact.companyId) : undefined);
  const owner = getRep(deal.ownerRepId);
  const activities = contact ? listActivitiesForContact(contact.id) : [];
  // The Auditor's read on just this deal (flags + evidence-based confidence).
  const audit = auditBook(undefined, (d) => d.id === id)[0] ?? null;

  return (
    <AppShell active="deals" title="Deal">
      <DealDetail
        deal={deal}
        contact={contact ?? null}
        company={company ?? null}
        owner={owner ?? null}
        activities={activities}
        audit={audit}
        contacts={listAllContacts()}
        reps={listReps()}
      />
    </AppShell>
  );
  });
}

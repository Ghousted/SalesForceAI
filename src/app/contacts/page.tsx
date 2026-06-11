import { AppShell } from "@/components/AppShell";
import { withTenant } from "@/lib/tenant";
import { ContactsView } from "@/components/ContactsView";
import {
  ensureSnapshot,
  listAllContacts,
  listAllCompanies,
  listReps,
} from "@/lib/data/spine";

export const dynamic = "force-dynamic";

export default async function ContactsPage() {
  return withTenant(async () => {
  await ensureSnapshot();
  return (
    <AppShell active="contacts" title="Contacts">
      <ContactsView
        contacts={listAllContacts()}
        companies={listAllCompanies()}
        reps={listReps()}
      />
    </AppShell>
  );
  });
}

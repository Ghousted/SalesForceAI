import { CrmNav } from "@/components/CrmNav";
import { ContactsView } from "@/components/ContactsView";
import {
  ensureSnapshot,
  listAllContacts,
  listAllCompanies,
  listReps,
} from "@/lib/data/spine";

export const dynamic = "force-dynamic";

export default async function ContactsPage() {
  await ensureSnapshot();
  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      <CrmNav active="contacts" />
      <ContactsView
        contacts={listAllContacts()}
        companies={listAllCompanies()}
        reps={listReps()}
      />
    </div>
  );
}

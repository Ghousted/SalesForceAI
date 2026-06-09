import { CrmNav } from "@/components/CrmNav";
import { DealsView } from "@/components/DealsView";
import {
  ensureSnapshot,
  listAllDeals,
  listAllContacts,
  listReps,
} from "@/lib/data/spine";

export const dynamic = "force-dynamic";

export default async function DealsPage() {
  await ensureSnapshot();
  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      <CrmNav active="deals" />
      <DealsView
        deals={listAllDeals()}
        contacts={listAllContacts()}
        reps={listReps()}
      />
    </div>
  );
}

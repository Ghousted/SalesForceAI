import { AppShell } from "@/components/AppShell";
import { withTenant } from "@/lib/tenant";
import { DealsView } from "@/components/DealsView";
import {
  ensureSnapshot,
  listAllDeals,
  listAllContacts,
  listReps,
} from "@/lib/data/spine";

export const dynamic = "force-dynamic";

export default async function DealsPage() {
  return withTenant(async () => {
  await ensureSnapshot();
  return (
    <AppShell active="deals" title="Deals">
      <DealsView
        deals={listAllDeals()}
        contacts={listAllContacts()}
        reps={listReps()}
      />
    </AppShell>
  );
  });
}

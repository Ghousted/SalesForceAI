import { AppShell } from "@/components/AppShell";
import { withTenant } from "@/lib/tenant";
import { Workspace, type ContactSummary } from "@/components/Workspace";
import { buildHomeVM } from "@/lib/home/viewModel";
import {
  ensureSnapshot,
  getDealForContact,
  listContactsForRep,
  listDealsForRep,
  resolveRepId,
} from "@/lib/data/spine";
import { DEAL_STAGE_LABELS } from "@/lib/data/types";
import { buildDealMetrics } from "@/lib/home/metrics";

// Always render per-request — the spine may hit a live CRM (no static prerender).
export const dynamic = "force-dynamic";

export default async function RepDashboard() {
  return withTenant(async () => {
  await ensureSnapshot();
  // The seat to show. With auth this comes from the session; for now it's the
  // configured rep (or the first one in the data).
  const repId = resolveRepId(process.env.SALESOS_REP_ID);
  const home = await buildHomeVM(repId, "rep");
  const contacts: ContactSummary[] = listContactsForRep(repId).map((c) => {
    const deal = getDealForContact(c.id);
    return {
      id: c.id,
      name: `${c.firstName} ${c.lastName}`,
      dealName: deal?.property ?? null,
      stageLabel: deal ? DEAL_STAGE_LABELS[deal.stage] : null,
    };
  });

  const metrics = buildDealMetrics(listDealsForRep(repId));

  return (
    <AppShell active="dashboard" title="Dashboard">
      <Workspace home={home} contacts={contacts} metrics={metrics} />
    </AppShell>
  );
  });
}

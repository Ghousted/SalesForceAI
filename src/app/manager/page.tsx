import { Workspace, type ContactSummary } from "@/components/Workspace";
import { buildHomeVM } from "@/lib/home/viewModel";
import {
  ensureSnapshot,
  getDealForContact,
  listContactsForRep,
  resolveRepId,
} from "@/lib/data/spine";
import { DEAL_STAGE_LABELS } from "@/lib/data/types";

export const dynamic = "force-dynamic";

// Manager sees the floor. For now we surface the same seat's book; multi-rep
// roll-up is a later slice (Auditor/Forecaster already accept no repId = all).
export default async function ManagerHome() {
  await ensureSnapshot();
  const repId = resolveRepId(process.env.SALESOS_REP_ID);
  const home = buildHomeVM(repId, "manager");
  const contacts: ContactSummary[] = listContactsForRep(repId).map((c) => {
    const deal = getDealForContact(c.id);
    return {
      id: c.id,
      name: `${c.firstName} ${c.lastName}`,
      dealName: deal?.property ?? null,
      stageLabel: deal ? DEAL_STAGE_LABELS[deal.stage] : null,
    };
  });

  return <Workspace home={home} contacts={contacts} />;
}

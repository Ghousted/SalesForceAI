import { Workspace, type ContactSummary } from "@/components/Workspace";
import { buildHomeVM } from "@/lib/home/viewModel";
import { getDealForContact, listContactsForRep } from "@/lib/data/spine";
import { DEAL_STAGE_LABELS } from "@/lib/data/types";

// Manager sees the floor. For the tracer build we surface the same seat's book;
// multi-rep roll-up arrives with the Forecaster/Auditor slice.
const DEMO_REP = "rep_maya";

export default function ManagerHome() {
  const home = buildHomeVM(DEMO_REP, "manager");
  const contacts: ContactSummary[] = listContactsForRep(DEMO_REP).map((c) => {
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

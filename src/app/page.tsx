import { Workspace, type ContactSummary } from "@/components/Workspace";
import { buildHomeVM } from "@/lib/home/viewModel";
import { getDealForContact, listContactsForRep } from "@/lib/data/spine";
import { DEAL_STAGE_LABELS } from "@/lib/data/types";

// Demo seat. With auth, this comes from the session.
const DEMO_REP = "rep_maya";

export default function RepHome() {
  const home = buildHomeVM(DEMO_REP, "rep");
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

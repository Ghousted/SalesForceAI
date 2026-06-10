import { CrmNav } from "@/components/CrmNav";
import { AgentSettings } from "@/components/AgentSettings";
import { listAgentConfigs } from "@/lib/agents/config";
import { funnelOptions } from "@/lib/agents/funnel";
import { ensureSnapshot } from "@/lib/data/spine";

export const dynamic = "force-dynamic";

export default async function AgentsPage() {
  await ensureSnapshot(); // funnel options need reps from the live book
  const agents = await listAgentConfigs();
  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <CrmNav active="agents" />
      <AgentSettings initial={agents} options={funnelOptions()} />
    </div>
  );
}

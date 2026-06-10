import { CrmNav } from "@/components/CrmNav";
import { AgentSettings } from "@/components/AgentSettings";
import { listAgentConfigs } from "@/lib/agents/config";

export const dynamic = "force-dynamic";

export default async function AgentsPage() {
  const agents = await listAgentConfigs();
  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <CrmNav active="agents" />
      <AgentSettings initial={agents} />
    </div>
  );
}

import { AppShell } from "@/components/AppShell";
import { withTenant } from "@/lib/tenant";
import { AgentSettings } from "@/components/AgentSettings";
import { listAgentConfigs } from "@/lib/agents/config";
import { funnelOptions } from "@/lib/agents/funnel";
import { ensureSnapshot } from "@/lib/data/spine";

export const dynamic = "force-dynamic";

export default async function AgentsPage() {
  return withTenant(async () => {
  await ensureSnapshot(); // funnel options need reps from the live book
  const agents = await listAgentConfigs();
  return (
    <AppShell active="agents" title="Agents">
      <AgentSettings initial={agents} options={funnelOptions()} />
    </AppShell>
  );
  });
}

import { AppShell } from "@/components/AppShell";
import { ConnectorsView } from "@/components/ConnectorsView";

export const dynamic = "force-dynamic";

export default function ConnectorsPage() {
  return (
    <AppShell active="connectors" title="Connections">
      <ConnectorsView />
    </AppShell>
  );
}

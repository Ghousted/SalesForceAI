import { AppShell } from "@/components/AppShell";
import { OversightView } from "@/components/OversightView";

export const dynamic = "force-dynamic";

export default function OversightPage() {
  return (
    <AppShell active="oversight" title="Oversight">
      <OversightView />
    </AppShell>
  );
}

import { AppShell } from "@/components/AppShell";
import { ReportsView } from "@/components/ReportsView";
import { withTenant } from "@/lib/tenant";
import { ensureSnapshot } from "@/lib/data/spine";
import { buildReport } from "@/lib/reports";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  return withTenant(async () => {
    await ensureSnapshot();
    const report = buildReport();
    return (
      <AppShell active="reports" title="Reports">
        <ReportsView report={report} />
      </AppShell>
    );
  });
}

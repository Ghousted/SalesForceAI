import { AppShell } from "@/components/AppShell";
import { SetupGuide } from "@/components/SetupGuide";
import { withTenant } from "@/lib/tenant";
import { getSetupStatus } from "@/lib/onboarding/setup";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  return withTenant(async () => {
    const setup = await getSetupStatus();
    return (
      <AppShell active="setup" title="Setup guide">
        <SetupGuide initial={setup} />
      </AppShell>
    );
  });
}

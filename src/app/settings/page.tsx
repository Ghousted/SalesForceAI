import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { SignOutButton } from "@/components/SignOutButton";
import { TeamPanel } from "@/components/TeamPanel";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import * as t from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const ws = (
    await db.select().from(t.workspaces).where(eq(t.workspaces.id, user.workspaceId))
  )[0];

  return (
    <AppShell active="settings" title="Settings">
      <div className="max-w-xl">
        <h1 className="mb-6 text-2xl font-semibold tracking-tight">Settings</h1>

        <section className="mb-4 rounded-xl border border-ash/12 bg-graphite p-5">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ash/70">Profile</h2>
          <dl className="space-y-2.5 text-[13px]">
            <Row k="Name" v={user.name} />
            <Row k="Email" v={user.email} />
            <Row k="Role" v={user.role === "manager" ? "Manager" : "Rep"} />
          </dl>
        </section>

        <section className="mb-4 rounded-xl border border-ash/12 bg-graphite p-5">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ash/70">Workspace</h2>
          <dl className="space-y-2.5 text-[13px]">
            <Row k="Workspace" v={ws?.name ?? "—"} />
            <Row k="ID" v={user.workspaceId} />
          </dl>
        </section>

        <TeamPanel isManager={user.role === "manager"} />

        <SignOutButton />
      </div>
    </AppShell>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 text-ash/60">{k}</dt>
      <dd className="min-w-0 break-words text-right text-ash">{v}</dd>
    </div>
  );
}

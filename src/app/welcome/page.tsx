import { redirect } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import * as t from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { WelcomeFlow } from "@/components/WelcomeFlow";

export const dynamic = "force-dynamic";

/**
 * The post-signup landing: an immersive full-screen welcome (no app shell).
 * Once a user has been through it, this route just bounces to the dashboard.
 */
export default async function WelcomePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.welcomeDone) redirect("/app");

  const ws = user.workspaceId;
  const n = async (q: Promise<{ n: number }[]>) => (await q)[0]?.n ?? 0;
  const [members, contacts, deals] = await Promise.all([
    n(db.select({ n: sql<number>`count(*)` }).from(t.users).where(eq(t.users.workspaceId, ws))),
    n(db.select({ n: sql<number>`count(*)` }).from(t.contacts).where(eq(t.contacts.workspaceId, ws))),
    n(db.select({ n: sql<number>`count(*)` }).from(t.deals).where(and(eq(t.deals.workspaceId, ws)))),
  ]);
  const wsRow = (
    await db.select().from(t.workspaces).where(eq(t.workspaces.id, ws))
  )[0];

  return (
    <WelcomeFlow
      firstName={user.name.split(" ")[0] || "there"}
      workspaceName={wsRow?.name ?? "Your workspace"}
      isFounder={user.role === "manager" && members <= 1}
      workspaceEmpty={contacts === 0 && deals === 0}
    />
  );
}

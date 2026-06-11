import { eq } from "drizzle-orm";
import { AuthForm, type InviteInfo } from "@/components/AuthForm";
import { getOpenInvite } from "@/lib/auth/invites";
import { db } from "@/lib/db/client";
import * as t from "@/lib/db/schema";

export const dynamic = "force-dynamic";

/**
 * Plain signup provisions a fresh workspace; signup via an invite link
 * (?invite=<token>) joins the inviter's workspace — resolved server-side so the
 * form can say whose team you're joining.
 */
export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>;
}) {
  const { invite: token } = await searchParams;

  let invite: InviteInfo | null = null;
  let inviteError: string | null = null;
  if (token) {
    const open = await getOpenInvite(token);
    if (!open) {
      inviteError = "This invite link is invalid or has expired — ask for a fresh one.";
    } else {
      const ws = (
        await db.select().from(t.workspaces).where(eq(t.workspaces.id, open.workspaceId))
      )[0];
      invite = {
        token,
        workspaceName: ws?.name ?? "the team",
        role: open.role === "manager" ? "manager" : "rep",
        email: open.email,
      };
    }
  }

  return <AuthForm mode="signup" invite={invite} inviteError={inviteError} />;
}

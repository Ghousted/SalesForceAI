import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import {
  createInvite,
  listMembers,
  listOpenInvites,
  revokeInvite,
} from "@/lib/auth/invites";

export const dynamic = "force-dynamic";

/**
 * Team management. GET lists members + open invites; POST mints an invite link
 * (manager only); DELETE revokes one (manager only). Sessions carry the
 * workspace, so everything is implicitly tenant-scoped.
 */

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const [members, invites] = await Promise.all([
    listMembers(user.workspaceId),
    listOpenInvites(user.workspaceId),
  ]);
  return NextResponse.json({
    members,
    // The token IS the secret — only managers see open invites.
    invites:
      user.role === "manager"
        ? invites.map((i) => ({
            id: i.id,
            email: i.email,
            role: i.role,
            createdAt: i.createdAt,
            expiresAt: i.expiresAt,
          }))
        : [],
  });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (user.role !== "manager") {
    return NextResponse.json({ error: "Only managers can invite teammates." }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const role = body?.role === "manager" ? "manager" : "rep";
  const email = typeof body?.email === "string" && body.email.trim() ? body.email : undefined;
  const invite = await createInvite({
    workspaceId: user.workspaceId,
    invitedBy: user.id,
    role,
    email,
  });
  return NextResponse.json({
    invite: {
      id: invite.id,
      email: invite.email,
      role: invite.role,
      createdAt: invite.createdAt,
      expiresAt: invite.expiresAt,
      path: `/signup?invite=${invite.id}`,
    },
  });
}

export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (user.role !== "manager") {
    return NextResponse.json({ error: "Only managers can revoke invites." }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  if (!body?.id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  await revokeInvite(String(body.id), user.workspaceId);
  return NextResponse.json({ ok: true });
}

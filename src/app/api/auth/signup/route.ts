import { NextResponse } from "next/server";
import { createUser, createUserInWorkspace, findUserByEmail } from "@/lib/auth/users";
import { getOpenInvite, markInviteAccepted } from "@/lib/auth/invites";
import { createSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const email = String(body?.email ?? "").trim();
  const name = String(body?.name ?? "").trim();
  const password = String(body?.password ?? "");
  const inviteToken = body?.invite ? String(body.invite) : undefined;

  if (!email || !name || password.length < 6) {
    return NextResponse.json(
      { error: "Name, email, and a password of at least 6 characters are required." },
      { status: 400 },
    );
  }
  if (await findUserByEmail(email)) {
    return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
  }

  // Invited signup → join the inviter's workspace instead of provisioning one.
  if (inviteToken) {
    const invite = await getOpenInvite(inviteToken);
    if (!invite) {
      return NextResponse.json(
        { error: "This invite link is invalid or has expired — ask for a fresh one." },
        { status: 410 },
      );
    }
    if (invite.email && invite.email !== email.toLowerCase()) {
      return NextResponse.json(
        { error: `This invite was issued to ${invite.email}.` },
        { status: 403 },
      );
    }
    const user = await createUserInWorkspace({
      email,
      name,
      password,
      workspaceId: invite.workspaceId,
      role: invite.role === "manager" ? "manager" : "rep",
    });
    await markInviteAccepted(inviteToken, user.id);
    await createSession(user);
    return NextResponse.json({ ok: true });
  }

  const user = await createUser({ email, name, password });
  await createSession(user);
  return NextResponse.json({ ok: true });
}

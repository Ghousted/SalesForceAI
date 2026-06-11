import { NextResponse } from "next/server";
import { findUserByEmail } from "@/lib/auth/users";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const email = String(body?.email ?? "").trim();
  const password = String(body?.password ?? "");

  const user = email ? await findUserByEmail(email) : undefined;
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return NextResponse.json({ error: "Wrong email or password." }, { status: 401 });
  }

  await createSession({ id: user.id, workspaceId: user.workspaceId });
  return NextResponse.json({ ok: true });
}

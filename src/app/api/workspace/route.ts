import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import * as t from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/** PATCH { name } — rename the workspace (managers only). */
export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (user.role !== "manager") {
    return NextResponse.json({ error: "Only managers can rename the workspace." }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const name = String(body?.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "A workspace name is required." }, { status: 400 });
  if (name.length > 60) return NextResponse.json({ error: "Keep the name under 60 characters." }, { status: 400 });
  await db.update(t.workspaces).set({ name }).where(eq(t.workspaces.id, user.workspaceId));
  return NextResponse.json({ ok: true, name });
}

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import * as t from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/** Mark the current user as having finished (or skipped) the welcome flow. */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await db.update(t.users).set({ welcomeDone: true }).where(eq(t.users.id, user.id));
  return NextResponse.json({ ok: true });
}

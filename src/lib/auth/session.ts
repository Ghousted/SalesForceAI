import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/lib/db/client";
import * as t from "@/lib/db/schema";

/**
 * Session management — opaque tokens stored in the `sessions` table, carried in
 * an httpOnly cookie. No JWTs, no external auth provider; the DB is the source
 * of truth so sessions can be revoked by deleting a row.
 */

export const SESSION_COOKIE = "salesos_session";
const MAX_AGE_S = 60 * 60 * 24 * 30; // 30 days

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: string;
  workspaceId: string;
  repId: string | null;
  welcomeDone: boolean;
}

/** Create a session row + set the cookie. */
export async function createSession(user: { id: string; workspaceId: string }): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const now = Date.now();
  await db.insert(t.sessions).values({
    id: token,
    userId: user.id,
    workspaceId: user.workspaceId,
    expiresAt: new Date(now + MAX_AGE_S * 1000).toISOString(),
    createdAt: new Date(now).toISOString(),
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_S,
  });
}

/** Resolve the logged-in user from the session cookie, or null. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const rows = await db
    .select({
      uid: t.users.id,
      email: t.users.email,
      name: t.users.name,
      role: t.users.role,
      workspaceId: t.users.workspaceId,
      repId: t.users.repId,
      welcomeDone: t.users.welcomeDone,
    })
    .from(t.sessions)
    .innerJoin(t.users, eq(t.sessions.userId, t.users.id))
    .where(and(eq(t.sessions.id, token), gt(t.sessions.expiresAt, new Date().toISOString())));

  const r = rows[0];
  if (!r) return null;
  return {
    id: r.uid,
    email: r.email,
    name: r.name,
    role: r.role,
    workspaceId: r.workspaceId,
    repId: r.repId,
    welcomeDone: r.welcomeDone,
  };
}

/** Destroy the current session (logout). */
export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.delete(t.sessions).where(eq(t.sessions.id, token));
    jar.delete(SESSION_COOKIE);
  }
}

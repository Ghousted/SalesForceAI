import { randomUUID } from "node:crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import * as t from "@/lib/db/schema";

/**
 * Team invites — how a workspace grows past one seat. A manager mints a
 * single-use, expiring token; signup with that token joins the EXISTING
 * workspace (instead of provisioning a fresh one) and gets a rep seat in the
 * book. Tokens are opaque and live only in the link — treat them like
 * passwords.
 */

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export type InviteRow = typeof t.invites.$inferSelect;

export async function createInvite(input: {
  workspaceId: string;
  invitedBy: string;
  role: "rep" | "manager";
  email?: string;
}): Promise<InviteRow> {
  const row = {
    id: `inv_${randomUUID().replace(/-/g, "")}`,
    workspaceId: input.workspaceId,
    email: input.email?.trim().toLowerCase() || null,
    role: input.role,
    invitedBy: input.invitedBy,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + INVITE_TTL_MS).toISOString(),
    acceptedBy: null,
  };
  await db.insert(t.invites).values(row);
  return row;
}

/** A valid (unredeemed, unexpired) invite, or undefined. */
export async function getOpenInvite(token: string): Promise<InviteRow | undefined> {
  const rows = await db.select().from(t.invites).where(eq(t.invites.id, token));
  const inv = rows[0];
  if (!inv) return undefined;
  if (inv.acceptedBy) return undefined;
  if (Date.parse(inv.expiresAt) < Date.now()) return undefined;
  return inv;
}

export async function markInviteAccepted(token: string, userId: string): Promise<void> {
  await db.update(t.invites).set({ acceptedBy: userId }).where(eq(t.invites.id, token));
}

export async function revokeInvite(token: string, workspaceId: string): Promise<void> {
  await db
    .delete(t.invites)
    .where(and(eq(t.invites.id, token), eq(t.invites.workspaceId, workspaceId)));
}

/** Pending (open) invites for the workspace, newest first. */
export async function listOpenInvites(workspaceId: string): Promise<InviteRow[]> {
  const rows = await db
    .select()
    .from(t.invites)
    .where(and(eq(t.invites.workspaceId, workspaceId), isNull(t.invites.acceptedBy)))
    .orderBy(desc(t.invites.createdAt));
  return rows.filter((r) => Date.parse(r.expiresAt) >= Date.now());
}

export interface Member {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
}

export async function listMembers(workspaceId: string): Promise<Member[]> {
  const rows = await db
    .select()
    .from(t.users)
    .where(eq(t.users.workspaceId, workspaceId))
    .orderBy(t.users.createdAt);
  return rows.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    createdAt: u.createdAt,
  }));
}

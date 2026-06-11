import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import * as t from "@/lib/db/schema";
import { provisionWorkspace } from "@/lib/db/seed-workspace";
import { runInWorkspace } from "@/lib/tenant";
import { invalidateSnapshot } from "@/lib/data/spine";
import { hashPassword } from "./password";

/**
 * User CRUD + tenant provisioning. Email is the global identity (unique across
 * workspaces). A plain signup gets its OWN workspace, seeded with the demo pack
 * so the product isn't empty on first login; an invited signup joins the
 * inviter's existing workspace instead (see createUserInWorkspace).
 */

export async function findUserByEmail(email: string) {
  const rows = await db.select().from(t.users).where(eq(t.users.email, email.toLowerCase()));
  return rows[0];
}

export async function createUser(input: {
  email: string;
  name: string;
  password: string;
}): Promise<{ id: string; workspaceId: string }> {
  const id = `usr_${randomUUID().slice(0, 12)}`;
  const workspaceId = `ws_${randomUUID().slice(0, 12)}`;
  // Provision the tenant's own empty workspace + an owner rep seat.
  const { ownerRepId } = await provisionWorkspace(
    workspaceId,
    `${input.name.split(" ")[0]}'s workspace`,
    input.name,
  );
  await db.insert(t.users).values({
    id,
    workspaceId,
    email: input.email.toLowerCase(),
    name: input.name,
    passwordHash: hashPassword(input.password),
    role: "manager", // workspace owner sees the whole floor
    repId: ownerRepId,
    createdAt: new Date().toISOString(),
  });
  return { id, workspaceId };
}

/**
 * Invited signup: join an EXISTING workspace. The new member also gets a rep
 * seat in the book (a `reps` row) so contacts/deals can be owned by them and
 * the agents treat them like any other seat on the floor.
 */
export async function createUserInWorkspace(input: {
  email: string;
  name: string;
  password: string;
  workspaceId: string;
  role: "rep" | "manager";
}): Promise<{ id: string; workspaceId: string }> {
  const id = `usr_${randomUUID().slice(0, 12)}`;
  const repId = `rep_${randomUUID().slice(0, 12)}`;
  await db.insert(t.reps).values({
    id: repId,
    workspaceId: input.workspaceId,
    name: input.name,
    role: input.role,
  });
  await db.insert(t.users).values({
    id,
    workspaceId: input.workspaceId,
    email: input.email.toLowerCase(),
    name: input.name,
    passwordHash: hashPassword(input.password),
    role: input.role,
    repId,
    createdAt: new Date().toISOString(),
  });
  // The workspace's cached snapshot doesn't know the new rep yet.
  await runInWorkspace(input.workspaceId, () => invalidateSnapshot());
  return { id, workspaceId: input.workspaceId };
}

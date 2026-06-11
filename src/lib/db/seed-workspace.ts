import { randomUUID } from "node:crypto";
import { db } from "./client";
import * as t from "./schema";

/**
 * Provision a fresh, EMPTY workspace for a new signup — no demo data. The owner
 * gets a single rep seat (a `reps` row) so they can own records from minute one
 * and the dashboard's rep resolution has something to land on. The workspace
 * starts clean, ready for the owner's own contacts/deals or a connector import.
 */
export async function provisionWorkspace(
  workspaceId: string,
  name: string,
  ownerName: string,
): Promise<{ ownerRepId: string }> {
  const ownerRepId = `rep_${randomUUID().slice(0, 12)}`;
  await db.insert(t.workspaces).values({
    id: workspaceId,
    name,
    createdAt: new Date().toISOString(),
  });
  await db.insert(t.reps).values({
    id: ownerRepId,
    workspaceId,
    name: ownerName,
    role: "manager",
  });
  return { ownerRepId };
}

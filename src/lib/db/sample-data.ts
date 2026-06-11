import { and, eq, like } from "drizzle-orm";
import { db } from "./client";
import * as t from "./schema";
import { SYNTHETIC_SNAPSHOT } from "../data/synthetic";
import { currentWorkspaceId } from "@/lib/tenant";
import { invalidateSnapshot } from "@/lib/data/spine";

/**
 * Sample data — a one-click way for a new, empty workspace to *try the agents*
 * without wiring up a real CRM. It clones the synthetic Ayala pack into the
 * current workspace, every id prefixed `smpl_` so it (a) never collides with the
 * owner's real records and (b) can be cleared in one sweep, leaving anything the
 * user created themselves untouched.
 *
 * This is the only path that writes the synthetic pack into a *real* workspace;
 * it's explicit and user-initiated (the offline DATA_SOURCE=synthetic mode is
 * separate and read-only).
 */

const TAG = "smpl_";
const sid = (id: string) => (id ? `${TAG}${id}` : id); // keep empty fks empty

/** True if this workspace currently holds sample data. */
export async function hasSampleData(): Promise<boolean> {
  const rows = await db
    .select({ id: t.contacts.id })
    .from(t.contacts)
    .where(and(eq(t.contacts.workspaceId, currentWorkspaceId()), like(t.contacts.id, `${TAG}%`)))
    .limit(1);
  return rows.length > 0;
}

/** The workspace owner's rep seat — the sample book is assigned to it so it
 *  shows on the owner's own dashboard and the agents (rep-scoped) light up. */
async function ownerRepId(ws: string): Promise<string | null> {
  const rows = await db
    .select({ id: t.reps.id })
    .from(t.reps)
    .where(eq(t.reps.workspaceId, ws))
    .limit(1);
  return rows[0]?.id ?? null;
}

/** Clone the synthetic pack into this workspace under the `smpl_` namespace. */
export async function loadSampleData(): Promise<void> {
  if (await hasSampleData()) return; // idempotent
  const ws = currentWorkspaceId();
  const s = SYNTHETIC_SNAPSHOT;

  // Assign the whole sample book to the owner's seat so it lands on their
  // dashboard. Only if somehow there's no seat do we bring the pack's own reps.
  const owner = await ownerRepId(ws);
  if (!owner) {
    await db.insert(t.reps).values(
      s.reps.map((r) => ({ id: sid(r.id), workspaceId: ws, name: r.name, role: r.role })),
    );
  }
  const repFor = (origOwner: string) => owner ?? sid(origOwner);

  await db.insert(t.companies).values(
    s.companies.map((c) => ({
      id: sid(c.id), workspaceId: ws, name: c.name,
      industry: c.industry, location: c.location, notes: c.notes ?? null,
    })),
  );
  await db.insert(t.contacts).values(
    s.contacts.map((c) => ({
      id: sid(c.id), workspaceId: ws, firstName: c.firstName, lastName: c.lastName,
      title: c.title, companyId: sid(c.companyId), email: c.email, phone: c.phone,
      persona: c.persona, ownerRepId: repFor(c.ownerRepId),
    })),
  );
  await db.insert(t.deals).values(
    s.deals.map((d) => ({
      id: sid(d.id), workspaceId: ws, name: d.name, contactId: sid(d.contactId),
      companyId: sid(d.companyId), stage: d.stage, amount: d.amount,
      property: d.property, expectedCloseDate: d.expectedCloseDate,
      ownerRepId: repFor(d.ownerRepId), repConfidence: d.repConfidence,
    })),
  );
  await db.insert(t.activities).values(
    s.activities.map((a) => ({
      id: sid(a.id), workspaceId: ws, contactId: sid(a.contactId),
      dealId: a.dealId ? sid(a.dealId) : null, type: a.type, timestamp: a.timestamp,
      direction: a.direction ?? null, subject: a.subject, body: a.body,
    })),
  );

  invalidateSnapshot();
}

/** Remove only the sample rows; the owner's own records are left intact. */
export async function clearSampleData(): Promise<void> {
  const ws = currentWorkspaceId();
  // Delete by workspace + `smpl_` id prefix, children before parents.
  await db.delete(t.activities).where(and(eq(t.activities.workspaceId, ws), like(t.activities.id, `${TAG}%`)));
  await db.delete(t.deals).where(and(eq(t.deals.workspaceId, ws), like(t.deals.id, `${TAG}%`)));
  await db.delete(t.contacts).where(and(eq(t.contacts.workspaceId, ws), like(t.contacts.id, `${TAG}%`)));
  await db.delete(t.companies).where(and(eq(t.companies.workspaceId, ws), like(t.companies.id, `${TAG}%`)));
  await db.delete(t.reps).where(and(eq(t.reps.workspaceId, ws), like(t.reps.id, `${TAG}%`)));

  invalidateSnapshot();
}

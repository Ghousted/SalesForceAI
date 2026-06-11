import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { currentWorkspaceId } from "@/lib/tenant";
import * as t from "@/lib/db/schema";
import { fetchHubSpotSnapshot } from "@/lib/data/hubspot";
import { invalidateSnapshot } from "@/lib/data/spine";
import type { CrmSnapshot } from "@/lib/data/types";

/**
 * HubSpot import (sync-in): fetch the workspace's HubSpot CRM and upsert it into
 * our own system of record. Upsert-by-id (HubSpot ids are numeric strings, so
 * they never collide with locally-created `ct_`/`dl_` rows) — re-running the
 * import refreshes existing records without wiping local-only data.
 */


export interface ImportCounts {
  reps: number;
  companies: number;
  contacts: number;
  deals: number;
  activities: number;
}

async function ensureWorkspace(): Promise<void> {
  const rows = await db.select().from(t.workspaces).where(eq(t.workspaces.id, currentWorkspaceId()));
  if (!rows[0]) {
    await db.insert(t.workspaces).values({
      id: currentWorkspaceId(), name: "Apex Human — Demo", createdAt: new Date().toISOString(),
    });
  }
}

async function upsertSnapshot(s: CrmSnapshot): Promise<ImportCounts> {
  for (const r of s.reps) {
    await db.insert(t.reps).values({ id: r.id, workspaceId: currentWorkspaceId(), name: r.name, role: r.role })
      .onConflictDoUpdate({ target: t.reps.id, set: { name: r.name, role: r.role } });
  }
  for (const c of s.companies) {
    await db.insert(t.companies).values({
      id: c.id, workspaceId: currentWorkspaceId(), name: c.name, industry: c.industry,
      location: c.location, notes: c.notes ?? null,
    }).onConflictDoUpdate({
      target: t.companies.id,
      set: { name: c.name, industry: c.industry, location: c.location, notes: c.notes ?? null },
    });
  }
  for (const c of s.contacts) {
    await db.insert(t.contacts).values({
      id: c.id, workspaceId: currentWorkspaceId(), firstName: c.firstName, lastName: c.lastName,
      title: c.title, companyId: c.companyId, email: c.email, phone: c.phone,
      persona: c.persona, ownerRepId: c.ownerRepId,
    }).onConflictDoUpdate({
      target: t.contacts.id,
      set: {
        firstName: c.firstName, lastName: c.lastName, title: c.title,
        companyId: c.companyId, email: c.email, phone: c.phone,
        persona: c.persona, ownerRepId: c.ownerRepId,
      },
    });
  }
  for (const d of s.deals) {
    await db.insert(t.deals).values({
      id: d.id, workspaceId: currentWorkspaceId(), name: d.name, contactId: d.contactId,
      companyId: d.companyId, stage: d.stage, amount: d.amount, property: d.property,
      expectedCloseDate: d.expectedCloseDate, ownerRepId: d.ownerRepId, repConfidence: d.repConfidence,
    }).onConflictDoUpdate({
      target: t.deals.id,
      set: {
        name: d.name, contactId: d.contactId, companyId: d.companyId, stage: d.stage,
        amount: d.amount, property: d.property, expectedCloseDate: d.expectedCloseDate,
        ownerRepId: d.ownerRepId, repConfidence: d.repConfidence,
      },
    });
  }
  for (const a of s.activities) {
    await db.insert(t.activities).values({
      id: a.id, workspaceId: currentWorkspaceId(), contactId: a.contactId, dealId: a.dealId ?? null,
      type: a.type, timestamp: a.timestamp, direction: a.direction ?? null,
      subject: a.subject, body: a.body,
    }).onConflictDoUpdate({
      target: t.activities.id,
      set: {
        contactId: a.contactId, dealId: a.dealId ?? null, type: a.type,
        timestamp: a.timestamp, direction: a.direction ?? null,
        subject: a.subject, body: a.body,
      },
    });
  }
  return {
    reps: s.reps.length, companies: s.companies.length, contacts: s.contacts.length,
    deals: s.deals.length, activities: s.activities.length,
  };
}

/** Fetch from HubSpot with `token` and import into our DB. Throws on API failure. */
export async function importHubSpot(token: string): Promise<ImportCounts> {
  const snapshot = await fetchHubSpotSnapshot(token);
  await ensureWorkspace();
  const counts = await upsertSnapshot(snapshot);
  invalidateSnapshot(); // agents/views now see the imported records
  return counts;
}

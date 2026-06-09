import { eq } from "drizzle-orm";
import { db, DEFAULT_WORKSPACE_ID } from "@/lib/db/client";
import * as t from "@/lib/db/schema";
import type {
  ActivityType,
  CrmSnapshot,
  DealStage,
  Rep,
} from "./types";

/**
 * Reads the workspace's own records into the `CrmSnapshot` the agents consume.
 * This is the system of record now — the spine caches the result like any other
 * source, and writes (src/lib/data/writes.ts) go straight to these tables.
 */
export async function loadDbSnapshot(): Promise<CrmSnapshot> {
  const ws = DEFAULT_WORKSPACE_ID;
  const [reps, companies, contacts, deals, activities] = await Promise.all([
    db.select().from(t.reps).where(eq(t.reps.workspaceId, ws)),
    db.select().from(t.companies).where(eq(t.companies.workspaceId, ws)),
    db.select().from(t.contacts).where(eq(t.contacts.workspaceId, ws)),
    db.select().from(t.deals).where(eq(t.deals.workspaceId, ws)),
    db.select().from(t.activities).where(eq(t.activities.workspaceId, ws)),
  ]);

  return {
    reps: reps.map((r) => ({ id: r.id, name: r.name, role: r.role as Rep["role"] })),
    companies: companies.map((c) => ({
      id: c.id, name: c.name, industry: c.industry,
      location: c.location, notes: c.notes ?? undefined,
    })),
    contacts: contacts.map((c) => ({
      id: c.id, firstName: c.firstName, lastName: c.lastName, title: c.title,
      companyId: c.companyId, email: c.email, phone: c.phone,
      persona: c.persona, ownerRepId: c.ownerRepId,
    })),
    deals: deals.map((d) => ({
      id: d.id, name: d.name, contactId: d.contactId, companyId: d.companyId,
      stage: d.stage as DealStage, amount: d.amount, property: d.property,
      expectedCloseDate: d.expectedCloseDate, ownerRepId: d.ownerRepId,
      repConfidence: d.repConfidence,
    })),
    activities: activities.map((a) => ({
      id: a.id, contactId: a.contactId, dealId: a.dealId ?? undefined,
      type: a.type as ActivityType, timestamp: a.timestamp,
      direction: (a.direction as "inbound" | "outbound" | null) ?? undefined,
      subject: a.subject, body: a.body,
    })),
  };
}

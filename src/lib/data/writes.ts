import { and, eq } from "drizzle-orm";
import { activeSource } from "./source";
import { hubspotSetContactOwner, hubspotLogEmail } from "./hubspot";
import { writeBack } from "@/lib/connectors/writeback";
import { invalidateSnapshot } from "./spine";
import { SYNTHETIC_SNAPSHOT } from "./synthetic";
import { db } from "@/lib/db/client";
import { currentWorkspaceId } from "@/lib/tenant";
import * as t from "@/lib/db/schema";
import type { ActivityType, DealStage } from "./types";

/**
 * The write side of the data spine — the only place agents' actions and the CRM
 * UI mutate the system of record.
 *
 * In the standalone pivot the **database is the truth**: writes land in our
 * tables. When running as a HubSpot connector (DATA_SOURCE=hubspot) the
 * owner/email writes still go to HubSpot. Synthetic mode mutates in-memory.
 * Every write invalidates the read cache.
 */

function nid(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().slice(0, 12)}`;
}

export async function setContactOwner(contactId: string, ownerId: string): Promise<void> {
  switch (activeSource()) {
    case "hubspot":
      await hubspotSetContactOwner(contactId, ownerId);
      break;
    case "synthetic": {
      const c = SYNTHETIC_SNAPSHOT.contacts.find((x) => x.id === contactId);
      if (!c) throw new Error(`No synthetic contact ${contactId}`);
      c.ownerRepId = ownerId;
      return; // synthetic has no cache to invalidate
    }
    default:
      await db
        .update(t.contacts)
        .set({ ownerRepId: ownerId })
        .where(and(eq(t.contacts.id, contactId), eq(t.contacts.workspaceId, currentWorkspaceId())));
      await writeBack.contactOwner(contactId, ownerId);
  }
  invalidateSnapshot();
}

/** Log an outbound follow-up email on the contact's timeline (no transmission). */
export async function logEmail(contactId: string, subject: string, body: string, actorId?: string): Promise<void> {
  switch (activeSource()) {
    case "hubspot":
      await hubspotLogEmail(contactId, subject, body);
      break;
    case "synthetic":
      SYNTHETIC_SNAPSHOT.activities.push({
        id: nid("email"), contactId, type: "email",
        timestamp: new Date().toISOString(), direction: "outbound", subject, body, actorId,
      });
      return;
    default:
      await db.insert(t.activities).values({
        id: nid("email"), workspaceId: currentWorkspaceId(), contactId, dealId: null,
        type: "email", timestamp: new Date().toISOString(),
        direction: "outbound", subject, body, actorId: actorId ?? null,
      });
      await writeBack.email(contactId, subject, body);
  }
  invalidateSnapshot();
}

// --- CRM create/edit (db is the system of record) --------------------------

export interface NewCompany {
  name: string;
  industry?: string;
  location?: string;
  notes?: string;
}

export async function createCompany(input: NewCompany): Promise<string> {
  const id = nid("co");
  await db.insert(t.companies).values({
    id, workspaceId: currentWorkspaceId(), name: input.name,
    industry: input.industry ?? "—", location: input.location ?? "—",
    notes: input.notes ?? null,
  });
  invalidateSnapshot();
  return id;
}

export async function updateCompany(id: string, patch: Partial<NewCompany>): Promise<void> {
  await db.update(t.companies).set(patch).where(and(eq(t.companies.id, id), eq(t.companies.workspaceId, currentWorkspaceId())));
  invalidateSnapshot();
}

export interface NewContact {
  firstName: string; lastName: string; title?: string; companyId?: string;
  email?: string; phone?: string; persona?: string; ownerRepId?: string;
}

export async function createContact(input: NewContact): Promise<string> {
  const id = nid("ct");
  await db.insert(t.contacts).values({
    id, workspaceId: currentWorkspaceId(),
    firstName: input.firstName, lastName: input.lastName,
    title: input.title ?? "—", companyId: input.companyId ?? "",
    email: input.email ?? "", phone: input.phone ?? "",
    persona: input.persona ?? "", ownerRepId: input.ownerRepId ?? "",
  });
  invalidateSnapshot();
  return id;
}

export async function updateContact(id: string, patch: Partial<NewContact>): Promise<void> {
  await db.update(t.contacts).set(patch).where(and(eq(t.contacts.id, id), eq(t.contacts.workspaceId, currentWorkspaceId())));
  await writeBack.contact(id, patch);
  invalidateSnapshot();
}

export interface NewDeal {
  name: string; contactId?: string; companyId?: string; stage: DealStage;
  amount: number; property?: string; expectedCloseDate: string;
  ownerRepId?: string; repConfidence?: number;
}

export async function createDeal(input: NewDeal): Promise<string> {
  const id = nid("dl");
  await db.insert(t.deals).values({
    id, workspaceId: currentWorkspaceId(), name: input.name,
    contactId: input.contactId ?? "", companyId: input.companyId ?? "",
    stage: input.stage, amount: input.amount, property: input.property ?? input.name,
    expectedCloseDate: input.expectedCloseDate, ownerRepId: input.ownerRepId ?? "",
    repConfidence: input.repConfidence ?? 0,
  });
  invalidateSnapshot();
  return id;
}

export async function updateDeal(id: string, patch: Partial<NewDeal>): Promise<void> {
  await db.update(t.deals).set(patch).where(and(eq(t.deals.id, id), eq(t.deals.workspaceId, currentWorkspaceId())));
  await writeBack.deal(id, patch);
  invalidateSnapshot();
}

export interface NewActivity {
  contactId: string;
  dealId?: string;
  type: ActivityType;
  subject: string;
  body?: string;
  direction?: "inbound" | "outbound";
  /** Agent that created it; omit for human-logged touches. */
  actorId?: string;
}

/** Log a touch (note/call/meeting/email/viewing) onto a contact's timeline. */
export async function logActivity(input: NewActivity): Promise<string> {
  const id = nid("act");
  await db.insert(t.activities).values({
    id, workspaceId: currentWorkspaceId(), contactId: input.contactId, dealId: input.dealId ?? null,
    type: input.type, timestamp: new Date().toISOString(),
    direction: input.direction ?? null, subject: input.subject, body: input.body ?? "",
    actorId: input.actorId ?? null,
  });
  // Mirror the touch onto HubSpot's timeline (emails have their own object type).
  if (input.type === "email") await writeBack.email(input.contactId, input.subject, input.body ?? "");
  else await writeBack.note(input.contactId, `[${input.type}] ${input.subject}`, input.body ?? "");
  invalidateSnapshot();
  return id;
}

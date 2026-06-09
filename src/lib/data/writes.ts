import { and, eq } from "drizzle-orm";
import { activeSource } from "./source";
import { hubspotSetContactOwner, hubspotLogEmail } from "./hubspot";
import { invalidateSnapshot } from "./spine";
import { SYNTHETIC_SNAPSHOT } from "./synthetic";
import { db, DEFAULT_WORKSPACE_ID } from "@/lib/db/client";
import * as t from "@/lib/db/schema";
import type { DealStage } from "./types";

/**
 * The write side of the data spine — the only place agents' actions and the CRM
 * UI mutate the system of record.
 *
 * In the standalone pivot the **database is the truth**: writes land in our
 * tables. When running as a HubSpot connector (DATA_SOURCE=hubspot) the
 * owner/email writes still go to HubSpot. Synthetic mode mutates in-memory.
 * Every write invalidates the read cache.
 */

const WS = DEFAULT_WORKSPACE_ID;

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
        .where(and(eq(t.contacts.id, contactId), eq(t.contacts.workspaceId, WS)));
  }
  invalidateSnapshot();
}

/** Log an outbound follow-up email on the contact's timeline (no transmission). */
export async function logEmail(contactId: string, subject: string, body: string): Promise<void> {
  switch (activeSource()) {
    case "hubspot":
      await hubspotLogEmail(contactId, subject, body);
      break;
    case "synthetic":
      SYNTHETIC_SNAPSHOT.activities.push({
        id: nid("email"), contactId, type: "email",
        timestamp: new Date().toISOString(), direction: "outbound", subject, body,
      });
      return;
    default:
      await db.insert(t.activities).values({
        id: nid("email"), workspaceId: WS, contactId, dealId: null,
        type: "email", timestamp: new Date().toISOString(),
        direction: "outbound", subject, body,
      });
  }
  invalidateSnapshot();
}

// --- CRM create/edit (db is the system of record) --------------------------

export interface NewContact {
  firstName: string; lastName: string; title?: string; companyId?: string;
  email?: string; phone?: string; persona?: string; ownerRepId?: string;
}

export async function createContact(input: NewContact): Promise<string> {
  const id = nid("ct");
  await db.insert(t.contacts).values({
    id, workspaceId: WS,
    firstName: input.firstName, lastName: input.lastName,
    title: input.title ?? "—", companyId: input.companyId ?? "",
    email: input.email ?? "", phone: input.phone ?? "",
    persona: input.persona ?? "", ownerRepId: input.ownerRepId ?? "",
  });
  invalidateSnapshot();
  return id;
}

export async function updateContact(id: string, patch: Partial<NewContact>): Promise<void> {
  await db.update(t.contacts).set(patch).where(and(eq(t.contacts.id, id), eq(t.contacts.workspaceId, WS)));
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
    id, workspaceId: WS, name: input.name,
    contactId: input.contactId ?? "", companyId: input.companyId ?? "",
    stage: input.stage, amount: input.amount, property: input.property ?? input.name,
    expectedCloseDate: input.expectedCloseDate, ownerRepId: input.ownerRepId ?? "",
    repConfidence: input.repConfidence ?? 0,
  });
  invalidateSnapshot();
  return id;
}

export async function updateDeal(id: string, patch: Partial<NewDeal>): Promise<void> {
  await db.update(t.deals).set(patch).where(and(eq(t.deals.id, id), eq(t.deals.workspaceId, WS)));
  invalidateSnapshot();
}

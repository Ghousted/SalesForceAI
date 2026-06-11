import { readCred } from "./store";
import {
  withHubSpotToken,
  hubspotSetContactOwner,
  hubspotLogEmail,
  hubspotLogNote,
  hubspotUpdateDeal,
  hubspotUpdateContact,
} from "@/lib/data/hubspot";
import type { DealStage } from "@/lib/data/types";

/**
 * HubSpot write-back (sync-out) — the second half of two-way sync. Our DB stays
 * the system of record; when the workspace has the HubSpot connector attached,
 * writes to records that CAME from HubSpot are mirrored back so the customer's
 * old CRM doesn't go stale during the transition.
 *
 * Scope rules:
 *  - Only records imported from HubSpot are pushed (their local ids ARE the
 *    HubSpot numeric ids; locally-created `ct_`/`dl_` rows stay local — pushing
 *    creates would duplicate on the next import).
 *  - Best-effort and non-blocking: a HubSpot failure never fails the local
 *    write. Errors are logged server-side only.
 *  - The token never leaves the server (read from connector_credentials here).
 */

const isHubSpotId = (id: string) => /^\d+$/.test(id);

async function workspaceToken(): Promise<string | undefined> {
  try {
    const cred = await readCred("hubspot");
    return cred?.connected && cred.token ? cred.token : undefined;
  } catch {
    return undefined;
  }
}

/** Push `fn` to HubSpot if the record is HubSpot-born and a token is attached. */
async function push(recordId: string, label: string, fn: () => Promise<void>): Promise<void> {
  if (!isHubSpotId(recordId)) return;
  const token = await workspaceToken();
  if (!token) return;
  try {
    await withHubSpotToken(token, fn);
  } catch (err) {
    console.warn(`[hubspot write-back] ${label} failed:`, err instanceof Error ? err.message : err);
  }
}

export const writeBack = {
  contactOwner(contactId: string, ownerId: string): Promise<void> {
    // Owner must also be a HubSpot owner id; locally-created reps can't map.
    if (!isHubSpotId(ownerId)) return Promise.resolve();
    return push(contactId, `owner ${contactId}`, () => hubspotSetContactOwner(contactId, ownerId));
  },
  email(contactId: string, subject: string, body: string): Promise<void> {
    return push(contactId, `email ${contactId}`, () => hubspotLogEmail(contactId, subject, body));
  },
  note(contactId: string, subject: string, body: string): Promise<void> {
    return push(contactId, `note ${contactId}`, () => hubspotLogNote(contactId, subject, body));
  },
  deal(
    dealId: string,
    patch: { name?: string; stage?: DealStage; amount?: number; expectedCloseDate?: string },
  ): Promise<void> {
    return push(dealId, `deal ${dealId}`, () => hubspotUpdateDeal(dealId, patch));
  },
  contact(
    contactId: string,
    patch: { firstName?: string; lastName?: string; email?: string; phone?: string; title?: string },
  ): Promise<void> {
    return push(contactId, `contact ${contactId}`, () => hubspotUpdateContact(contactId, patch));
  },
};

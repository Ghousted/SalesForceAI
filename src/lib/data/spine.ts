import { SYNTHETIC_SNAPSHOT } from "./synthetic";
import type {
  Activity,
  Company,
  Contact,
  CrmSnapshot,
  Deal,
  Rep,
} from "./types";

/**
 * The shared data spine (PRD §8).
 *
 * Every agent reads the same material through this one module rather than each
 * collecting separately. Today it serves the synthetic snapshot; swapping in a
 * live HubSpot-backed source later means re-implementing only this file.
 */

function getSnapshot(): CrmSnapshot {
  return SYNTHETIC_SNAPSHOT;
}

/**
 * "Now" for the platform, anchored to the synthetic pack's today (2026-06-08)
 * so date-relative reasoning (stale deals, close-date pressure) is deterministic
 * in demos regardless of the wall clock. Live mode would return the real now.
 */
export function spineNow(): Date {
  return new Date("2026-06-08T12:00:00Z");
}

export function listReps(): Rep[] {
  return getSnapshot().reps;
}

export function getRep(id: string): Rep | undefined {
  return getSnapshot().reps.find((r) => r.id === id);
}

export function getContact(id: string): Contact | undefined {
  return getSnapshot().contacts.find((c) => c.id === id);
}

export function listContactsForRep(repId: string): Contact[] {
  return getSnapshot().contacts.filter((c) => c.ownerRepId === repId);
}

export function getCompany(id: string): Company | undefined {
  return getSnapshot().companies.find((c) => c.id === id);
}

export function getDeal(id: string): Deal | undefined {
  return getSnapshot().deals.find((d) => d.id === id);
}

export function listDealsForRep(repId: string): Deal[] {
  return getSnapshot().deals.filter((d) => d.ownerRepId === repId);
}

export function listAllDeals(): Deal[] {
  return getSnapshot().deals;
}

export function getDealForContact(contactId: string): Deal | undefined {
  return getSnapshot().deals.find((d) => d.contactId === contactId);
}

export function listActivitiesForContact(contactId: string): Activity[] {
  return getSnapshot()
    .activities.filter((a) => a.contactId === contactId)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

/**
 * A denormalized bundle for one prospect — everything an agent needs to reason
 * about a single person and their deal in one read.
 */
export interface ProspectDossier {
  contact: Contact;
  company?: Company;
  deal?: Deal;
  activities: Activity[];
}

export function buildDossier(contactId: string): ProspectDossier | undefined {
  const contact = getContact(contactId);
  if (!contact) return undefined;
  return {
    contact,
    company: getCompany(contact.companyId),
    deal: getDealForContact(contactId),
    activities: listActivitiesForContact(contactId),
  };
}

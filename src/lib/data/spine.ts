import { SYNTHETIC_SNAPSHOT } from "./synthetic";
import { activeSource, loadSnapshot } from "./source";
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
 * collecting separately. The backing store (synthetic pack or live HubSpot) is
 * chosen in ./source.ts. Agents and UI call the sync query functions below; the
 * data is hydrated once per request window via `ensureSnapshot()` and cached
 * here, so the sync read path is unchanged regardless of source.
 */

let cache: { snapshot: CrmSnapshot; at: number } | null = null;
const TTL_MS = Number(process.env.DATA_TTL_MS ?? 60_000);

/**
 * Hydrate the cache from the active source. Call this (and await it) at every
 * server entry point — API routes and pages — before reading the spine. For the
 * synthetic source it's a no-op; for HubSpot it fetches (respecting a TTL) and
 * falls back to the last good cache / synthetic on failure so the app stays up.
 */
export async function ensureSnapshot(): Promise<void> {
  if (activeSource() === "synthetic") return; // getSnapshot() serves synthetic
  const now = Date.now();
  if (cache && now - cache.at < TTL_MS) return;
  try {
    const snapshot = await loadSnapshot();
    cache = { snapshot, at: now };
  } catch (err) {
    console.error(
      `[spine] live data load failed; serving ${cache ? "last cache" : "synthetic"} instead:`,
      err,
    );
  }
}

function getSnapshot(): CrmSnapshot {
  return cache?.snapshot ?? SYNTHETIC_SNAPSHOT;
}

/** Drop the cache so the next `ensureSnapshot()` refetches — call after a write. */
export function invalidateSnapshot(): void {
  cache = null;
}

/**
 * "Now" for the platform. For the synthetic pack it's anchored to that pack's
 * today (2026-06-08) so date math is deterministic in demos; against live
 * HubSpot data it's the real wall clock.
 */
export function spineNow(): Date {
  // Only the offline synthetic demo is date-anchored; real data uses real time.
  return activeSource() === "synthetic"
    ? new Date("2026-06-08T12:00:00Z")
    : new Date();
}

/** Resolve a usable rep id: the preferred one if present, else the first. */
export function resolveRepId(preferred?: string): string {
  const reps = getSnapshot().reps;
  if (preferred && reps.some((r) => r.id === preferred)) return preferred;
  return reps[0]?.id ?? preferred ?? "";
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

export function listAllContacts(): Contact[] {
  return getSnapshot().contacts;
}

export function getCompany(id: string): Company | undefined {
  return getSnapshot().companies.find((c) => c.id === id);
}

export function listAllCompanies(): Company[] {
  return getSnapshot().companies;
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

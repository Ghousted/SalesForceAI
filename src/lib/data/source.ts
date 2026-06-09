import { SYNTHETIC_SNAPSHOT } from "./synthetic";
import { fetchHubSpotSnapshot, hubspotConfigured } from "./hubspot";
import { loadDbSnapshot } from "./db-source";
import type { CrmSnapshot } from "./types";

/**
 * Selects where the data spine gets its material.
 *
 *   db        — our own database, the system of record (default).
 *   synthetic — the sanitized Ayala Land pack (offline demo, no DB).
 *   hubspot   — live HubSpot CRM (a connector; DATA_SOURCE=hubspot + a token).
 *
 * This is the only place that knows about the backing store. The spine caches
 * whatever this returns; agents and UI are oblivious.
 */

export type DataSourceKind = "db" | "synthetic" | "hubspot";

export function activeSource(): DataSourceKind {
  const want = (process.env.DATA_SOURCE ?? "db").toLowerCase();
  if (want === "synthetic") return "synthetic";
  // hubspot is now an optional connector — fall back to our DB if not configured.
  if (want === "hubspot") return hubspotConfigured() ? "hubspot" : "db";
  return "db"; // own system of record
}

export async function loadSnapshot(): Promise<CrmSnapshot> {
  const src = activeSource();
  if (src === "hubspot") return fetchHubSpotSnapshot();
  if (src === "synthetic") return SYNTHETIC_SNAPSHOT;
  return loadDbSnapshot();
}

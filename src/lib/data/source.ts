import { SYNTHETIC_SNAPSHOT } from "./synthetic";
import { fetchHubSpotSnapshot, hubspotConfigured } from "./hubspot";
import type { CrmSnapshot } from "./types";

/**
 * Selects where the data spine gets its material.
 *
 *   synthetic — the sanitized Ayala Land pack (default; no PII, no network).
 *   hubspot   — live HubSpot CRM (requires DATA_SOURCE=hubspot + a token).
 *
 * This is the only place that knows about the backing store. The spine caches
 * whatever this returns; agents and UI are oblivious.
 */

export type DataSourceKind = "synthetic" | "hubspot";

export function activeSource(): DataSourceKind {
  const want = (process.env.DATA_SOURCE ?? "synthetic").toLowerCase();
  // Fall back to synthetic if hubspot is asked for but not configured, so the
  // app never hard-fails on a missing token.
  return want === "hubspot" && hubspotConfigured() ? "hubspot" : "synthetic";
}

export async function loadSnapshot(): Promise<CrmSnapshot> {
  if (activeSource() === "hubspot") return fetchHubSpotSnapshot();
  return SYNTHETIC_SNAPSHOT;
}

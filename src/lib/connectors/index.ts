import { CONNECTORS, getConnector } from "./registry";
import { readCred, writeCred, clearCred } from "./store";
import { importHubSpot } from "./hubspot";
import { importGmail } from "./gmail";
import { importOutlook } from "./outlook";
import { importCalendar } from "./gcal";
import { googleConfigured, buildGoogleAuthUrl, exchangeGoogleCode } from "./google";
import { microsoftConfigured, buildMicrosoftAuthUrl, exchangeMicrosoftCode } from "./microsoft";
import type { ConnectorKind, ConnectorState, ConnectorStatus, ConnectorView } from "./types";

/**
 * Connector orchestration — the one module the API talks to. It merges the
 * static catalog with each connector's stored state, and runs connect /
 * disconnect / sync and the OAuth handshakes. Secrets never leave this layer:
 * views omit the token.
 */

/** Whether a connector's app credentials are present in the environment. */
function connectorConfigured(kind: ConnectorKind): boolean {
  switch (kind) {
    case "hubspot":
      return true; // token is supplied at connect time, not via env
    case "gmail":
    case "google-calendar":
      return googleConfigured();
    case "outlook":
      return microsoftConfigured();
    default:
      return false;
  }
}

function statusOf(implemented: boolean, configured: boolean, state: ConnectorState): ConnectorStatus {
  if (!implemented || !configured) return "needs-setup";
  return state.connected ? "connected" : "disconnected";
}

async function viewFor(kind: ConnectorKind): Promise<ConnectorView> {
  const d = getConnector(kind)!;
  const cred = await readCred(kind);
  const configured = connectorConfigured(kind);
  const state: ConnectorState = {
    connected: cred?.connected ?? false,
    lastSyncAt: cred?.lastSyncAt,
    lastResult: cred?.lastResult,
    error: cred?.error,
  };
  const status = statusOf(d.implemented, configured, state);
  const connectUrl =
    d.auth === "oauth" && configured && !state.connected
      ? `/api/connectors/${kind}/oauth/start`
      : undefined;
  return { ...d, ...state, configured, status, connectUrl, accountEmail: cred?.accountEmail };
}

export async function listConnectors(): Promise<ConnectorView[]> {
  return Promise.all(CONNECTORS.map((c) => viewFor(c.kind)));
}

/** Run the appropriate sync-in for a connected connector; returns a UI summary. */
async function runSync(kind: ConnectorKind): Promise<string> {
  switch (kind) {
    case "hubspot": {
      const cred = await readCred("hubspot");
      if (!cred?.token) throw new Error("Missing stored token — reconnect HubSpot.");
      return summarizeImport(await importHubSpot(cred.token));
    }
    case "gmail":
      return summarizeInbox("messages", await importGmail());
    case "outlook":
      return summarizeInbox("messages", await importOutlook());
    case "google-calendar":
      return summarizeInbox("events", await importCalendar());
    default:
      throw new Error("Sync isn't available for this connector.");
  }
}

/**
 * Connect a connector. For HubSpot this stores the token and runs the first
 * import immediately, so "Connect" is only reported as success if the token
 * actually worked. OAuth connectors connect via their Connect button instead.
 */
export async function connectConnector(
  kind: ConnectorKind,
  config: { token?: string },
): Promise<ConnectorView> {
  const d = getConnector(kind);
  if (!d) throw new Error(`Unknown connector: ${kind}`);
  if (!d.implemented || !connectorConfigured(kind)) {
    throw new Error(`${d.name} isn't available yet — it needs its sign-in app configured.`);
  }
  if (d.auth === "oauth") {
    throw new Error(`Connect ${d.name} with the Connect button (sign-in).`);
  }
  if (kind === "hubspot") {
    const token = config.token?.trim();
    if (!token) throw new Error("Paste your HubSpot Private App token to connect.");
    try {
      const counts = await importHubSpot(token);
      await writeCred(kind, {
        token, connected: true, error: undefined,
        lastSyncAt: new Date().toISOString(),
        lastResult: summarizeImport(counts),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await writeCred(kind, { connected: false, error: message });
      throw new Error(message);
    }
  }
  return viewFor(kind);
}

/** Re-pull data for an already-connected connector. */
export async function syncConnector(kind: ConnectorKind): Promise<ConnectorView> {
  const cred = await readCred(kind);
  if (!cred?.connected) throw new Error("Connect this first.");
  try {
    const lastResult = await runSync(kind);
    await writeCred(kind, { error: undefined, lastSyncAt: new Date().toISOString(), lastResult });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await writeCred(kind, { error: message });
    throw new Error(message);
  }
  return viewFor(kind);
}

export async function disconnectConnector(kind: ConnectorKind): Promise<ConnectorView> {
  await clearCred(kind);
  return viewFor(kind);
}

// --- OAuth handshakes (Gmail, Outlook, Google Calendar) --------------------

/** Begin an OAuth connect: returns the provider consent URL to redirect to. */
export async function startOAuth(kind: ConnectorKind, origin: string): Promise<string> {
  const state = crypto.randomUUID();
  if (kind === "gmail" || kind === "google-calendar") {
    if (!googleConfigured()) throw new Error("Google sign-in isn't configured.");
    return buildGoogleAuthUrl(origin, state, kind);
  }
  if (kind === "outlook") {
    if (!microsoftConfigured()) throw new Error("Microsoft sign-in isn't configured.");
    return buildMicrosoftAuthUrl(origin, state);
  }
  throw new Error(`${kind} doesn't use OAuth.`);
}

/**
 * Complete an OAuth handshake: verify the CSRF state, exchange the code for
 * tokens, then run a first sync so the timeline fills immediately.
 */
export async function completeOAuth(
  kind: ConnectorKind,
  origin: string,
  code: string,
  state: string,
): Promise<void> {
  const cred = await readCred(kind);
  if (!cred?.oauthState || cred.oauthState !== state) {
    throw new Error("OAuth state mismatch — please try connecting again.");
  }
  if (kind === "gmail" || kind === "google-calendar") {
    await exchangeGoogleCode(origin, code, kind);
  } else if (kind === "outlook") {
    await exchangeMicrosoftCode(origin, code);
  } else {
    throw new Error(`${kind} doesn't use OAuth.`);
  }
  try {
    const lastResult = await runSync(kind);
    await writeCred(kind, { lastSyncAt: new Date().toISOString(), lastResult });
  } catch {
    /* connected; the first sync can be retried from the UI */
  }
}

// --- summaries --------------------------------------------------------------

function summarizeImport(c: {
  contacts: number; companies: number; deals: number; activities: number;
}): string {
  return `Imported ${c.contacts} contacts, ${c.companies} companies, ${c.deals} deals, ${c.activities} activities.`;
}

function summarizeInbox(
  noun: string,
  r: { scanned: number; logged: number; matchedContacts: number },
): string {
  return `Scanned ${r.scanned} ${noun}, logged ${r.logged} onto ${r.matchedContacts} contact${r.matchedContacts === 1 ? "" : "s"}.`;
}

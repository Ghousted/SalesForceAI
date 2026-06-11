/**
 * Connectors — how a workspace plugs its own tools into Sales OS.
 *
 * A connector pulls external data INTO our system of record (sync-in) and/or
 * lets agents act OUT through it (send/log). Today HubSpot import is live
 * (token auth); Gmail / Outlook / Calendar are described so they're visible in
 * the product, and light up once their OAuth credentials are configured.
 */

export type ConnectorKind = "hubspot" | "gmail" | "outlook" | "google-calendar";
export type ConnectorCategory = "crm" | "email" | "calendar";

/** How a connector authenticates. */
export type ConnectorAuth = "token" | "oauth";

export interface ConnectorDescriptor {
  kind: ConnectorKind;
  name: string;
  category: ConnectorCategory;
  blurb: string;
  auth: ConnectorAuth;
  /** Can it actually sync today, or is it a described-but-not-wired connector? */
  implemented: boolean;
}

/** Persisted per-workspace connector state (stored in connector_credentials). */
export interface ConnectorState {
  connected: boolean;
  lastSyncAt?: string;
  /** Human summary of the last sync, e.g. "Imported 42 contacts, 13 deals". */
  lastResult?: string;
  error?: string;
}

/** What the UI/API renders: the descriptor merged with live state + a status. */
export type ConnectorStatus =
  | "connected"
  | "disconnected"
  | "needs-setup"; // implemented=false: visible but not yet wired

export interface ConnectorView extends ConnectorDescriptor, ConnectorState {
  status: ConnectorStatus;
  /** True once the connector's app credentials are present (env-configured). */
  configured: boolean;
  /** For an OAuth connector ready to link: where the "Connect" button points. */
  connectUrl?: string;
  /** Connected account address (OAuth connectors). Not secret. */
  accountEmail?: string;
}

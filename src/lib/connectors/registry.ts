import type { ConnectorDescriptor, ConnectorKind } from "./types";

/**
 * The catalog of connectors Sales OS offers. HubSpot is live (paste a Private
 * App token and import your CRM). The inbox/calendar connectors are listed so
 * the product shows the full surface; they go live when their OAuth app
 * credentials are configured (Phase B continuation).
 */
export const CONNECTORS: ConnectorDescriptor[] = [
  {
    kind: "hubspot",
    name: "HubSpot",
    category: "crm",
    blurb: "Import your existing contacts, companies, deals and activity. Already on HubSpot? Bring it all over in one click.",
    auth: "token",
    implemented: true,
  },
  {
    kind: "gmail",
    name: "Gmail",
    category: "email",
    blurb: "Sync your inbox so agents log real conversations onto each contact's timeline.",
    auth: "oauth",
    implemented: true,
  },
  {
    kind: "outlook",
    name: "Outlook",
    category: "email",
    blurb: "Sync your Microsoft 365 inbox so agents log real conversations onto each contact's timeline.",
    auth: "oauth",
    implemented: true,
  },
  {
    kind: "google-calendar",
    name: "Google Calendar",
    category: "calendar",
    blurb: "Pull meetings and viewings onto the timeline so the Analyst and Auditor see what really happened.",
    auth: "oauth",
    implemented: true,
  },
];

export function getConnector(kind: string): ConnectorDescriptor | undefined {
  return CONNECTORS.find((c) => c.kind === kind);
}

export function isConnectorKind(kind: string): kind is ConnectorKind {
  return CONNECTORS.some((c) => c.kind === kind);
}

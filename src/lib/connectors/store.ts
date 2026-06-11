import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { currentWorkspaceId } from "@/lib/tenant";
import * as t from "@/lib/db/schema";
import type { ConnectorKind, ConnectorState } from "./types";

/**
 * Per-workspace connector credentials + state, backed by `connector_credentials`
 * (one row per kind). Secrets (e.g. a HubSpot token) live in the JSON `data`
 * blob alongside the sync state; they're never sent back to the client — the
 * API maps to a `ConnectorView` that omits them.
 */


export interface StoredCred extends ConnectorState {
  /** Secret material — server-only, never serialized into a ConnectorView. */
  token?: string; // HubSpot Private App token
  // --- OAuth (Gmail / Outlook / Calendar) ---
  accessToken?: string;
  refreshToken?: string;
  /** Access-token expiry, epoch ms. */
  expiresAt?: number;
  /** CSRF state for an in-flight OAuth handshake. */
  oauthState?: string;
  /** The connected account's address, shown in the UI. */
  accountEmail?: string;
}

// Row id carries the workspace — the PK is global, so two tenants connecting
// the same kind must not collide on a bare `cc_<kind>`.
function rowId(kind: ConnectorKind): string {
  return `cc_${currentWorkspaceId()}_${kind}`;
}

export async function readCred(kind: ConnectorKind): Promise<StoredCred | undefined> {
  const rows = await db
    .select()
    .from(t.connectorCredentials)
    .where(and(eq(t.connectorCredentials.id, rowId(kind)), eq(t.connectorCredentials.workspaceId, currentWorkspaceId())));
  if (!rows[0]) return undefined;
  try {
    return JSON.parse(rows[0].data) as StoredCred;
  } catch {
    return { connected: false };
  }
}

/** Merge a patch into the stored credential (upsert). */
export async function writeCred(kind: ConnectorKind, patch: Partial<StoredCred>): Promise<StoredCred> {
  const existing = (await readCred(kind)) ?? { connected: false };
  const next: StoredCred = { ...existing, ...patch };
  const data = JSON.stringify(next);
  const id = rowId(kind);
  const rows = await db
    .select()
    .from(t.connectorCredentials)
    .where(and(eq(t.connectorCredentials.id, id), eq(t.connectorCredentials.workspaceId, currentWorkspaceId())));
  if (rows[0]) {
    await db
      .update(t.connectorCredentials)
      .set({ data })
      .where(and(eq(t.connectorCredentials.id, id), eq(t.connectorCredentials.workspaceId, currentWorkspaceId())));
  } else {
    await db.insert(t.connectorCredentials).values({
      id, workspaceId: currentWorkspaceId(), kind, data, createdAt: new Date().toISOString(),
    });
  }
  return next;
}

export async function clearCred(kind: ConnectorKind): Promise<void> {
  await db
    .delete(t.connectorCredentials)
    .where(and(eq(t.connectorCredentials.id, rowId(kind)), eq(t.connectorCredentials.workspaceId, currentWorkspaceId())));
}

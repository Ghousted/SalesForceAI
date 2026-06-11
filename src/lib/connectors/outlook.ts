import { invalidateSnapshot } from "@/lib/data/spine";
import type { Activity } from "@/lib/data/types";
import { getValidMicrosoftToken } from "./microsoft";
import { contactEmailMap, upsertActivity } from "./inbox";
import { readCred } from "./store";

/**
 * Outlook sync-in (Microsoft Graph): pull recent messages and log the ones
 * involving a known contact onto that contact's timeline as email activities.
 * Read-only (Mail.Read). Matching is by email address; direction is inferred
 * from who sent it — same model as the Gmail connector, different API shape.
 */

const GRAPH = "https://graph.microsoft.com/v1.0/me";

export interface OutlookSyncResult {
  scanned: number;
  logged: number;
  matchedContacts: number;
}

// --- pure mapper (tested without Graph) ------------------------------------

interface GraphRecipient {
  emailAddress?: { address?: string; name?: string };
}
export interface GraphMessage {
  id: string;
  subject?: string;
  bodyPreview?: string;
  receivedDateTime?: string;
  sentDateTime?: string;
  from?: GraphRecipient;
  toRecipients?: GraphRecipient[];
  ccRecipients?: GraphRecipient[];
}

function addr(r: GraphRecipient | undefined): string | undefined {
  return r?.emailAddress?.address?.toLowerCase();
}

/**
 * Map a Graph message to a timeline activity, or null if it doesn't involve a
 * known contact. `contactsByEmail` maps lower-cased email → contactId; `self` is
 * the connected mailbox address (lower-cased), used to tell inbound from outbound.
 */
export function graphMessageToActivity(
  msg: GraphMessage,
  contactsByEmail: Map<string, string>,
  self: string,
): Activity | null {
  const from = addr(msg.from);
  const recipients = [
    ...(msg.toRecipients ?? []).map(addr),
    ...(msg.ccRecipients ?? []).map(addr),
  ].filter((e): e is string => Boolean(e));

  let contactId: string | undefined;
  let direction: "inbound" | "outbound" | undefined;

  if (from && contactsByEmail.has(from)) {
    contactId = contactsByEmail.get(from);
    direction = "inbound";
  } else if (from && from === self.toLowerCase()) {
    const hit = recipients.find((e) => contactsByEmail.has(e));
    if (hit) {
      contactId = contactsByEmail.get(hit);
      direction = "outbound";
    }
  }
  if (!contactId) return null;

  const when = msg.receivedDateTime ?? msg.sentDateTime;
  const ts = when ? new Date(when) : new Date(0);
  return {
    id: `outlook:${msg.id}`,
    contactId,
    type: "email",
    timestamp: isNaN(ts.getTime()) ? new Date(0).toISOString() : ts.toISOString(),
    direction,
    subject: msg.subject || "(no subject)",
    body: msg.bodyPreview ?? "",
  };
}

// --- HTTP + persistence -----------------------------------------------------

async function graphGet<T>(path: string, accessToken: string): Promise<T> {
  const res = await fetch(`${GRAPH}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Graph GET ${path} → ${res.status}: ${body.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

/** Pull recent Outlook messages and log contact-matched ones. */
export async function importOutlook(): Promise<OutlookSyncResult> {
  const accessToken = await getValidMicrosoftToken();
  const cred = await readCred("outlook");
  const self = cred?.accountEmail ?? "";
  const contacts = await contactEmailMap();

  const max = Number(process.env.OUTLOOK_MAX_MESSAGES ?? 50);
  const select = "id,subject,bodyPreview,receivedDateTime,sentDateTime,from,toRecipients,ccRecipients";
  const list = await graphGet<{ value?: GraphMessage[] }>(
    `/messages?$top=${max}&$select=${select}&$orderby=receivedDateTime desc`,
    accessToken,
  );
  const messages = list.value ?? [];

  const matched = new Set<string>();
  let logged = 0;
  for (const msg of messages) {
    const activity = graphMessageToActivity(msg, contacts, self);
    if (!activity) continue;
    await upsertActivity(activity);
    matched.add(activity.contactId);
    logged++;
  }

  if (logged > 0) invalidateSnapshot();
  return { scanned: messages.length, logged, matchedContacts: matched.size };
}

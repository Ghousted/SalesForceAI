import { invalidateSnapshot } from "@/lib/data/spine";
import type { Activity } from "@/lib/data/types";
import { getValidGoogleToken } from "./google";
import { contactEmailMap, extractEmails, upsertActivity } from "./inbox";
import { readCred } from "./store";

/**
 * Gmail sync-in: pull recent messages and log the ones involving a known contact
 * onto that contact's timeline as email activities. Read-only (gmail.readonly).
 * Matching is by email address; direction is inferred from who sent it.
 *
 * The HTTP plumbing is thin; the mapping (header parsing, contact matching,
 * direction) lives in pure functions below so it's unit-testable without Google.
 */

const GMAIL = "https://gmail.googleapis.com/gmail/v1/users/me";

export interface GmailSyncResult {
  scanned: number;
  logged: number;
  matchedContacts: number;
}

// --- pure mappers (tested) --------------------------------------------------

export interface GmailHeader {
  name: string;
  value: string;
}
export interface GmailMessage {
  id: string;
  internalDate?: string; // epoch ms as string
  snippet?: string;
  payload?: { headers?: GmailHeader[] };
}

export function headerValue(headers: GmailHeader[] | undefined, name: string): string {
  return headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

/**
 * Map a Gmail message to a timeline activity, or null if it doesn't involve a
 * known contact. `contactsByEmail` maps lower-cased email → contactId; `self` is
 * the connected mailbox address (lower-cased), used to tell inbound from outbound.
 */
export function messageToActivity(
  msg: GmailMessage,
  contactsByEmail: Map<string, string>,
  self: string,
): Activity | null {
  const headers = msg.payload?.headers;
  const from = extractEmails(headerValue(headers, "From"))[0];
  const recipients = [
    ...extractEmails(headerValue(headers, "To")),
    ...extractEmails(headerValue(headers, "Cc")),
  ];

  let contactId: string | undefined;
  let direction: "inbound" | "outbound" | undefined;

  if (from && contactsByEmail.has(from)) {
    contactId = contactsByEmail.get(from);
    direction = "inbound";
  } else if (from === self.toLowerCase()) {
    const hit = recipients.find((e) => contactsByEmail.has(e));
    if (hit) {
      contactId = contactsByEmail.get(hit);
      direction = "outbound";
    }
  }
  if (!contactId) return null;

  const ts = msg.internalDate ? new Date(Number(msg.internalDate)) : new Date(0);
  return {
    id: `gmail:${msg.id}`,
    contactId,
    type: "email",
    timestamp: isNaN(ts.getTime()) ? new Date(0).toISOString() : ts.toISOString(),
    direction,
    subject: headerValue(headers, "Subject") || "(no subject)",
    body: msg.snippet ?? "",
  };
}

// --- HTTP + persistence -----------------------------------------------------

async function gmailGet<T>(path: string, accessToken: string): Promise<T> {
  const res = await fetch(`${GMAIL}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Gmail GET ${path} → ${res.status}: ${body.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

/** Pull recent Gmail messages and log contact-matched ones. */
export async function importGmail(): Promise<GmailSyncResult> {
  const accessToken = await getValidGoogleToken("gmail");
  const cred = await readCred("gmail");
  const self = cred?.accountEmail ?? "";
  const contacts = await contactEmailMap();

  const max = Number(process.env.GMAIL_MAX_MESSAGES ?? 50);
  const list = await gmailGet<{ messages?: { id: string }[] }>(
    `/messages?maxResults=${max}`,
    accessToken,
  );
  const ids = (list.messages ?? []).map((m) => m.id);

  const matched = new Set<string>();
  let logged = 0;
  for (const id of ids) {
    const msg = await gmailGet<GmailMessage>(
      `/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Cc&metadataHeaders=Subject&metadataHeaders=Date`,
      accessToken,
    );
    const activity = messageToActivity(msg, contacts, self);
    if (!activity) continue;
    await upsertActivity(activity);
    matched.add(activity.contactId);
    logged++;
  }

  if (logged > 0) invalidateSnapshot();
  return { scanned: ids.length, logged, matchedContacts: matched.size };
}

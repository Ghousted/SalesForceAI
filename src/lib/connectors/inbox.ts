import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { currentWorkspaceId } from "@/lib/tenant";
import * as t from "@/lib/db/schema";
import type { Activity } from "@/lib/data/types";

/**
 * Shared inbox/calendar sync plumbing — contact lookup by email and the
 * idempotent timeline upsert, used by every sync-in connector (Gmail, Outlook,
 * Calendar). Connector-specific mapping (header parsing, direction) stays in
 * each connector's own module; this is just the persistence seam.
 */

/** Pull bare email addresses out of a header like `"A B" <a@b.com>, c@d.com`. */
export function extractEmails(header: string): string[] {
  const out: string[] = [];
  const re = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(header)) !== null) out.push(m[0].toLowerCase());
  return out;
}

/** lower-cased contact email → contactId, for the current workspace. */
export async function contactEmailMap(): Promise<Map<string, string>> {
  const rows = await db
    .select({ id: t.contacts.id, email: t.contacts.email })
    .from(t.contacts)
    .where(eq(t.contacts.workspaceId, currentWorkspaceId()));
  const map = new Map<string, string>();
  for (const r of rows) if (r.email) map.set(r.email.toLowerCase(), r.id);
  return map;
}

/** Insert-or-refresh a synced activity (stable id ⇒ re-syncs don't duplicate). */
export async function upsertActivity(a: Activity): Promise<void> {
  await db
    .insert(t.activities)
    .values({
      id: a.id,
      workspaceId: currentWorkspaceId(),
      contactId: a.contactId,
      dealId: a.dealId ?? null,
      type: a.type,
      timestamp: a.timestamp,
      direction: a.direction ?? null,
      subject: a.subject,
      body: a.body,
      actorId: a.actorId ?? null,
    })
    .onConflictDoUpdate({
      target: t.activities.id,
      set: {
        timestamp: a.timestamp,
        direction: a.direction ?? null,
        subject: a.subject,
        body: a.body,
      },
    });
}

import { invalidateSnapshot } from "@/lib/data/spine";
import type { Activity } from "@/lib/data/types";
import { getValidGoogleToken } from "./google";
import { contactEmailMap, upsertActivity } from "./inbox";

/**
 * Google Calendar sync-in: pull recent + upcoming events and log the ones with a
 * known contact among the attendees onto that contact's timeline. Read-only
 * (calendar.readonly). This is how the Analyst and Auditor see meetings and
 * property viewings that really happened, not just emails.
 *
 * An event with two matched contacts lands on both timelines (stable per-contact
 * id ⇒ re-syncs don't duplicate).
 */

const CAL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

/** Real-estate viewings get their own activity type; everything else is a meeting. */
const VIEWING_HINT = /viewing|site visit|tour|ocular|walk.?through|open house|unit\b/i;

export interface CalSyncResult {
  scanned: number;
  logged: number;
  matchedContacts: number;
}

// --- pure mapper (tested without Google) -----------------------------------

interface GCalAttendee {
  email?: string;
}
export interface GCalEvent {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: { dateTime?: string; date?: string };
  attendees?: GCalAttendee[];
}

/**
 * One activity per matched attendee, or [] if none of the attendees is a known
 * contact. `contactsByEmail` maps lower-cased email → contactId.
 */
export function eventToActivities(
  ev: GCalEvent,
  contactsByEmail: Map<string, string>,
): Activity[] {
  const when = ev.start?.dateTime ?? ev.start?.date;
  const ts = when ? new Date(when) : new Date(0);
  const timestamp = isNaN(ts.getTime()) ? new Date(0).toISOString() : ts.toISOString();
  const haystack = `${ev.summary ?? ""} ${ev.location ?? ""}`;
  const type: Activity["type"] = VIEWING_HINT.test(haystack) ? "viewing" : "meeting";
  const body = ev.description || ev.location || "";

  const out: Activity[] = [];
  const seen = new Set<string>();
  for (const a of ev.attendees ?? []) {
    const email = a.email?.toLowerCase();
    if (!email) continue;
    const contactId = contactsByEmail.get(email);
    if (!contactId || seen.has(contactId)) continue;
    seen.add(contactId);
    out.push({
      id: `gcal:${ev.id}:${contactId}`,
      contactId,
      type,
      timestamp,
      subject: ev.summary || (type === "viewing" ? "Property viewing" : "Meeting"),
      body,
    });
  }
  return out;
}

// --- HTTP + persistence -----------------------------------------------------

async function calGet<T>(query: string, accessToken: string): Promise<T> {
  const res = await fetch(`${CAL}${query}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Calendar GET → ${res.status}: ${body.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

/** Pull recent/upcoming events and log contact-matched ones. */
export async function importCalendar(): Promise<CalSyncResult> {
  const accessToken = await getValidGoogleToken("google-calendar");
  const contacts = await contactEmailMap();

  const max = Number(process.env.GCAL_MAX_EVENTS ?? 50);
  const lookbackDays = Number(process.env.GCAL_LOOKBACK_DAYS ?? 90);
  const timeMin = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString();
  const q = new URLSearchParams({
    maxResults: String(max),
    singleEvents: "true",
    orderBy: "startTime",
    timeMin,
  });
  const list = await calGet<{ items?: GCalEvent[] }>(`?${q.toString()}`, accessToken);
  const events = list.items ?? [];

  const matched = new Set<string>();
  let logged = 0;
  for (const ev of events) {
    for (const activity of eventToActivities(ev, contacts)) {
      await upsertActivity(activity);
      matched.add(activity.contactId);
      logged++;
    }
  }

  if (logged > 0) invalidateSnapshot();
  return { scanned: events.length, logged, matchedContacts: matched.size };
}

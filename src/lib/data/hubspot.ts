import type {
  Activity,
  ActivityType,
  Company,
  Contact,
  CrmSnapshot,
  Deal,
  DealStage,
  Rep,
} from "./types";

/**
 * HubSpot CRM v3 read adapter (PRD §8 — live integration phase).
 *
 * Reads owners, companies, contacts, deals and activities and maps them into
 * the same `CrmSnapshot` the synthetic pack produces, so every agent works
 * unchanged. **Read-only** — honoring the guardrail that agents propose and
 * humans approve any write (writes are a later, gated slice).
 *
 * Auth: a HubSpot Private App access token in `HUBSPOT_ACCESS_TOKEN`.
 * Required scopes: crm.objects.contacts.read, crm.objects.companies.read,
 * crm.objects.deals.read, crm.objects.owners.read, and the activity scopes
 * (crm.objects.{emails,calls,meetings,notes}.read / sales-email-read).
 */

const BASE = process.env.HUBSPOT_BASE_URL ?? "https://api.hubapi.com";

/**
 * The token in force for the current fetch. The connector layer can pass a token
 * stored per-workspace (`fetchHubSpotSnapshot(token)`); otherwise we fall back to
 * the env var. Set only for the duration of one snapshot fetch, so concurrent
 * sub-requests in that fetch share it safely.
 */
let tokenOverride: string | undefined;
function currentToken(): string {
  return tokenOverride ?? process.env.HUBSPOT_ACCESS_TOKEN ?? "";
}

export function hubspotConfigured(): boolean {
  return Boolean(currentToken());
}

function authHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${currentToken()}`,
    "Content-Type": "application/json",
  };
}

// --- low-level paginated GET ------------------------------------------------

interface HsObject {
  id: string;
  properties: Record<string, string | null>;
  associations?: Record<string, { results?: { id: string }[] }>;
}

async function hsGetAll(
  path: string,
  params: Record<string, string>,
  cap = 1000,
): Promise<HsObject[]> {
  const out: HsObject[] = [];
  let after: string | undefined;
  do {
    const q = new URLSearchParams({ ...params, limit: "100" });
    if (after) q.set("after", after);
    const res = await fetch(`${BASE}${path}?${q.toString()}`, {
      headers: authHeaders(),
      // Always hit HubSpot; our own TTL cache lives in the spine.
      cache: "no-store",
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`HubSpot GET ${path} → ${res.status}: ${body.slice(0, 300)}`);
    }
    const json = (await res.json()) as {
      results?: HsObject[];
      paging?: { next?: { after?: string } };
    };
    out.push(...(json.results ?? []));
    after = json.paging?.next?.after;
  } while (after && out.length < cap);
  return out;
}

/** First associated id of a given kind, if any. */
function firstAssoc(obj: HsObject, kind: string): string | undefined {
  return obj.associations?.[kind]?.results?.[0]?.id;
}

// --- mapping helpers --------------------------------------------------------

/** Strip HTML, decode a few common entities, collapse whitespace, truncate. */
function plain(html: string | null | undefined, max = 600): string {
  if (!html) return "";
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function toIso(v: string | null | undefined): string {
  if (!v) return new Date(0).toISOString();
  // HubSpot returns ISO strings or epoch-ms; Date handles both.
  const d = new Date(/^\d+$/.test(v) ? Number(v) : v);
  return isNaN(d.getTime()) ? new Date(0).toISOString() : d.toISOString();
}

/** Map a HubSpot stage label or internal id to our pipeline stage. */
function mapStage(stageLabelOrId: string): DealStage {
  const s = stageLabelOrId.toLowerCase();
  if (/closed.?won|closedwon/.test(s)) return "closed-won";
  if (/closed.?lost|closedlost/.test(s)) return "closed-lost";
  if (/reserv|contract|deposit|booked/.test(s)) return "reservation";
  if (/proposal|quote|present|decision|negoti/.test(s)) return "proposal";
  if (/viewing|appointment|tour|site visit|scheduled/.test(s)) return "viewing-scheduled";
  if (/qualif/.test(s)) return "qualifying";
  return "new";
}

/** Rep-confidence 0–100: prefer HubSpot's probability, else derive from stage. */
function mapConfidence(probability: string | null, stage: DealStage): number {
  if (probability != null && probability !== "") {
    const p = Number(probability);
    if (!isNaN(p)) return Math.round((p <= 1 ? p * 100 : p));
  }
  const byStage: Record<DealStage, number> = {
    new: 15,
    qualifying: 35,
    "viewing-scheduled": 50,
    proposal: 65,
    reservation: 85,
    "closed-won": 100,
    "closed-lost": 0,
  };
  return byStage[stage];
}

// --- per-object fetch + map -------------------------------------------------

async function loadReps(): Promise<Rep[]> {
  // The owners endpoint has its own shape (no `properties` envelope).
  const res = await fetch(`${BASE}/crm/v3/owners?limit=100`, {
    headers: authHeaders(),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HubSpot owners → ${res.status}`);
  const json = (await res.json()) as {
    results?: { id: string; firstName?: string; lastName?: string; email?: string }[];
  };
  return (json.results ?? []).map((o) => ({
    id: String(o.id),
    name: `${o.firstName ?? ""} ${o.lastName ?? ""}`.trim() || o.email || `Owner ${o.id}`,
    role: "rep" as const,
  }));
}

async function loadCompanies(): Promise<Company[]> {
  const rows = await hsGetAll("/crm/v3/objects/companies", {
    properties: "name,industry,city,state,description",
  });
  return rows.map((r) => {
    const p = r.properties;
    const location = [p.city, p.state].filter(Boolean).join(", ");
    return {
      id: r.id,
      name: p.name ?? "(unnamed company)",
      industry: p.industry ?? "—",
      location: location || "—",
      notes: p.description ?? undefined,
    };
  });
}

async function loadContacts(): Promise<Contact[]> {
  const rows = await hsGetAll("/crm/v3/objects/contacts", {
    properties: "firstname,lastname,jobtitle,email,phone,hubspot_owner_id,salesos_persona",
    associations: "companies",
  });
  return rows.map((r) => {
    const p = r.properties;
    return {
      id: r.id,
      firstName: p.firstname ?? "",
      lastName: p.lastname ?? "",
      title: p.jobtitle ?? "—",
      companyId: firstAssoc(r, "companies") ?? "",
      email: p.email ?? "",
      phone: p.phone ?? "",
      // `salesos_persona` is an optional custom property; empty if not defined.
      persona: p.salesos_persona ?? "",
      ownerRepId: p.hubspot_owner_id ?? "",
    };
  });
}

async function loadDeals(): Promise<Deal[]> {
  const rows = await hsGetAll("/crm/v3/objects/deals", {
    properties:
      "dealname,dealstage,amount,closedate,hubspot_owner_id,hs_deal_stage_probability,salesos_property",
    associations: "contacts,companies",
  });
  return rows.map((r) => {
    const p = r.properties;
    const stage = mapStage(p.dealstage ?? "");
    return {
      id: r.id,
      name: p.dealname ?? "(unnamed deal)",
      contactId: firstAssoc(r, "contacts") ?? "",
      companyId: firstAssoc(r, "companies") ?? "",
      stage,
      amount: Number(p.amount ?? 0) || 0,
      // No native "product of interest" field — use a custom prop or the name.
      property: p.salesos_property ?? p.dealname ?? "",
      expectedCloseDate: toIso(p.closedate),
      ownerRepId: p.hubspot_owner_id ?? "",
      repConfidence: mapConfidence(p.hs_deal_stage_probability, stage),
    };
  });
}

interface ActivitySpec {
  object: string;
  type: ActivityType;
  properties: string;
  map: (p: Record<string, string | null>) => {
    subject: string;
    body: string;
    direction?: "inbound" | "outbound";
  };
}

const ACTIVITY_SPECS: ActivitySpec[] = [
  {
    object: "emails",
    type: "email",
    properties: "hs_timestamp,hs_email_subject,hs_email_text,hs_email_direction",
    map: (p) => ({
      subject: p.hs_email_subject ?? "Email",
      body: plain(p.hs_email_text),
      direction: /incoming/i.test(p.hs_email_direction ?? "") ? "inbound" : "outbound",
    }),
  },
  {
    object: "calls",
    type: "call",
    properties: "hs_timestamp,hs_call_title,hs_call_body,hs_call_direction",
    map: (p) => ({
      subject: p.hs_call_title ?? "Call",
      body: plain(p.hs_call_body),
      direction: /inbound/i.test(p.hs_call_direction ?? "") ? "inbound" : "outbound",
    }),
  },
  {
    object: "meetings",
    type: "meeting",
    properties: "hs_timestamp,hs_meeting_title,hs_meeting_body",
    map: (p) => ({
      subject: p.hs_meeting_title ?? "Meeting",
      body: plain(p.hs_meeting_body),
    }),
  },
  {
    object: "notes",
    type: "note",
    properties: "hs_timestamp,hs_note_body",
    map: (p) => ({ subject: "Note", body: plain(p.hs_note_body) }),
  },
];

async function loadActivities(): Promise<Activity[]> {
  const all: Activity[] = [];
  for (const spec of ACTIVITY_SPECS) {
    const rows = await hsGetAll(`/crm/v3/objects/${spec.object}`, {
      properties: spec.properties,
      associations: "contacts,deals",
    });
    for (const r of rows) {
      const contactId = firstAssoc(r, "contacts");
      if (!contactId) continue; // activities not tied to a person aren't useful here
      const m = spec.map(r.properties);
      all.push({
        id: `${spec.object}:${r.id}`,
        contactId,
        dealId: firstAssoc(r, "deals"),
        type: spec.type,
        timestamp: toIso(r.properties.hs_timestamp),
        direction: m.direction,
        subject: m.subject,
        body: m.body,
      });
    }
  }
  return all;
}

// --- writes (gated; see src/lib/actions) ------------------------------------

async function hubspotPatch(
  object: string,
  id: string,
  properties: Record<string, string>,
): Promise<void> {
  const res = await fetch(`${BASE}/crm/v3/objects/${object}/${id}`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ properties }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `HubSpot PATCH ${object}/${id} → ${res.status}: ${body.slice(0, 200)}`,
    );
  }
}

/**
 * Run `fn` with a per-workspace token in force (the connector write-back path).
 * Same override mechanism `fetchHubSpotSnapshot` uses for reads.
 */
export async function withHubSpotToken<T>(token: string, fn: () => Promise<T>): Promise<T> {
  const prev = tokenOverride;
  tokenOverride = token;
  try {
    return await fn();
  } finally {
    tokenOverride = prev;
  }
}

/** Assign a contact to an owner. Needs the `crm.objects.contacts.write` scope. */
export async function hubspotSetContactOwner(
  contactId: string,
  ownerId: string,
): Promise<void> {
  await hubspotPatch("contacts", contactId, { hubspot_owner_id: ownerId });
}

/** Inverse of `mapStage` — our pipeline stage → HubSpot's default-pipeline id. */
const STAGE_TO_HUBSPOT: Record<DealStage, string> = {
  new: "appointmentscheduled",
  qualifying: "qualifiedtobuy",
  "viewing-scheduled": "presentationscheduled",
  proposal: "decisionmakerboughtin",
  reservation: "contractsent",
  "closed-won": "closedwon",
  "closed-lost": "closedlost",
};

/** Patch a deal's core properties. Needs `crm.objects.deals.write`. */
export async function hubspotUpdateDeal(
  dealId: string,
  patch: { name?: string; stage?: DealStage; amount?: number; expectedCloseDate?: string },
): Promise<void> {
  const props: Record<string, string> = {};
  if (patch.name) props.dealname = patch.name;
  if (patch.stage) props.dealstage = STAGE_TO_HUBSPOT[patch.stage];
  if (patch.amount !== undefined) props.amount = String(patch.amount);
  if (patch.expectedCloseDate) props.closedate = patch.expectedCloseDate;
  if (Object.keys(props).length > 0) await hubspotPatch("deals", dealId, props);
}

/** Patch a contact's core properties. Needs `crm.objects.contacts.write`. */
export async function hubspotUpdateContact(
  contactId: string,
  patch: { firstName?: string; lastName?: string; email?: string; phone?: string; title?: string },
): Promise<void> {
  const props: Record<string, string> = {};
  if (patch.firstName) props.firstname = patch.firstName;
  if (patch.lastName) props.lastname = patch.lastName;
  if (patch.email) props.email = patch.email;
  if (patch.phone) props.phone = patch.phone;
  if (patch.title) props.jobtitle = patch.title;
  if (Object.keys(props).length > 0) await hubspotPatch("contacts", contactId, props);
}

/**
 * Log a note on a contact's timeline. Needs `crm.objects.notes.write`.
 * Note→Contact association typeId is 202.
 */
export async function hubspotLogNote(
  contactId: string,
  subject: string,
  body: string,
): Promise<void> {
  const res = await fetch(`${BASE}/crm/v3/objects/notes`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      properties: {
        hs_timestamp: new Date().toISOString(),
        hs_note_body: body ? `${subject}\n\n${body}` : subject,
      },
      associations: [
        {
          to: { id: contactId },
          types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 202 }],
        },
      ],
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`HubSpot log note → ${res.status}: ${t.slice(0, 200)}`);
  }
}

/**
 * Log an outbound email on a contact's timeline (does NOT transmit — wiring a
 * connected inbox for real send is a deliberate later step). Needs the
 * `crm.objects.emails.write` scope. Email→Contact association typeId is 198.
 */
export async function hubspotLogEmail(
  contactId: string,
  subject: string,
  body: string,
): Promise<void> {
  const res = await fetch(`${BASE}/crm/v3/objects/emails`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      properties: {
        hs_timestamp: new Date().toISOString(),
        hs_email_subject: subject,
        hs_email_text: body,
        hs_email_direction: "EMAIL", // logged outbound
      },
      associations: [
        {
          to: { id: contactId },
          types: [
            { associationCategory: "HUBSPOT_DEFINED", associationTypeId: 198 },
          ],
        },
      ],
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`HubSpot log email → ${res.status}: ${t.slice(0, 200)}`);
  }
}

/**
 * Fetch the full snapshot from HubSpot. Throws on any API failure. Pass a `token`
 * to use a per-workspace connector credential instead of the env var.
 */
export async function fetchHubSpotSnapshot(token?: string): Promise<CrmSnapshot> {
  const prev = tokenOverride;
  if (token) tokenOverride = token;
  try {
    if (!hubspotConfigured()) {
      throw new Error("No HubSpot access token provided");
    }
    const [reps, companies, contacts, deals, activities] = await Promise.all([
      loadReps(),
      loadCompanies(),
      loadContacts(),
      loadDeals(),
      loadActivities(),
    ]);
    return { reps, companies, contacts, deals, activities };
  } finally {
    tokenOverride = prev;
  }
}

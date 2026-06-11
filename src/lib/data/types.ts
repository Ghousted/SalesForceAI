/**
 * CRM data model for the shared data spine.
 *
 * These types mirror the shape of a HubSpot-class CRM (companies, contacts,
 * deals, activities) so that the same agents can later read/write against the
 * live CRM API. In Phase 1 the spine is fed by a synthetic, sanitized data pack
 * (no live PII) — see ./synthetic.ts.
 */

export type DealStage =
  | "new"
  | "qualifying"
  | "viewing-scheduled"
  | "proposal"
  | "reservation"
  | "closed-won"
  | "closed-lost";

export const DEAL_STAGE_LABELS: Record<DealStage, string> = {
  new: "New enquiry",
  qualifying: "Qualifying",
  "viewing-scheduled": "Viewing scheduled",
  proposal: "Proposal sent",
  reservation: "Reservation",
  "closed-won": "Closed — won",
  "closed-lost": "Closed — lost",
};

export type ActivityType = "email" | "call" | "meeting" | "note" | "viewing";

export interface Company {
  id: string;
  name: string;
  industry: string;
  location: string;
  notes?: string;
}

export interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  title: string;
  companyId: string;
  email: string;
  phone: string;
  /** A short persona sketch the synthetic pack ships with. */
  persona: string;
  /** Owning sales rep (seat in Sales OS). */
  ownerRepId: string;
}

export interface Deal {
  id: string;
  name: string;
  contactId: string;
  companyId: string;
  stage: DealStage;
  /** Amount in PHP. */
  amount: number;
  /** Product / property of interest. */
  property: string;
  expectedCloseDate: string; // ISO date
  ownerRepId: string;
  /** Rep's own confidence 0–100; Auditor later checks this against reality. */
  repConfidence: number;
}

export interface Activity {
  id: string;
  contactId: string;
  dealId?: string;
  type: ActivityType;
  /** ISO datetime. */
  timestamp: string;
  direction?: "inbound" | "outbound";
  subject: string;
  body: string;
  /** Which agent created this (e.g. "scribe"); undefined → a human logged it. */
  actorId?: string;
}

export interface Rep {
  id: string;
  name: string;
  role: "rep" | "manager";
}

export interface CrmSnapshot {
  reps: Rep[];
  companies: Company[];
  contacts: Contact[];
  deals: Deal[];
  activities: Activity[];
}

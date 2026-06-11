import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

/**
 * The system of record.
 *
 * Sales OS now owns its data (it is no longer a read-through to HubSpot). Tables
 * mirror the shapes in `src/lib/data/types.ts` so the agents' `CrmSnapshot`
 * maps 1:1. Every row carries `workspaceId` — single workspace today, but the
 * schema is multi-tenant-ready for the SaaS phase.
 *
 * Timestamps are ISO strings (matching the existing in-code usage); money and
 * confidence are integers.
 */

export const workspaces = sqliteTable("workspaces", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: text("created_at").notNull(),
  // Getting-started guide state: JSON {dismissed?: bool, manual?: string[]}.
  setupState: text("setup_state"),
});

export const reps = sqliteTable("reps", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull(), // "rep" | "manager"
});

export const companies = sqliteTable("companies", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  name: text("name").notNull(),
  industry: text("industry").notNull(),
  location: text("location").notNull(),
  notes: text("notes"),
});

export const contacts = sqliteTable("contacts", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  title: text("title").notNull(),
  companyId: text("company_id").notNull().default(""),
  email: text("email").notNull().default(""),
  phone: text("phone").notNull().default(""),
  persona: text("persona").notNull().default(""),
  ownerRepId: text("owner_rep_id").notNull().default(""),
});

export const deals = sqliteTable("deals", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  name: text("name").notNull(),
  contactId: text("contact_id").notNull().default(""),
  companyId: text("company_id").notNull().default(""),
  stage: text("stage").notNull(), // DealStage
  amount: integer("amount").notNull().default(0),
  property: text("property").notNull().default(""),
  expectedCloseDate: text("expected_close_date").notNull(),
  ownerRepId: text("owner_rep_id").notNull().default(""),
  repConfidence: integer("rep_confidence").notNull().default(0),
});

export const activities = sqliteTable("activities", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  contactId: text("contact_id").notNull(),
  dealId: text("deal_id"),
  type: text("type").notNull(), // ActivityType
  timestamp: text("timestamp").notNull(),
  direction: text("direction"), // "inbound" | "outbound" | null
  subject: text("subject").notNull(),
  body: text("body").notNull().default(""),
  actorId: text("actor_id"), // agent id that created it; null → human
});

// --- automation state (was in-memory globalThis stores) --------------------

export const actions = sqliteTable("actions", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  agentId: text("agent_id").notNull(),
  kind: text("kind").notNull(),
  title: text("title").notNull(),
  detail: text("detail").notNull(),
  targetKind: text("target_kind").notNull(),
  targetId: text("target_id").notNull(),
  targetLabel: text("target_label").notNull(),
  payload: text("payload").notNull().default("{}"), // JSON
  status: text("status").notNull(),
  autonomy: text("autonomy").notNull(),
  createdAt: text("created_at").notNull(),
  resolvedAt: text("resolved_at"),
  error: text("error"),
});

export const triggerState = sqliteTable("trigger_state", {
  id: text("id").primaryKey(), // triggerId
  workspaceId: text("workspace_id").notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull(),
  lastRunAt: text("last_run_at"),
});

export const triggerRuns = sqliteTable("trigger_runs", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  triggerId: text("trigger_id").notNull(),
  agentId: text("agent_id").notNull(),
  at: text("at").notNull(),
  status: text("status").notNull(),
  summary: text("summary").notNull(),
  actionsCreated: integer("actions_created"),
});

// --- agent configuration (Phase D) -----------------------------------------

export const agentConfig = sqliteTable("agent_config", {
  id: text("id").primaryKey(), // agentId (single-workspace for now)
  workspaceId: text("workspace_id").notNull(),
  displayName: text("display_name"), // null → registry name
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  autonomy: text("autonomy"), // "ask" | "auto" | null → policy default
  funnel: text("funnel"), // JSON {segment, routeTo} — where the agent acts; null → default lane
});

// --- auth (users + sessions) ------------------------------------------------

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  email: text("email").notNull(), // unique (enforced in app)
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(), // scrypt: salt:hash
  repId: text("rep_id"), // optional seat in the book
  role: text("role").notNull().default("rep"), // "rep" | "manager"
  // Has this user been through the post-signup welcome flow?
  welcomeDone: integer("welcome_done", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull(),
});

export const invites = sqliteTable("invites", {
  id: text("id").primaryKey(), // opaque token (also the invite-link value)
  workspaceId: text("workspace_id").notNull(),
  email: text("email"), // optional: lock the invite to one address
  role: text("role").notNull().default("rep"), // "rep" | "manager"
  invitedBy: text("invited_by").notNull(), // userId of the inviter
  createdAt: text("created_at").notNull(),
  expiresAt: text("expires_at").notNull(),
  acceptedBy: text("accepted_by"), // userId once redeemed (single-use)
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(), // opaque token (also the cookie value)
  userId: text("user_id").notNull(),
  workspaceId: text("workspace_id").notNull(),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull(),
});

// --- connectors (stub for Phase B) -----------------------------------------

export const connectorCredentials = sqliteTable("connector_credentials", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  kind: text("kind").notNull(), // "email" | "calendar" | "hubspot"
  data: text("data").notNull().default("{}"), // JSON (tokens etc.)
  createdAt: text("created_at").notNull(),
});

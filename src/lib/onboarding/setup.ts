import { and, eq, ne, notLike, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import * as t from "@/lib/db/schema";
import { currentWorkspaceId } from "@/lib/tenant";
import { readCred } from "@/lib/connectors/store";

/**
 * The getting-started guide (HubSpot-style "Setup guide"): a fixed checklist
 * whose completion is DETECTED from what's actually in the workspace, not
 * ticked by hand — adding your first contact completes "Add a contact" whether
 * or not you ever open the guide. Steps can also be marked done manually
 * ("mark as complete") and the whole guide can be dismissed; both persist on
 * `workspaces.setup_state`.
 *
 * Sample (`smpl_`) rows never count — demo data shouldn't fake progress.
 */

export interface SetupStep {
  id: string;
  title: string;
  body: string;
  /** Where the step's CTA points. */
  href: string;
  cta: string;
  done: boolean;
  optional?: boolean;
}

export interface SetupStatus {
  steps: SetupStep[];
  completed: number;
  total: number;
  percent: number;
  dismissed: boolean;
  /** Show the guide in nav/dashboard: not dismissed and not fully complete. */
  show: boolean;
}

interface SetupState {
  dismissed?: boolean;
  manual?: string[];
}

async function readState(ws: string): Promise<SetupState> {
  const rows = await db
    .select({ setupState: t.workspaces.setupState })
    .from(t.workspaces)
    .where(eq(t.workspaces.id, ws));
  try {
    return rows[0]?.setupState ? (JSON.parse(rows[0].setupState) as SetupState) : {};
  } catch {
    return {};
  }
}

export async function patchSetupState(patch: {
  dismissed?: boolean;
  markDone?: string;
  markUndone?: string;
}): Promise<void> {
  const ws = currentWorkspaceId();
  const state = await readState(ws);
  if (patch.dismissed !== undefined) state.dismissed = patch.dismissed;
  if (patch.markDone) state.manual = [...new Set([...(state.manual ?? []), patch.markDone])];
  if (patch.markUndone) state.manual = (state.manual ?? []).filter((id) => id !== patch.markUndone);
  await db
    .update(t.workspaces)
    .set({ setupState: JSON.stringify(state) })
    .where(eq(t.workspaces.id, ws));
}

const NOT_SAMPLE = "smpl_%";

async function count(q: Promise<{ n: number }[]>): Promise<number> {
  return (await q)[0]?.n ?? 0;
}

/** Compute every step's detected completion for the current workspace. */
export async function getSetupStatus(): Promise<SetupStatus> {
  const ws = currentWorkspaceId();
  const state = await readState(ws);
  const manual = new Set(state.manual ?? []);

  const [contacts, deals, members, invites, runs, approvals, hubspot, gmail, outlook] =
    await Promise.all([
      count(
        db.select({ n: sql<number>`count(*)` }).from(t.contacts)
          .where(and(eq(t.contacts.workspaceId, ws), notLike(t.contacts.id, NOT_SAMPLE))),
      ),
      count(
        db.select({ n: sql<number>`count(*)` }).from(t.deals)
          .where(and(eq(t.deals.workspaceId, ws), notLike(t.deals.id, NOT_SAMPLE))),
      ),
      count(
        db.select({ n: sql<number>`count(*)` }).from(t.users)
          .where(eq(t.users.workspaceId, ws)),
      ),
      count(
        db.select({ n: sql<number>`count(*)` }).from(t.invites)
          .where(eq(t.invites.workspaceId, ws)),
      ),
      count(
        db.select({ n: sql<number>`count(*)` }).from(t.triggerRuns)
          .where(eq(t.triggerRuns.workspaceId, ws)),
      ),
      count(
        db.select({ n: sql<number>`count(*)` }).from(t.actions)
          .where(and(eq(t.actions.workspaceId, ws), ne(t.actions.status, "proposed"))),
      ),
      readCred("hubspot"),
      readCred("gmail"),
      readCred("outlook"),
    ]);

  const detected: Record<string, boolean> = {
    "create-account": true, // you're here — instant first tick, like HubSpot
    "add-contact": contacts > 0,
    "create-deal": deals > 0,
    "import-crm": Boolean(hubspot?.connected),
    "connect-inbox": Boolean(gmail?.connected || outlook?.connected),
    "invite-team": members > 1 || invites > 0,
    "agents-at-work": runs > 0,
    "first-approval": approvals > 0,
  };

  const defs: Omit<SetupStep, "done">[] = [
    {
      id: "create-account",
      title: "Create your account",
      body: "Your workspace is live and your agent team is standing by.",
      href: "/settings",
      cta: "View workspace",
    },
    {
      id: "add-contact",
      title: "Add your first contact",
      body: "Contacts are who the agents watch — every brief, follow-up and flag hangs off one.",
      href: "/contacts",
      cta: "Add a contact",
    },
    {
      id: "create-deal",
      title: "Track your first deal",
      body: "Put a deal in the pipeline so the Auditor and Forecaster have something to reconcile.",
      href: "/deals",
      cta: "Create a deal",
    },
    {
      id: "import-crm",
      title: "Import your existing CRM",
      body: "Already on HubSpot? Bring contacts, companies, deals and history over in one click.",
      href: "/connectors",
      cta: "Connect HubSpot",
      optional: true,
    },
    {
      id: "connect-inbox",
      title: "Connect your inbox",
      body: "Sync Gmail or Outlook so real conversations land on each contact's timeline automatically.",
      href: "/connectors",
      cta: "Connect inbox",
    },
    {
      id: "invite-team",
      title: "Invite your team",
      body: "Each teammate gets a seat on the floor — the Dispatcher routes leads across everyone.",
      href: "/settings",
      cta: "Send an invite",
    },
    {
      id: "agents-at-work",
      title: "Put your agents to work",
      body: "Automations run the Dispatcher, Auditor and Forecaster on a schedule — watch them live.",
      href: "/oversight",
      cta: "Open oversight",
    },
    {
      id: "first-approval",
      title: "Approve your first agent action",
      body: "Agents propose, you decide. Approve a routing or a drafted follow-up from your inbox.",
      href: "/app",
      cta: "Open dashboard",
    },
  ];

  const steps: SetupStep[] = defs.map((d) => ({
    ...d,
    done: detected[d.id] || manual.has(d.id),
  }));

  const completed = steps.filter((s) => s.done).length;
  const total = steps.length;
  const percent = Math.round((completed / total) * 100);
  const dismissed = Boolean(state.dismissed);

  return {
    steps,
    completed,
    total,
    percent,
    dismissed,
    show: !dismissed && completed < total,
  };
}

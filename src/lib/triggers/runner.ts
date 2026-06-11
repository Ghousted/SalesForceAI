import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { currentWorkspaceId, runInWorkspace } from "@/lib/tenant";
import * as t from "@/lib/db/schema";
import { ensureSnapshot } from "@/lib/data/spine";
import { runDispatcher, dispatcherStatus } from "@/agents/dispatcher";
import { runAuditor } from "@/agents/auditor";
import { chainFromAudit } from "@/agents/chain";
import { runForecaster } from "@/agents/forecaster";
import { php } from "@/lib/format";
import { ensureAgentConfig, agentEnabled } from "@/lib/agents/config";
import { TRIGGERS, getTriggerDef } from "./registry";
import type { TriggerDef, TriggerRun, TriggerView } from "./types";

/**
 * The trigger runner — evaluates triggers and fires the due ones.
 *
 * Trigger state (enabled, lastRunAt) and the run-log are **DB-backed** so they
 * persist across restarts and work on serverless (where a Vercel Cron drives
 * `/api/triggers/tick`). Only the process-local scheduler/ticking flags live in
 * memory.
 */

const proc = globalThis as unknown as { __salesosSched?: { started: boolean; ticking: boolean } };
const local = (proc.__salesosSched ??= { started: false, ticking: false });

// --- DB state helpers -------------------------------------------------------

// The PK is global across tenants, so the row id carries the workspace —
// a bare triggerId would collide the moment a second workspace ticks.
function stateId(triggerId: string): string {
  return `${currentWorkspaceId()}:${triggerId}`;
}

async function getState(def: TriggerDef): Promise<{ enabled: boolean; lastRunAt: string | null }> {
  const rows = await db.select().from(t.triggerState).where(and(eq(t.triggerState.id, stateId(def.id)), eq(t.triggerState.workspaceId, currentWorkspaceId())));
  if (rows[0]) return { enabled: rows[0].enabled, lastRunAt: rows[0].lastRunAt };
  await db.insert(t.triggerState).values({ id: stateId(def.id), workspaceId: currentWorkspaceId(), enabled: def.defaultEnabled, lastRunAt: null });
  return { enabled: def.defaultEnabled, lastRunAt: null };
}

async function setLastRun(id: string, at: string): Promise<void> {
  await db.update(t.triggerState).set({ lastRunAt: at }).where(and(eq(t.triggerState.id, stateId(id)), eq(t.triggerState.workspaceId, currentWorkspaceId())));
}

async function record(run: TriggerRun): Promise<TriggerRun> {
  await db.insert(t.triggerRuns).values({
    id: run.id, workspaceId: currentWorkspaceId(), triggerId: run.triggerId, agentId: run.agentId,
    at: run.at, status: run.status, summary: run.summary, actionsCreated: run.actionsCreated ?? null,
  });
  return run;
}

// --- running ----------------------------------------------------------------

export async function runTrigger(def: TriggerDef): Promise<TriggerRun> {
  const base = { id: crypto.randomUUID(), triggerId: def.id, agentId: def.agentId, at: new Date().toISOString() };
  try {
    await ensureSnapshot();
    let summary = "";
    let actionsCreated: number | undefined;
    switch (def.agentId) {
      case "dispatcher": {
        const r = await runDispatcher();
        summary = r.data.message;
        actionsCreated = r.data.awaitingApproval + r.data.autoExecuted;
        break;
      }
      case "auditor": {
        const r = await runAuditor();
        // Hand actionable flags to the team: Scribe drafts replies for quiet/
        // unanswered deals; stage mismatches become update-stage proposals.
        const chained = await chainFromAudit(r.data.deals);
        const proposed = chained.drafts + chained.stageFixes;
        summary =
          `${r.data.totalFlags} flags · gap ${php(r.data.optimismGap)}` +
          (proposed > 0
            ? ` · queued ${chained.drafts} draft${chained.drafts === 1 ? "" : "s"}, ${chained.stageFixes} stage fix${chained.stageFixes === 1 ? "" : "es"}`
            : "");
        actionsCreated = proposed || undefined;
        break;
      }
      case "forecaster": {
        const r = await runForecaster();
        summary = `${r.data.targetMonthLabel}: ${php(r.data.headline.evidenceWeighted)} (evidence)`;
        break;
      }
      default:
        summary = "No runner for this agent.";
    }
    await setLastRun(def.id, base.at);
    return record({ ...base, status: "ok", summary, actionsCreated });
  } catch (err) {
    await setLastRun(def.id, base.at);
    return record({ ...base, status: "error", summary: err instanceof Error ? err.message : String(err) });
  }
}

async function eventReady(def: TriggerDef): Promise<boolean> {
  if (def.event === "new-lead") {
    await ensureSnapshot();
    return dispatcherStatus().newLeads > 0;
  }
  return true;
}

/** One workspace's pass: evaluate its triggers and fire the due ones. */
async function tickWorkspace(force: boolean, fired: TriggerRun[]): Promise<void> {
  await ensureAgentConfig();
  const now = Date.now();
  for (const def of TRIGGERS) {
    if (!agentEnabled(def.agentId)) continue; // a paused agent doesn't fire
    const st = await getState(def);
    if (!st.enabled) continue;
    const due = force || !st.lastRunAt || now - Date.parse(st.lastRunAt) >= def.intervalMs;
    if (!due) continue;
    if (def.type === "event" && !(await eventReady(def))) continue;
    fired.push(await runTrigger(def));
  }
}

/**
 * The clock pulse — per-tenant: every workspace gets its own trigger pass, run
 * inside its tenant context so state, run-log, and agent reads all stay scoped.
 * One workspace's failure doesn't stall the others.
 */
export async function tick(force = false): Promise<TriggerRun[]> {
  if (local.ticking) return [];
  local.ticking = true;
  const fired: TriggerRun[] = [];
  try {
    const workspaces = await db.select({ id: t.workspaces.id }).from(t.workspaces);
    for (const ws of workspaces) {
      try {
        await runInWorkspace(ws.id, () => tickWorkspace(force, fired));
      } catch (err) {
        // One tenant's failure must not stall the floor — log and move on.
        console.warn(`[triggers] tick failed for ${ws.id}:`, err instanceof Error ? err.message : err);
      }
    }
  } finally {
    local.ticking = false;
  }
  return fired;
}

export function ensureScheduler(): void {
  if (local.started) return;
  if (process.env.NEXT_RUNTIME && process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.TRIGGERS_AUTORUN === "false") return;
  local.started = true;
  const baseMs = Number(process.env.TRIGGER_TICK_MS ?? 60_000);
  setTimeout(() => void tick().catch(() => {}), 4000);
  setInterval(() => void tick().catch(() => {}), baseMs);
}

// --- read helpers for the API/UI -------------------------------------------

export async function listTriggers(): Promise<TriggerView[]> {
  const out: TriggerView[] = [];
  for (const def of TRIGGERS) {
    const st = await getState(def);
    out.push({ ...def, enabled: st.enabled, lastRunAt: st.lastRunAt ?? undefined });
  }
  return out;
}

export async function recentRuns(limit = 20): Promise<TriggerRun[]> {
  const rows = await db
    .select().from(t.triggerRuns)
    .where(eq(t.triggerRuns.workspaceId, currentWorkspaceId()))
    .orderBy(desc(t.triggerRuns.at))
    .limit(limit);
  return rows.map((r) => ({
    id: r.id, triggerId: r.triggerId, agentId: r.agentId, at: r.at,
    status: r.status as TriggerRun["status"], summary: r.summary,
    actionsCreated: r.actionsCreated ?? undefined,
  }));
}

export function schedulerRunning(): boolean {
  return local.started;
}

export async function setEnabled(id: string, enabled: boolean): Promise<TriggerView | undefined> {
  const def = getTriggerDef(id);
  if (!def) return undefined;
  await getState(def); // ensure row exists
  await db.update(t.triggerState).set({ enabled }).where(and(eq(t.triggerState.id, stateId(id)), eq(t.triggerState.workspaceId, currentWorkspaceId())));
  const st = await getState(def);
  return { ...def, enabled: st.enabled, lastRunAt: st.lastRunAt ?? undefined };
}

export async function runNow(id: string): Promise<TriggerRun | undefined> {
  const def = getTriggerDef(id);
  if (!def) return undefined;
  return runTrigger(def);
}

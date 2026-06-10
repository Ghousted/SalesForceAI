import { and, desc, eq } from "drizzle-orm";
import { db, DEFAULT_WORKSPACE_ID } from "@/lib/db/client";
import * as t from "@/lib/db/schema";
import { ensureSnapshot } from "@/lib/data/spine";
import { runDispatcher, dispatcherStatus } from "@/agents/dispatcher";
import { runAuditor } from "@/agents/auditor";
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

const WS = DEFAULT_WORKSPACE_ID;
const proc = globalThis as unknown as { __salesosSched?: { started: boolean; ticking: boolean } };
const local = (proc.__salesosSched ??= { started: false, ticking: false });

// --- DB state helpers -------------------------------------------------------

async function getState(def: TriggerDef): Promise<{ enabled: boolean; lastRunAt: string | null }> {
  const rows = await db.select().from(t.triggerState).where(and(eq(t.triggerState.id, def.id), eq(t.triggerState.workspaceId, WS)));
  if (rows[0]) return { enabled: rows[0].enabled, lastRunAt: rows[0].lastRunAt };
  await db.insert(t.triggerState).values({ id: def.id, workspaceId: WS, enabled: def.defaultEnabled, lastRunAt: null });
  return { enabled: def.defaultEnabled, lastRunAt: null };
}

async function setLastRun(id: string, at: string): Promise<void> {
  await db.update(t.triggerState).set({ lastRunAt: at }).where(and(eq(t.triggerState.id, id), eq(t.triggerState.workspaceId, WS)));
}

async function record(run: TriggerRun): Promise<TriggerRun> {
  await db.insert(t.triggerRuns).values({
    id: run.id, workspaceId: WS, triggerId: run.triggerId, agentId: run.agentId,
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
        summary = `${r.data.totalFlags} flags · gap ${php(r.data.optimismGap)}`;
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

export async function tick(force = false): Promise<TriggerRun[]> {
  if (local.ticking) return [];
  local.ticking = true;
  const fired: TriggerRun[] = [];
  try {
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
    .where(eq(t.triggerRuns.workspaceId, WS))
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
  await db.update(t.triggerState).set({ enabled }).where(and(eq(t.triggerState.id, id), eq(t.triggerState.workspaceId, WS)));
  const st = await getState(def);
  return { ...def, enabled: st.enabled, lastRunAt: st.lastRunAt ?? undefined };
}

export async function runNow(id: string): Promise<TriggerRun | undefined> {
  const def = getTriggerDef(id);
  if (!def) return undefined;
  return runTrigger(def);
}

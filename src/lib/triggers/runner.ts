import { ensureSnapshot } from "@/lib/data/spine";
import { runDispatcher, dispatcherStatus } from "@/agents/dispatcher";
import { runAuditor } from "@/agents/auditor";
import { runForecaster } from "@/agents/forecaster";
import { php } from "@/lib/format";
import { TRIGGERS, getTriggerDef } from "./registry";
import type { TriggerDef, TriggerRun, TriggerState, TriggerView } from "./types";

/**
 * The trigger runner — evaluates triggers and fires the due ones.
 *
 * State lives on globalThis (shared across route bundles and the scheduler).
 * Two clocks drive `tick()`: the in-process scheduler started from
 * instrumentation, and the `/api/triggers/tick` endpoint for external cron.
 */

interface RunnerStore {
  states: Record<string, TriggerState>;
  runs: TriggerRun[];
  schedulerStarted: boolean;
  ticking: boolean;
}

const g = globalThis as unknown as { __salesosTriggers?: RunnerStore };
const store: RunnerStore = (g.__salesosTriggers ??= {
  states: {},
  runs: [],
  schedulerStarted: false,
  ticking: false,
});

function stateFor(def: TriggerDef): TriggerState {
  return (store.states[def.id] ??= { enabled: def.defaultEnabled });
}

function record(run: TriggerRun): TriggerRun {
  store.runs.unshift(run);
  if (store.runs.length > 50) store.runs.length = 50;
  return run;
}

/** Execute one trigger's agent and log the run. */
export async function runTrigger(def: TriggerDef): Promise<TriggerRun> {
  const base = {
    id: crypto.randomUUID(),
    triggerId: def.id,
    agentId: def.agentId,
    at: new Date().toISOString(),
  };
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

    stateFor(def).lastRunAt = base.at;
    return record({ ...base, status: "ok", summary, actionsCreated });
  } catch (err) {
    stateFor(def).lastRunAt = base.at;
    return record({
      ...base,
      status: "error",
      summary: err instanceof Error ? err.message : String(err),
    });
  }
}

/** Is an event trigger's condition currently true? */
async function eventReady(def: TriggerDef): Promise<boolean> {
  if (def.event === "new-lead") {
    await ensureSnapshot();
    return dispatcherStatus().newLeads > 0;
  }
  return true;
}

/** Evaluate all triggers and fire the due ones. Returns what fired. */
export async function tick(force = false): Promise<TriggerRun[]> {
  if (store.ticking) return []; // never overlap ticks
  store.ticking = true;
  const fired: TriggerRun[] = [];
  try {
    const now = Date.now();
    for (const def of TRIGGERS) {
      const st = stateFor(def);
      if (!st.enabled) continue;
      const due =
        force ||
        !st.lastRunAt ||
        now - Date.parse(st.lastRunAt) >= def.intervalMs;
      if (!due) continue;
      if (def.type === "event" && !(await eventReady(def))) continue;
      fired.push(await runTrigger(def));
    }
  } finally {
    store.ticking = false;
  }
  return fired;
}

/** Start the in-process scheduler once. No-op on edge runtime or if opted out. */
export function ensureScheduler(): void {
  if (store.schedulerStarted) return;
  if (process.env.NEXT_RUNTIME && process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.TRIGGERS_AUTORUN === "false") return;
  store.schedulerStarted = true;
  const baseMs = Number(process.env.TRIGGER_TICK_MS ?? 60_000);
  // Kick once shortly after boot, then on the base cadence.
  setTimeout(() => void tick().catch(() => {}), 4000);
  setInterval(() => void tick().catch(() => {}), baseMs);
}

// --- read helpers for the API/UI -------------------------------------------

export function listTriggers(): TriggerView[] {
  return TRIGGERS.map((def) => {
    const st = stateFor(def);
    return { ...def, enabled: st.enabled, lastRunAt: st.lastRunAt };
  });
}

export function recentRuns(limit = 20): TriggerRun[] {
  return store.runs.slice(0, limit);
}

export function schedulerRunning(): boolean {
  return store.schedulerStarted;
}

export function setEnabled(id: string, enabled: boolean): TriggerView | undefined {
  const def = getTriggerDef(id);
  if (!def) return undefined;
  stateFor(def).enabled = enabled;
  return { ...def, ...stateFor(def) };
}

export async function runNow(id: string): Promise<TriggerRun | undefined> {
  const def = getTriggerDef(id);
  if (!def) return undefined;
  return runTrigger(def);
}

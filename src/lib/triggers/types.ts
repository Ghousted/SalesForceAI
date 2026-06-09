/**
 * Triggers — what turns "agents you run" into "agents that run themselves".
 *
 * A trigger binds an agent to a clock or a condition. The runner evaluates
 * triggers on a tick (in-process scheduler and/or an external cron hitting the
 * tick endpoint) and fires the due ones. Automated runs still only *propose*
 * (gated actions land in the inbox); the scheduler can't push anything to a
 * prospect on its own unless that agent is explicitly set to `auto`.
 */

export type TriggerType = "schedule" | "event";

/** Event detectors — "something changed in the CRM" conditions, polled. */
export type TriggerEvent = "new-lead";

export interface TriggerDef {
  id: string;
  label: string;
  agentId: string;
  type: TriggerType;
  /** For schedule: fire every N ms. For event: minimum gap between polls. */
  intervalMs: number;
  /** Only for type "event" — the condition that must hold to fire. */
  event?: TriggerEvent;
  defaultEnabled: boolean;
  description: string;
}

export type RunStatus = "ok" | "error" | "skipped";

export interface TriggerRun {
  id: string;
  triggerId: string;
  agentId: string;
  at: string; // ISO
  status: RunStatus;
  summary: string;
  actionsCreated?: number;
}

export interface TriggerState {
  enabled: boolean;
  lastRunAt?: string; // ISO
}

/** What the API returns per trigger — def + live state. */
export interface TriggerView extends TriggerDef {
  enabled: boolean;
  lastRunAt?: string;
}

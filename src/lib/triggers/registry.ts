import type { TriggerDef } from "./types";

const min = 60_000;
const hour = 60 * min;

/**
 * The trigger catalog. Intervals are overridable by env so you can demo fast
 * (e.g. TRIGGER_LEAD_SCAN_MS=30000) without editing code.
 */
export const TRIGGERS: TriggerDef[] = [
  {
    id: "route-new-leads",
    label: "Route new leads",
    agentId: "dispatcher",
    type: "event",
    event: "new-lead",
    intervalMs: Number(process.env.TRIGGER_LEAD_SCAN_MS ?? 2 * min),
    defaultEnabled: true,
    description:
      "When an unassigned lead appears, the Dispatcher scores and routes it (proposal lands in your inbox).",
  },
  {
    id: "reconcile-pipeline",
    label: "Reconcile pipeline",
    agentId: "auditor",
    type: "schedule",
    intervalMs: Number(process.env.TRIGGER_AUDIT_MS ?? 24 * hour),
    defaultEnabled: true,
    description: "Nightly: the Auditor reconciles every deal against the evidence.",
  },
  {
    id: "refresh-forecast",
    label: "Refresh forecast",
    agentId: "forecaster",
    type: "schedule",
    intervalMs: Number(process.env.TRIGGER_FORECAST_MS ?? 24 * hour),
    defaultEnabled: true,
    description: "Nightly: the Forecaster updates the month's evidence-based number.",
  },
];

export function getTriggerDef(id: string): TriggerDef | undefined {
  return TRIGGERS.find((t) => t.id === id);
}

import { listReps } from "@/lib/data/spine";
import { DEAL_STAGE_LABELS, type Deal, type DealStage } from "@/lib/data/types";
import { agentFunnel, type AgentFunnel } from "./config";

/**
 * Funnel interpretation — turns a stored {segment, routeTo} into real effects on
 * the agents. This is the "tell them where to act / where to post" layer: an
 * agent can be scoped to one rep's book or one pipeline stage (`segment`), and a
 * routing agent (the Dispatcher) can be pointed at a specific rep (`routeTo`).
 *
 * The settings UI only offers these dimensions where they change behaviour, so
 * the capability map below is the single source of truth for both the UI and
 * the wiring.
 */

/** Agents whose output can be routed to a chosen destination. */
export const ROUTE_AGENTS = new Set(["dispatcher"]);
/** Agents that scan the book and can be scoped to a segment of it. */
export const SEGMENT_AGENTS = new Set(["auditor", "forecaster"]);

export function supportsFunnel(agentId: string): boolean {
  return ROUTE_AGENTS.has(agentId) || SEGMENT_AGENTS.has(agentId);
}

// --- token parsing ----------------------------------------------------------

function segmentRepId(f: AgentFunnel): string | undefined {
  return f.segment.startsWith("rep:") ? f.segment.slice(4) : undefined;
}
function segmentStage(f: AgentFunnel): DealStage | undefined {
  return f.segment.startsWith("stage:") ? (f.segment.slice(6) as DealStage) : undefined;
}
function routeRepId(f: AgentFunnel): string | undefined {
  return f.routeTo.startsWith("rep:") ? f.routeTo.slice(4) : undefined;
}

// --- effects (read the hydrated config cache) -------------------------------

/**
 * A predicate that keeps only the deals this agent's segment covers. Pass it to
 * `auditBook` so the Auditor/Forecaster reason over their lane, not the floor.
 */
export function dealMatchesFunnel(agentId: string): (d: Deal) => boolean {
  const f = agentFunnel(agentId);
  const rep = segmentRepId(f);
  const stage = segmentStage(f);
  return (d) => (!rep || d.ownerRepId === rep) && (!stage || d.stage === stage);
}

/**
 * For a routing agent, the rep it's pinned to — or undefined to fall back to the
 * agent's own routing logic (e.g. least-loaded). Ignores a rep that no longer
 * exists so a stale config can't break dispatch.
 */
export function routeTargetRep(agentId: string): { id: string; name: string } | undefined {
  const id = routeRepId(agentFunnel(agentId));
  if (!id) return undefined;
  const rep = listReps().find((r) => r.id === id);
  return rep ? { id: rep.id, name: rep.name } : undefined;
}

// --- description (UI + oversight) -------------------------------------------

/** A short human label for a funnel, e.g. "Proposal-stage deals" or "→ Maria". */
export function describeFunnel(agentId: string, f: AgentFunnel): string {
  if (ROUTE_AGENTS.has(agentId)) {
    const id = routeRepId(f);
    if (!id) return "Routes to whoever has capacity";
    const rep = listReps().find((r) => r.id === id);
    return rep ? `Routes everything to ${rep.name}` : "Routes to whoever has capacity";
  }
  const rep = segmentRepId(f);
  const stage = segmentStage(f);
  if (rep) {
    const r = listReps().find((x) => x.id === rep);
    return r ? `Watches ${r.name}'s book` : "Watches the whole book";
  }
  if (stage) return `Watches ${DEAL_STAGE_LABELS[stage]} deals`;
  return "Watches the whole book";
}

/** The choices the settings UI renders for each funnel dimension. */
export function funnelOptions(): {
  reps: { id: string; name: string }[];
  stages: { value: string; label: string }[];
} {
  return {
    reps: listReps().map((r) => ({ id: r.id, name: r.name })),
    stages: (Object.keys(DEAL_STAGE_LABELS) as DealStage[]).map((s) => ({
      value: s,
      label: DEAL_STAGE_LABELS[s],
    })),
  };
}

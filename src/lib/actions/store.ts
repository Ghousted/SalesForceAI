import type { AgentAction, ActionStatus } from "./types";

/**
 * The action queue.
 *
 * In-memory for now (resets on server restart) — a clean seam for a real
 * datastore later. Holds every proposed/executed action so the approval inbox
 * and the roster's "needs you" counts have a single source of truth.
 *
 * Stored on `globalThis` so every route handler shares one array — Next.js can
 * bundle routes separately, which would otherwise give each its own module copy.
 */

const globalStore = globalThis as unknown as { __salesosActions?: AgentAction[] };
const actions: AgentAction[] = (globalStore.__salesosActions ??= []);

export interface NewAction {
  agentId: string;
  kind: AgentAction["kind"];
  title: string;
  detail: string;
  target: AgentAction["target"];
  payload: Record<string, unknown>;
  autonomy: AgentAction["autonomy"];
  status: ActionStatus;
}

export function addAction(input: NewAction): AgentAction {
  const action: AgentAction = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    ...input,
  };
  actions.unshift(action); // newest first
  return action;
}

export function getAction(id: string): AgentAction | undefined {
  return actions.find((a) => a.id === id);
}

export function listActions(filter?: {
  status?: ActionStatus;
  agentId?: string;
  pending?: boolean; // shorthand for status === "proposed"
}): AgentAction[] {
  return actions.filter((a) => {
    if (filter?.pending && a.status !== "proposed") return false;
    if (filter?.status && a.status !== filter.status) return false;
    if (filter?.agentId && a.agentId !== filter.agentId) return false;
    return true;
  });
}

export function updateAction(
  id: string,
  patch: Partial<Pick<AgentAction, "status" | "resolvedAt" | "error">>,
): AgentAction | undefined {
  const a = getAction(id);
  if (!a) return undefined;
  Object.assign(a, patch);
  return a;
}

export function pendingCount(agentId?: string): number {
  return listActions({ pending: true, agentId }).length;
}

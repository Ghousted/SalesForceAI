import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { currentWorkspaceId } from "@/lib/tenant";
import * as t from "@/lib/db/schema";
import type { AgentAction, ActionStatus } from "./types";

/**
 * The action queue — DB-backed (the `actions` table) so the approval inbox and
 * the roster's "needs you" counts persist across restarts and work on
 * serverless. Async; callers await.
 */


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

type Row = typeof t.actions.$inferSelect;

function rowToAction(r: Row): AgentAction {
  return {
    id: r.id,
    agentId: r.agentId,
    kind: r.kind as AgentAction["kind"],
    title: r.title,
    detail: r.detail,
    target: { kind: r.targetKind as AgentAction["target"]["kind"], id: r.targetId, label: r.targetLabel },
    payload: JSON.parse(r.payload || "{}"),
    status: r.status as ActionStatus,
    autonomy: r.autonomy as AgentAction["autonomy"],
    createdAt: r.createdAt,
    resolvedAt: r.resolvedAt ?? undefined,
    error: r.error ?? undefined,
  };
}

export async function addAction(input: NewAction): Promise<AgentAction> {
  const action: AgentAction = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    ...input,
  };
  await db.insert(t.actions).values({
    id: action.id, workspaceId: currentWorkspaceId(), agentId: action.agentId, kind: action.kind,
    title: action.title, detail: action.detail,
    targetKind: action.target.kind, targetId: action.target.id, targetLabel: action.target.label,
    payload: JSON.stringify(action.payload), status: action.status, autonomy: action.autonomy,
    createdAt: action.createdAt, resolvedAt: null, error: null,
  });
  return action;
}

export async function getAction(id: string): Promise<AgentAction | undefined> {
  const rows = await db
    .select().from(t.actions)
    .where(and(eq(t.actions.id, id), eq(t.actions.workspaceId, currentWorkspaceId())));
  return rows[0] ? rowToAction(rows[0]) : undefined;
}

export async function listActions(filter?: {
  status?: ActionStatus;
  agentId?: string;
  pending?: boolean;
}): Promise<AgentAction[]> {
  const rows = await db
    .select().from(t.actions)
    .where(eq(t.actions.workspaceId, currentWorkspaceId()))
    .orderBy(desc(t.actions.createdAt));
  return rows.map(rowToAction).filter((a) => {
    if (filter?.pending && a.status !== "proposed") return false;
    if (filter?.status && a.status !== filter.status) return false;
    if (filter?.agentId && a.agentId !== filter.agentId) return false;
    return true;
  });
}

export async function updateAction(
  id: string,
  patch: Partial<Pick<AgentAction, "status" | "resolvedAt" | "error">>,
): Promise<AgentAction | undefined> {
  await db
    .update(t.actions)
    .set({
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      ...(patch.resolvedAt !== undefined ? { resolvedAt: patch.resolvedAt } : {}),
      ...(patch.error !== undefined ? { error: patch.error } : {}),
    })
    .where(and(eq(t.actions.id, id), eq(t.actions.workspaceId, currentWorkspaceId())));
  return getAction(id);
}

export async function pendingCount(agentId?: string): Promise<number> {
  return (await listActions({ pending: true, agentId })).length;
}

/** All pending counts keyed by agent — one query for the roster statuses. */
export async function pendingCountsByAgent(): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const a of await listActions({ pending: true })) {
    out[a.agentId] = (out[a.agentId] ?? 0) + 1;
  }
  return out;
}

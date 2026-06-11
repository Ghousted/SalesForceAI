import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { currentWorkspaceId } from "@/lib/tenant";
import * as t from "@/lib/db/schema";
import { getAgentMeta, ROSTER } from "@/agents/registry";

/**
 * Per-agent configuration (Phase D): give agents real-person names, enable or
 * pause them, and override autonomy. DB-backed with a cached read path (hydrated
 * like the data snapshot) so the policy engine and roster read synchronously.
 */

/**
 * A funnel is the lane an agent works in: which slice of the book it watches
 * (`segment`) and, for routing agents, where it sends what it produces
 * (`routeTo`). Tokens are interpreted in `./funnel.ts`.
 *   segment: "all" | "rep:<repId>" | "stage:<dealStage>"
 *   routeTo: "auto" | "rep:<repId>"
 */
export interface AgentFunnel {
  segment: string;
  routeTo: string;
}

export const DEFAULT_FUNNEL: AgentFunnel = { segment: "all", routeTo: "auto" };

export interface AgentCfg {
  displayName?: string;
  enabled: boolean;
  autonomy?: "ask" | "auto";
  funnel?: AgentFunnel;
}

function parseFunnel(raw: string | null): AgentFunnel | undefined {
  if (!raw) return undefined;
  try {
    const f = JSON.parse(raw) as Partial<AgentFunnel>;
    return { segment: f.segment || "all", routeTo: f.routeTo || "auto" };
  } catch {
    return undefined;
  }
}

const TTL = 30_000;
// Per-workspace cache: each tenant's agent config is isolated.
const g = globalThis as unknown as {
  __salesosAgentCfg?: Map<string, { map: Record<string, AgentCfg>; at: number }>;
};
function bag() {
  return (g.__salesosAgentCfg ??= new Map());
}
/** Composite row id so each workspace owns its own agent-config rows. */
function rowId(workspaceId: string, agentId: string): string {
  return `${workspaceId}:${agentId}`;
}
function agentIdOf(rowId: string): string {
  const i = rowId.indexOf(":");
  return i === -1 ? rowId : rowId.slice(i + 1);
}

export async function ensureAgentConfig(): Promise<void> {
  const ws = currentWorkspaceId();
  const c = bag().get(ws);
  if (c && Date.now() - c.at < TTL) return;
  try {
    const rows = await db.select().from(t.agentConfig).where(eq(t.agentConfig.workspaceId, ws));
    const map: Record<string, AgentCfg> = {};
    for (const r of rows) {
      map[agentIdOf(r.id)] = {
        displayName: r.displayName ?? undefined,
        enabled: r.enabled,
        autonomy: (r.autonomy as "ask" | "auto" | null) ?? undefined,
        funnel: parseFunnel(r.funnel),
      };
    }
    bag().set(ws, { map, at: Date.now() });
  } catch {
    /* keep prior cache */
  }
}

function cfg(agentId: string): AgentCfg {
  return bag().get(currentWorkspaceId())?.map[agentId] ?? { enabled: true };
}

export function agentDisplayName(agentId: string): string {
  return cfg(agentId).displayName || getAgentMeta(agentId)?.name || agentId;
}
export function agentEnabled(agentId: string): boolean {
  return cfg(agentId).enabled;
}
export function agentAutonomyOverride(agentId: string): "ask" | "auto" | undefined {
  return cfg(agentId).autonomy;
}
export function agentFunnel(agentId: string): AgentFunnel {
  return cfg(agentId).funnel ?? DEFAULT_FUNNEL;
}

export async function setAgentConfig(
  agentId: string,
  patch: {
    displayName?: string;
    enabled?: boolean;
    autonomy?: "ask" | "auto" | null;
    funnel?: AgentFunnel | null;
  },
): Promise<void> {
  const ws = currentWorkspaceId();
  const id = rowId(ws, agentId);
  const existing = await db.select().from(t.agentConfig).where(eq(t.agentConfig.id, id));
  const funnelJson =
    patch.funnel === undefined ? undefined : patch.funnel ? JSON.stringify(patch.funnel) : null;
  const set = {
    ...(patch.displayName !== undefined ? { displayName: patch.displayName || null } : {}),
    ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
    ...(patch.autonomy !== undefined ? { autonomy: patch.autonomy } : {}),
    ...(funnelJson !== undefined ? { funnel: funnelJson } : {}),
  };
  if (existing[0]) {
    await db.update(t.agentConfig).set(set).where(eq(t.agentConfig.id, id));
  } else {
    await db.insert(t.agentConfig).values({
      id, workspaceId: ws,
      displayName: patch.displayName ?? null,
      enabled: patch.enabled ?? true,
      autonomy: patch.autonomy ?? null,
      funnel: funnelJson ?? null,
    });
  }
  bag().delete(ws); // invalidate this workspace's cache
}

/** The full config list for the settings UI (excludes the human seat). */
export async function listAgentConfigs() {
  await ensureAgentConfig();
  return ROSTER.filter((a) => a.id !== "human").map((a) => ({
    id: a.id,
    registryName: a.name,
    displayName: agentDisplayName(a.id),
    enabled: agentEnabled(a.id),
    autonomy: agentAutonomyOverride(a.id) ?? "default",
    funnel: agentFunnel(a.id),
    plainDescription: a.plainDescription,
    when: a.when,
    implemented: a.implemented,
  }));
}

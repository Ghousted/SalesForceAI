import { eq } from "drizzle-orm";
import { db, DEFAULT_WORKSPACE_ID } from "@/lib/db/client";
import * as t from "@/lib/db/schema";
import { getAgentMeta, ROSTER } from "@/agents/registry";

/**
 * Per-agent configuration (Phase D): give agents real-person names, enable or
 * pause them, and override autonomy. DB-backed with a cached read path (hydrated
 * like the data snapshot) so the policy engine and roster read synchronously.
 */

export interface AgentCfg {
  displayName?: string;
  enabled: boolean;
  autonomy?: "ask" | "auto";
}

const WS = DEFAULT_WORKSPACE_ID;
const TTL = 30_000;
const g = globalThis as unknown as {
  __salesosAgentCfg?: { map: Record<string, AgentCfg>; at: number } | null;
};

export async function ensureAgentConfig(): Promise<void> {
  const c = g.__salesosAgentCfg;
  if (c && Date.now() - c.at < TTL) return;
  try {
    const rows = await db.select().from(t.agentConfig).where(eq(t.agentConfig.workspaceId, WS));
    const map: Record<string, AgentCfg> = {};
    for (const r of rows) {
      map[r.id] = {
        displayName: r.displayName ?? undefined,
        enabled: r.enabled,
        autonomy: (r.autonomy as "ask" | "auto" | null) ?? undefined,
      };
    }
    g.__salesosAgentCfg = { map, at: Date.now() };
  } catch {
    /* keep prior cache */
  }
}

function cfg(agentId: string): AgentCfg {
  return g.__salesosAgentCfg?.map[agentId] ?? { enabled: true };
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

export async function setAgentConfig(
  agentId: string,
  patch: { displayName?: string; enabled?: boolean; autonomy?: "ask" | "auto" | null },
): Promise<void> {
  const existing = await db.select().from(t.agentConfig).where(eq(t.agentConfig.id, agentId));
  const set = {
    ...(patch.displayName !== undefined ? { displayName: patch.displayName || null } : {}),
    ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
    ...(patch.autonomy !== undefined ? { autonomy: patch.autonomy } : {}),
  };
  if (existing[0]) {
    await db.update(t.agentConfig).set(set).where(eq(t.agentConfig.id, agentId));
  } else {
    await db.insert(t.agentConfig).values({
      id: agentId, workspaceId: WS,
      displayName: patch.displayName ?? null,
      enabled: patch.enabled ?? true,
      autonomy: patch.autonomy ?? null,
    });
  }
  g.__salesosAgentCfg = null; // invalidate
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
    plainDescription: a.plainDescription,
    when: a.when,
    implemented: a.implemented,
  }));
}

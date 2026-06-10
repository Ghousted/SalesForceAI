import { NextResponse } from "next/server";
import { recentRuns, schedulerRunning } from "@/lib/triggers/runner";
import { listActions } from "@/lib/actions/store";
import { ensureAgentConfig, agentDisplayName, agentEnabled, agentFunnel } from "@/lib/agents/config";
import { describeFunnel, supportsFunnel } from "@/lib/agents/funnel";
import { ensureSnapshot } from "@/lib/data/spine";
import { ROSTER } from "@/agents/registry";

/** What the agents are doing — a merged feed of trigger runs + proposed/executed actions. */
export async function GET() {
  await Promise.all([ensureAgentConfig(), ensureSnapshot()]);
  const [runs, actions] = await Promise.all([recentRuns(30), listActions()]);

  const feed = [
    ...runs.map((r) => ({
      id: r.id, kind: "run" as const, agentId: r.agentId,
      agentName: agentDisplayName(r.agentId), at: r.at, label: r.summary, status: r.status,
    })),
    ...actions.slice(0, 40).map((a) => ({
      id: a.id, kind: "action" as const, agentId: a.agentId,
      agentName: agentDisplayName(a.agentId), at: a.resolvedAt ?? a.createdAt,
      label: a.title, status: a.status,
    })),
  ]
    .sort((x, y) => y.at.localeCompare(x.at))
    .slice(0, 40);

  const pending: Record<string, number> = {};
  for (const a of actions) if (a.status === "proposed") pending[a.agentId] = (pending[a.agentId] ?? 0) + 1;
  const lastRun: Record<string, string> = {};
  for (const r of runs) if (!lastRun[r.agentId]) lastRun[r.agentId] = r.at;

  const agents = ROSTER.filter((a) => a.implemented && a.id !== "human").map((a) => ({
    id: a.id,
    name: agentDisplayName(a.id),
    enabled: agentEnabled(a.id),
    pending: pending[a.id] ?? 0,
    lastRunAt: lastRun[a.id] ?? null,
    lane: supportsFunnel(a.id) ? describeFunnel(a.id, agentFunnel(a.id)) : null,
  }));

  return NextResponse.json({ scheduler: schedulerRunning(), agents, feed });
}

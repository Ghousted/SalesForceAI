"use client";

import type { Activity } from "@/lib/data/types";
import { getAgentMeta } from "@/agents/registry";

/**
 * The record timeline, shared by contact/deal detail pages. Activities written
 * by an agent carry `actorId` and render with an ember agent chip — the CRM
 * shows not just what happened, but *who on the team* (human or agent) did it.
 */

const ACT_DOT: Record<string, string> = {
  email: "bg-ember", call: "bg-emerald-400", meeting: "bg-amber-400", note: "bg-ash/40", viewing: "bg-ember",
};

function fmtDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-PH", { day: "numeric", month: "short", year: "numeric" });
}

export function agentLabel(actorId: string): string {
  return getAgentMeta(actorId)?.name ?? actorId;
}

export function AgentChip({ actorId }: { actorId: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-ember/15 px-2 py-0.5 text-[10px] font-semibold text-ember">
      <span className="h-1 w-1 rounded-full bg-ember" />
      {agentLabel(actorId)}
    </span>
  );
}

export function Timeline({ activities, emptyLabel }: { activities: Activity[]; emptyLabel?: string }) {
  const timeline = [...activities].reverse(); // newest first

  if (timeline.length === 0) {
    return (
      <div className="rounded-xl border border-ash/12 bg-graphite p-5 text-center text-[13px] text-ash/60">
        {emptyLabel ?? "No activity logged yet. Connect an inbox or log a touch to build the timeline."}
      </div>
    );
  }

  return (
    <ol className="relative space-y-3 border-l border-ash/12 pl-5">
      {timeline.map((a) => (
        <li key={a.id} className="relative">
          <span className={`absolute -left-[23px] top-1.5 h-2 w-2 rounded-full ${ACT_DOT[a.type] ?? "bg-ash/40"}`} />
          <div className="rounded-xl border border-ash/12 bg-graphite p-3.5">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-medium uppercase tracking-wide text-ash/60">{a.type}</span>
              {a.direction && <span className="text-[10px] text-ash/40">· {a.direction}</span>}
              {a.actorId && <AgentChip actorId={a.actorId} />}
              <span className="ml-auto text-[11px] text-ash/50">{fmtDate(a.timestamp)}</span>
            </div>
            <div className="mt-1 text-sm font-medium text-bone">{a.subject}</div>
            {a.body && <p className="mt-1 line-clamp-3 text-[13px] leading-[1.5] text-ash">{a.body}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}

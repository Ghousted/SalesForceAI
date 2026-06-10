"use client";

import { useCallback, useEffect, useState } from "react";

interface AgentRow { id: string; name: string; enabled: boolean; pending: number; lastRunAt: string | null }
interface FeedItem { id: string; kind: "run" | "action"; agentId: string; agentName: string; at: string; label: string; status: string }
interface Data { scheduler: boolean; agents: AgentRow[]; feed: FeedItem[] }

function timeAgo(iso: string): string {
  const s = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

const STATUS_DOT: Record<string, string> = {
  ok: "bg-green-500", executed: "bg-green-500",
  proposed: "bg-amber-500", error: "bg-rose-500", failed: "bg-rose-500",
  rejected: "bg-slate-400", skipped: "bg-slate-300",
};

export function OversightView() {
  const [data, setData] = useState<Data | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/oversight", { cache: "no-store" });
      setData(await res.json());
    } catch {
      /* keep last */
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 5000); // live-ish
    return () => clearInterval(t);
  }, [load]);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Oversight</h1>
          <p className="mt-1 text-sm text-slate-500">What your agents are doing — live.</p>
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${data?.scheduler ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${data?.scheduler ? "animate-pulse bg-green-500" : "bg-slate-400"}`} />
          {data?.scheduler ? "agents running" : "scheduler off"}
        </span>
      </div>

      {/* Agent chips */}
      <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {data?.agents.map((a) => (
          <div key={a.id} className={`rounded-xl border p-3 ${a.enabled ? "border-slate-200 bg-white" : "border-slate-200 bg-slate-50 opacity-60"}`}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-800">{a.name}</span>
              {a.pending > 0 && <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{a.pending}</span>}
            </div>
            <div className="mt-1 text-[11px] text-slate-400">
              {a.enabled ? (a.lastRunAt ? `ran ${timeAgo(a.lastRunAt)}` : "idle") : "paused"}
            </div>
          </div>
        ))}
      </div>

      {/* Activity feed */}
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Activity</h2>
      <div className="rounded-xl border border-slate-200 bg-white">
        {data && data.feed.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-slate-400">No agent activity yet — run an agent or wait for the scheduler.</p>
        )}
        <ol className="divide-y divide-slate-100">
          {data?.feed.map((f) => (
            <li key={f.kind + f.id} className="flex items-start gap-3 px-4 py-2.5 text-sm">
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[f.status] ?? "bg-slate-300"}`} />
              <div className="min-w-0 flex-1">
                <span className="font-medium text-slate-800">{f.agentName}</span>
                <span className="ml-1.5 text-[10px] uppercase tracking-wide text-slate-400">{f.kind === "run" ? "ran" : f.status}</span>
                <p className="truncate text-slate-600">{f.label}</p>
              </div>
              <span className="shrink-0 text-[11px] text-slate-400">{timeAgo(f.at)}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

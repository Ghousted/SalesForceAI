"use client";

import { useCallback, useEffect, useState } from "react";
import type { TriggerView, TriggerRun } from "@/lib/triggers/types";

function humanInterval(ms: number): string {
  if (ms >= 23 * 3600_000) return "daily";
  if (ms >= 3600_000) return `every ${Math.round(ms / 3600_000)}h`;
  return `every ${Math.max(1, Math.round(ms / 60_000))} min`;
}

function timeAgo(iso?: string): string {
  if (!iso) return "never";
  const s = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  return `${Math.round(s / 3600)}h ago`;
}

const RUN_STYLE: Record<TriggerRun["status"], string> = {
  ok: "text-green-700",
  error: "text-rose-700",
  skipped: "text-slate-400",
};

export function AutomationsPanel({ onRan }: { onRan: () => void }) {
  const [triggers, setTriggers] = useState<TriggerView[]>([]);
  const [runs, setRuns] = useState<TriggerRun[]>([]);
  const [scheduler, setScheduler] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/triggers");
    const data = await res.json();
    setTriggers(data.triggers ?? []);
    setRuns(data.runs ?? []);
    setScheduler(Boolean(data.scheduler));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggle(t: TriggerView) {
    setBusy(t.id);
    try {
      await fetch(`/api/triggers/${t.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: t.enabled ? "disable" : "enable" }),
      });
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function runOne(id: string) {
    setBusy(id);
    try {
      await fetch(`/api/triggers/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "run" }),
      });
      await load();
      onRan();
    } finally {
      setBusy(null);
    }
  }

  async function tick() {
    setBusy("tick");
    try {
      await fetch("/api/triggers/tick", { method: "POST" });
      await load();
      onRan();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          Agents fire on their own. Automated runs only{" "}
          <span className="font-medium">propose</span> — approvals stay yours.
        </p>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${scheduler ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}
        >
          {scheduler ? "● scheduler running" : "○ scheduler off"}
        </span>
      </div>

      {/* Triggers */}
      <div className="space-y-2">
        {triggers.map((t) => (
          <div
            key={t.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold text-slate-800">{t.label}</h4>
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-500">
                  {t.agentId}
                </span>
                <span className="text-[11px] text-slate-400">
                  {t.type === "event" ? `on new lead · ${humanInterval(t.intervalMs)}` : humanInterval(t.intervalMs)}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-500">{t.description}</p>
              <p className="mt-0.5 text-[11px] text-slate-400">
                last run {timeAgo(t.lastRunAt)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={() => runOne(t.id)}
                disabled={busy !== null}
                className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 transition disabled:opacity-40 enabled:hover:bg-slate-50"
              >
                {busy === t.id ? "…" : "Run now"}
              </button>
              <button
                onClick={() => toggle(t)}
                disabled={busy !== null}
                className={`relative h-5 w-9 rounded-full transition disabled:opacity-40 ${t.enabled ? "bg-indigo-600" : "bg-slate-300"}`}
                aria-label={t.enabled ? "Disable" : "Enable"}
              >
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${t.enabled ? "left-[18px]" : "left-0.5"}`}
                />
              </button>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={tick}
        disabled={busy !== null}
        className="w-full rounded-lg bg-slate-800 py-2 text-sm font-medium text-white transition disabled:opacity-40 enabled:hover:bg-slate-900"
      >
        {busy === "tick" ? "Ticking…" : "Run all due now"}
      </button>

      {/* Run log */}
      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Recent activity
        </h4>
        {runs.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-400">
            Nothing has fired yet.
          </p>
        ) : (
          <ol className="space-y-1.5">
            {runs.map((r) => (
              <li key={r.id} className="flex items-start gap-2 text-sm">
                <span className="mt-1 text-[10px] text-slate-400">{timeAgo(r.at)}</span>
                <span className="font-medium text-slate-600">{r.agentId}</span>
                <span className={RUN_STYLE[r.status]}>{r.summary}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

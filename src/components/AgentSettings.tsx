"use client";

import { useState } from "react";

export interface AgentConfigRow {
  id: string;
  registryName: string;
  displayName: string;
  enabled: boolean;
  autonomy: string; // "default" | "ask" | "auto"
  plainDescription: string;
  when: string;
}

// Which agents actually produce writes (autonomy is meaningful for these).
const HAS_ACTIONS = new Set(["dispatcher", "scribe"]);

export function AgentSettings({ initial }: { initial: AgentConfigRow[] }) {
  const [rows, setRows] = useState(initial);

  async function patch(id: string, body: Record<string, unknown>) {
    await fetch("/api/agents", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...body }),
    });
  }

  function update(id: string, patchLocal: Partial<AgentConfigRow>, body: Record<string, unknown>) {
    setRows((r) => r.map((x) => (x.id === id ? { ...x, ...patchLocal } : x)));
    void patch(id, body);
  }

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-semibold tracking-tight">Your agents</h1>
        <p className="mt-1 text-sm text-slate-500">
          Name them like teammates, pause any of them, and decide which can act on their own.
        </p>
      </div>

      <div className="space-y-2">
        {rows.map((a) => (
          <div key={a.id} className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <input
                  value={a.displayName}
                  onChange={(e) => setRows((r) => r.map((x) => (x.id === a.id ? { ...x, displayName: e.target.value } : x)))}
                  onBlur={(e) => patch(a.id, { displayName: e.target.value })}
                  className="w-48 rounded-lg border border-slate-200 px-2.5 py-1 text-sm font-semibold outline-none focus:border-indigo-300"
                />
                <span className="text-[11px] uppercase tracking-wide text-slate-400">{a.registryName}</span>
              </div>
              <p className="mt-1 text-xs text-slate-500">{a.plainDescription}</p>
            </div>

            {/* Autonomy — only for agents that propose writes */}
            {HAS_ACTIONS.has(a.id) ? (
              <select
                value={a.autonomy}
                onChange={(e) => update(a.id, { autonomy: e.target.value }, { autonomy: e.target.value })}
                className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 outline-none focus:border-indigo-300"
                title="How much this agent may do without asking"
              >
                <option value="default">Autonomy: default (ask)</option>
                <option value="ask">Always ask me</option>
                <option value="auto">Act on its own</option>
              </select>
            ) : (
              <span className="w-40 text-right text-[11px] text-slate-300">read-only</span>
            )}

            {/* Enable toggle */}
            <button
              onClick={() => update(a.id, { enabled: !a.enabled }, { enabled: !a.enabled })}
              className={`relative h-5 w-9 shrink-0 rounded-full transition ${a.enabled ? "bg-indigo-600" : "bg-slate-300"}`}
              title={a.enabled ? "Active — click to pause" : "Paused — click to activate"}
            >
              <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${a.enabled ? "left-[18px]" : "left-0.5"}`} />
            </button>
          </div>
        ))}
      </div>

      <p className="mt-4 text-xs text-slate-400">
        External sends (a follow-up email to a prospect) always wait for your approval, whatever the autonomy setting — the human owns the close.
      </p>
    </div>
  );
}

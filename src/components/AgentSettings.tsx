"use client";

import { useState } from "react";

export interface AgentFunnelRow {
  segment: string;
  routeTo: string;
}

export interface AgentConfigRow {
  id: string;
  registryName: string;
  displayName: string;
  enabled: boolean;
  autonomy: string; // "default" | "ask" | "auto"
  funnel: AgentFunnelRow;
  plainDescription: string;
  when: string;
}

export interface FunnelOptions {
  reps: { id: string; name: string }[];
  stages: { value: string; label: string }[];
}

// Which agents actually produce writes (autonomy is meaningful for these).
const HAS_ACTIONS = new Set(["dispatcher", "scribe"]);
// Which agents can be routed to a destination vs. scoped to a segment.
const ROUTE_AGENTS = new Set(["dispatcher"]);
const SEGMENT_AGENTS = new Set(["auditor", "forecaster"]);

export function AgentSettings({
  initial,
  options,
}: {
  initial: AgentConfigRow[];
  options: FunnelOptions;
}) {
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

  function setFunnel(id: string, next: Partial<AgentFunnelRow>) {
    const row = rows.find((x) => x.id === id);
    const funnel = { ...(row?.funnel ?? { segment: "all", routeTo: "auto" }), ...next };
    update(id, { funnel }, { funnel });
  }

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-semibold tracking-tight">Your agents</h1>
        <p className="mt-1 text-sm text-ash">
          Name them like teammates, pause any of them, and decide which can act on their own.
        </p>
      </div>

      <div className="space-y-2">
        {rows.map((a) => (
          <div key={a.id} className="flex items-center gap-4 rounded-xl border border-ash/15 bg-graphite p-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <input
                  value={a.displayName}
                  onChange={(e) => setRows((r) => r.map((x) => (x.id === a.id ? { ...x, displayName: e.target.value } : x)))}
                  onBlur={(e) => patch(a.id, { displayName: e.target.value })}
                  className="w-48 rounded-lg border border-ash/15 px-2.5 py-1 text-sm font-semibold outline-none focus:border-ember"
                />
                <span className="text-[11px] uppercase tracking-wide text-ash/70">{a.registryName}</span>
              </div>
              <p className="mt-1 text-xs text-ash">{a.plainDescription}</p>

              {/* Funnel — where this agent acts */}
              {ROUTE_AGENTS.has(a.id) && (
                <label className="mt-2 flex items-center gap-2 text-xs text-ash">
                  <span className="shrink-0">Route new leads to</span>
                  <select
                    value={a.funnel.routeTo}
                    onChange={(e) => setFunnel(a.id, { routeTo: e.target.value })}
                    className="rounded-lg border border-ash/15 px-2 py-1 text-xs text-ash outline-none focus:border-ember"
                  >
                    <option value="auto">whoever has capacity</option>
                    {options.reps.map((r) => (
                      <option key={r.id} value={`rep:${r.id}`}>{r.name}</option>
                    ))}
                  </select>
                </label>
              )}
              {SEGMENT_AGENTS.has(a.id) && (
                <label className="mt-2 flex items-center gap-2 text-xs text-ash">
                  <span className="shrink-0">Watches</span>
                  <select
                    value={a.funnel.segment}
                    onChange={(e) => setFunnel(a.id, { segment: e.target.value })}
                    className="rounded-lg border border-ash/15 px-2 py-1 text-xs text-ash outline-none focus:border-ember"
                  >
                    <option value="all">the whole book</option>
                    <optgroup label="A rep's book">
                      {options.reps.map((r) => (
                        <option key={r.id} value={`rep:${r.id}`}>{r.name}</option>
                      ))}
                    </optgroup>
                    <optgroup label="A pipeline stage">
                      {options.stages.map((s) => (
                        <option key={s.value} value={`stage:${s.value}`}>{s.label}</option>
                      ))}
                    </optgroup>
                  </select>
                </label>
              )}
            </div>

            {/* Autonomy — only for agents that propose writes */}
            {HAS_ACTIONS.has(a.id) ? (
              <select
                value={a.autonomy}
                onChange={(e) => update(a.id, { autonomy: e.target.value }, { autonomy: e.target.value })}
                className="rounded-lg border border-ash/15 px-2.5 py-1.5 text-xs text-ash outline-none focus:border-ember"
                title="How much this agent may do without asking"
              >
                <option value="default">Autonomy: default (ask)</option>
                <option value="ask">Always ask me</option>
                <option value="auto">Act on its own</option>
              </select>
            ) : (
              <span className="w-40 text-right text-[11px] text-ash/50">read-only</span>
            )}

            {/* Enable toggle */}
            <button
              onClick={() => update(a.id, { enabled: !a.enabled }, { enabled: !a.enabled })}
              className={`relative h-5 w-9 shrink-0 rounded-full transition ${a.enabled ? "bg-ember" : "bg-ash/20"}`}
              title={a.enabled ? "Active — click to pause" : "Paused — click to activate"}
            >
              <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-bone transition-all ${a.enabled ? "left-[18px]" : "left-0.5"}`} />
            </button>
          </div>
        ))}
      </div>

      <p className="mt-4 text-xs text-ash/70">
        External sends (a follow-up email to a prospect) always wait for your approval, whatever the autonomy setting — the human owns the close.
      </p>
    </div>
  );
}

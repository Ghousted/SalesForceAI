"use client";

import { useState } from "react";
import type { AgentAction } from "@/lib/actions/types";

const STATUS_STYLE: Record<AgentAction["status"], string> = {
  proposed: "bg-amber-100 text-amber-700",
  executed: "bg-green-100 text-green-700",
  rejected: "bg-slate-100 text-slate-500",
  failed: "bg-rose-100 text-rose-700",
};

function Row({
  action,
  onResolved,
}: {
  action: AgentAction;
  onResolved: (a: AgentAction) => void;
}) {
  const [busy, setBusy] = useState(false);

  async function resolve(decision: "approve" | "reject") {
    setBusy(true);
    try {
      const res = await fetch(`/api/actions/${action.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      const data = await res.json();
      if (data.action) onResolved(data.action as AgentAction);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              {action.agentId}
            </span>
            <h5 className="truncate text-sm font-semibold text-slate-800">
              {action.title}
            </h5>
          </div>
          <p className="mt-1 text-sm text-slate-600">{action.detail}</p>
          {action.error && (
            <p className="mt-1 text-xs text-rose-600">⚠ {action.error}</p>
          )}
        </div>
        <span
          className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${STATUS_STYLE[action.status]}`}
        >
          {action.status}
        </span>
      </div>

      {action.status === "proposed" && (
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => resolve("approve")}
            disabled={busy}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition disabled:opacity-40 enabled:hover:bg-indigo-700"
          >
            {busy ? "…" : "Approve"}
          </button>
          <button
            onClick={() => resolve("reject")}
            disabled={busy}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition disabled:opacity-40 enabled:hover:bg-slate-50"
          >
            Reject
          </button>
        </div>
      )}
    </div>
  );
}

export function ActionList({
  actions,
  onResolved,
  emptyLabel = "Nothing waiting on you.",
}: {
  actions: AgentAction[];
  onResolved: (a: AgentAction) => void;
  emptyLabel?: string;
}) {
  if (actions.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-400">{emptyLabel}</p>;
  }
  return (
    <div className="space-y-2">
      {actions.map((a) => (
        <Row key={a.id} action={a} onResolved={onResolved} />
      ))}
    </div>
  );
}

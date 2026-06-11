"use client";

import { useState } from "react";
import Link from "next/link";
import type { AgentAction } from "@/lib/actions/types";
import { getAgentMeta } from "@/agents/registry";

const STATUS_STYLE: Record<AgentAction["status"], string> = {
  proposed: "bg-amber-500/15 text-amber-400",
  executed: "bg-emerald-500/15 text-emerald-400",
  rejected: "bg-ash/10 text-ash",
  failed: "bg-rose-500/15 text-rose-400",
};

const KIND_LABEL: Record<AgentAction["kind"], string> = {
  "send-email": "Email",
  "assign-owner": "Routing",
  "update-stage": "Stage",
  "log-activity": "Note",
};

function relTime(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  return hrs < 24 ? `${hrs}h ago` : `${Math.round(hrs / 24)}d ago`;
}

function targetHref(t: AgentAction["target"]): string | null {
  if (t.kind === "contact") return `/contacts/${t.id}`;
  if (t.kind === "deal") return `/deals/${t.id}`;
  if (t.kind === "company") return `/companies/${t.id}`;
  return null;
}

/** send-email proposals render as a real email preview, not a text blob. */
function EmailPreview({ action }: { action: AgentAction }) {
  const subject = String(action.payload.subject ?? "");
  const body = String(action.payload.body ?? "");
  const toEmail = String(action.payload.toEmail ?? "");
  // The detail's lead-in lines carry the handoff + delivery notes.
  const noteLines = action.detail
    .split("\n")
    .filter((l) => l.startsWith("Handed off by") || l.startsWith("⚑"));
  return (
    <div className="mt-2">
      {noteLines.map((l, i) => (
        <p key={i} className={`text-[12px] ${l.startsWith("Handed off by") ? "text-ember" : "text-ash/60"}`}>
          {l}
        </p>
      ))}
      <div className="mt-2 rounded-lg border border-ash/12 bg-obsidian p-3">
        <div className="text-[11px] text-ash/60">
          To <span className="text-ash">{toEmail || "(no email on file)"}</span>
        </div>
        <div className="mt-1 text-sm font-medium text-bone">{subject}</div>
        <p className="mt-1.5 whitespace-pre-wrap text-[13px] leading-[1.55] text-ash">{body}</p>
      </div>
    </div>
  );
}

function Row({
  action,
  onResolved,
}: {
  action: AgentAction;
  onResolved: (a: AgentAction) => void;
}) {
  const [busy, setBusy] = useState(false);
  const agentName = getAgentMeta(action.agentId)?.name ?? action.agentId;
  const href = targetHref(action.target);

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
    <div className="rounded-lg border border-ash/15 bg-graphite p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-ember/15 px-2 py-0.5 text-[10px] font-semibold text-ember">
              <span className="h-1 w-1 rounded-full bg-ember" />
              {agentName}
            </span>
            <span className="rounded bg-ash/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ash">
              {KIND_LABEL[action.kind] ?? action.kind}
            </span>
            <span className="text-[11px] text-ash/50">{relTime(action.createdAt)}</span>
          </div>
          <h5 className="mt-1.5 text-sm font-semibold text-bone">{action.title}</h5>
          {href && (
            <Link href={href} className="text-[12px] text-ash/60 transition-colors hover:text-ember">
              {action.target.label} →
            </Link>
          )}
          {action.kind === "send-email" ? (
            <EmailPreview action={action} />
          ) : (
            <p className="mt-1 whitespace-pre-wrap text-[13px] leading-[1.5] text-ash">{action.detail}</p>
          )}
          {action.error && <p className="mt-1 text-xs text-rose-400">⚠ {action.error}</p>}
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
            className="rounded-lg bg-ember px-3 py-1.5 text-xs font-medium text-bone ember-glow transition disabled:opacity-40 enabled:hover:scale-[1.02]"
          >
            {busy ? "…" : action.kind === "send-email" ? "Approve & send" : "Approve"}
          </button>
          <button
            onClick={() => resolve("reject")}
            disabled={busy}
            className="rounded-lg border border-ash/15 px-3 py-1.5 text-xs font-medium text-ash transition disabled:opacity-40 enabled:hover:bg-obsidian"
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
    return <p className="py-8 text-center text-sm text-ash/70">{emptyLabel}</p>;
  }
  return (
    <div className="space-y-2">
      {actions.map((a) => (
        <Row key={a.id} action={a} onResolved={onResolved} />
      ))}
    </div>
  );
}

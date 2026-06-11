"use client";

import { useState } from "react";
import Link from "next/link";
import { DEAL_STAGE_LABELS, type Activity, type Company, type Contact, type Deal, type Rep } from "@/lib/data/types";
import type { ScoutBrief } from "@/agents/scout";
import type { AgentRunResult } from "@/agents/types";
import type { DealAudit } from "@/agents/auditor";
import { ContactForm } from "./ContactForm";
import { ScoutBriefView } from "./ScoutBriefView";
import { LogActivity } from "./LogActivity";
import { Timeline } from "./Timeline";
import { NextBestAction } from "./NextBestAction";

const PHP = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 });

function fmtDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-PH", { day: "numeric", month: "short", year: "numeric" });
}

export function ContactDetail({
  contact,
  company,
  owner,
  deal,
  activities,
  audit,
  companies,
  reps,
}: {
  contact: Contact;
  company: Company | null;
  owner: Rep | null;
  deal: Deal | null;
  activities: Activity[];
  audit: DealAudit | null;
  companies: Company[];
  reps: Rep[];
}) {
  const [editing, setEditing] = useState(false);
  const fullName = `${contact.firstName} ${contact.lastName}`.trim();
  const initials = `${contact.firstName[0] ?? ""}${contact.lastName[0] ?? ""}`.toUpperCase();

  // Scout's pre-call brief on this contact, shown inline in a slide-over.
  const [briefing, setBriefing] = useState(false);
  const [brief, setBrief] = useState<ScoutBrief | null>(null);
  async function runScout() {
    setBriefing(true);
    try {
      const res = await fetch("/api/scout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId: contact.id }),
      });
      const data = (await res.json()) as AgentRunResult<ScoutBrief> | { error: string };
      if (!("error" in data)) setBrief(data.data);
    } finally {
      setBriefing(false);
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Link href="/contacts" className="text-[13px] text-ash/60 transition-colors hover:text-ash">← Contacts</Link>
        <div className="mt-3 flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-ember/15 text-lg font-semibold text-ember">
              {initials || "—"}
            </div>
            <div className="min-w-0">
              <h1 className="text-[clamp(1.75rem,4vw,2.75rem)] font-bold leading-[1.05] tracking-[-0.021em] text-bone">{fullName}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-ash">
                {contact.title && <span>{contact.title}</span>}
                {company && <span>· {company.name}</span>}
              </div>
            </div>
          </div>
          <button
            onClick={() => setEditing(true)}
            className="shrink-0 rounded-[4px] border border-ash/15 px-3.5 py-1.5 text-[13px] font-medium text-ash transition-colors hover:border-ember hover:text-bone"
          >
            Edit
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Main — next best action + deal + timeline */}
        <div className="lg:col-span-2">
          {/* What the agent team recommends, plus their pending proposals */}
          <NextBestAction
            contactId={contact.id}
            dealId={deal?.id}
            flag={audit?.flags[0] ?? null}
            prospectName={fullName}
          />

          {/* Their deal */}
          <section className="mb-8">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ash/70">Deal</h2>
            {deal ? (
              <Link
                href={`/deals/${deal.id}`}
                className="block rounded-xl border border-ash/12 bg-graphite p-4 transition-colors hover:border-ember/60"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-bone">{deal.name}</span>
                  <span className="rounded-full bg-ash/10 px-2 py-0.5 text-[11px] text-ash">{DEAL_STAGE_LABELS[deal.stage]}</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-[13px] text-ash">
                  <span>{PHP.format(deal.amount)}</span>
                  <span className="text-ash/60">closes {fmtDate(deal.expectedCloseDate)} · {deal.repConfidence}%</span>
                </div>
              </Link>
            ) : (
              <div className="rounded-xl border border-ash/12 bg-graphite p-4 text-[13px] text-ash/60">No deal linked to this contact yet.</div>
            )}
          </section>

          {/* Activity timeline */}
          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ash/70">Activity</h2>
            <LogActivity contactId={contact.id} dealId={deal?.id} />
            <Timeline activities={activities} />
          </section>
        </div>

        {/* Aside — facts + actions */}
        <aside className="space-y-4">
          <div className="rounded-xl border border-ash/12 bg-graphite p-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ash/70">Details</h3>
            <dl className="space-y-2.5 text-[13px]">
              <Row k="Email" v={contact.email || "—"} />
              <Row k="Phone" v={contact.phone || "—"} />
              <Row k="Company" v={company?.name ?? "—"} />
              <Row k="Owner" v={owner?.name ?? "Unassigned"} />
            </dl>
          </div>

          {contact.persona && (
            <div className="rounded-xl border border-ash/12 bg-graphite p-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-ash/70">Persona</h3>
              <p className="text-[13px] leading-[1.5] text-ash">{contact.persona}</p>
            </div>
          )}

          <button
            onClick={runScout}
            disabled={briefing}
            className="w-full rounded-[4px] bg-ember px-4 py-2.5 text-[13px] font-medium text-bone ember-glow transition-transform hover:scale-[1.02] disabled:opacity-50"
          >
            {briefing ? "Scout is reading up…" : "Have Scout brief me"}
          </button>
        </aside>
      </div>

      {editing && (
        <ContactForm initial={{ ...contact }} companies={companies} reps={reps} onClose={() => setEditing(false)} />
      )}

      {brief && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={() => setBrief(null)}>
          <div className="h-full w-full max-w-xl overflow-y-auto border-l border-ash/10 bg-graphite p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-ash/70">Scout · pre-call brief</h3>
              <button onClick={() => setBrief(null)} className="text-ash/60 hover:text-bone">✕</button>
            </div>
            <ScoutBriefView brief={brief} />
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 text-ash/60">{k}</dt>
      <dd className="min-w-0 break-words text-right text-ash">{v}</dd>
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { DEAL_STAGE_LABELS, type Activity, type Company, type Contact, type Deal, type Rep } from "@/lib/data/types";
import type { DealAudit, FlagSeverity } from "@/agents/auditor";
import { DealForm } from "./DealForm";
import { LogActivity } from "./LogActivity";
import { Timeline } from "./Timeline";
import { NextBestAction } from "./NextBestAction";

const PHP = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 });

function fmtDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-PH", { day: "numeric", month: "short", year: "numeric" });
}

const SEVERITY: Record<FlagSeverity, { text: string; dot: string; ring: string }> = {
  high: { text: "text-rose-400", dot: "bg-rose-500", ring: "border-rose-500/30" },
  medium: { text: "text-amber-400", dot: "bg-amber-500", ring: "border-amber-500/30" },
  low: { text: "text-ash", dot: "bg-ash/40", ring: "border-ash/15" },
};

export function DealDetail({
  deal,
  contact,
  company,
  owner,
  activities,
  audit,
  contacts,
  reps,
}: {
  deal: Deal;
  contact: Contact | null;
  company: Company | null;
  owner: Rep | null;
  activities: Activity[];
  audit: DealAudit | null;
  contacts: Contact[];
  reps: Rep[];
}) {
  const [editing, setEditing] = useState(false);
  const repConf = deal.repConfidence;
  const auditConf = audit?.auditorConfidence ?? repConf;
  const gap = repConf - auditConf;

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Link href="/deals" className="text-[13px] text-ash/60 transition-colors hover:text-ash">← Deals</Link>
        <div className="mt-3 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-[clamp(1.75rem,4vw,2.75rem)] font-bold leading-[1.05] tracking-[-0.021em] text-bone">{deal.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px] text-ash">
              <span className="rounded-full bg-ash/10 px-2.5 py-0.5 text-ash">{DEAL_STAGE_LABELS[deal.stage]}</span>
              {company && <span>· {company.name}</span>}
              <span>· closes {fmtDate(deal.expectedCloseDate)}</span>
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

      {/* Stat strip */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Amount" value={PHP.format(deal.amount)} />
        <Stat label="Owner" value={owner?.name ?? "Unassigned"} />
        <Stat label="Rep confidence" value={`${repConf}%`} />
        <Stat
          label="Auditor confidence"
          value={`${auditConf}%`}
          sub={gap > 0 ? `${gap}pt optimism gap` : "matches evidence"}
          accent={gap > 0}
        />
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Main — next best action + auditor flags + timeline */}
        <div className="lg:col-span-2">
          {/* What the agent team recommends, plus their pending proposals */}
          <NextBestAction
            contactId={contact?.id ?? null}
            dealId={deal.id}
            flag={audit?.flags[0] ?? null}
            prospectName={contact ? `${contact.firstName} ${contact.lastName}` : undefined}
          />

          {/* Auditor flags */}
          {audit && audit.flags.length > 0 && (
            <section className="mb-8">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ash/70">Auditor · {audit.flags.length} flag{audit.flags.length === 1 ? "" : "s"}</h2>
              <div className="space-y-2">
                {audit.flags.map((f) => {
                  const s = SEVERITY[f.severity];
                  return (
                    <div key={f.id} className={`rounded-xl border ${s.ring} bg-graphite p-4`}>
                      <div className="flex items-center gap-2">
                        <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                        <span className="text-sm font-semibold text-bone">{f.title}</span>
                        <span className={`ml-auto text-[10px] font-medium uppercase tracking-wide ${s.text}`}>{f.severity}</span>
                      </div>
                      <p className="mt-1.5 text-[13px] leading-[1.5] text-ash">{f.detail}</p>
                      <p className="mt-2 text-[12px] text-ember">→ {f.suggestedAction}</p>
                      {f.evidence.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {f.evidence.map((e, i) => (
                            <span key={i} className="rounded bg-ash/10 px-1.5 py-0.5 text-[10px] text-ash/70">{e.label}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}
          {audit && audit.flags.length === 0 && (
            <section className="mb-8">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ash/70">Auditor</h2>
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-[13px] text-emerald-400">
                Clean deal — the record matches the evidence. No flags.
              </div>
            </section>
          )}

          {/* Activity timeline */}
          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ash/70">Activity</h2>
            {contact && <LogActivity contactId={contact.id} dealId={deal.id} />}
            <Timeline activities={activities} />
          </section>
        </div>

        {/* Aside — facts + contact */}
        <aside className="space-y-4">
          <div className="rounded-xl border border-ash/12 bg-graphite p-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ash/70">Details</h3>
            <dl className="space-y-2.5 text-[13px]">
              <Row k="Stage" v={DEAL_STAGE_LABELS[deal.stage]} />
              <Row k="Property" v={deal.property || "—"} />
              <Row k="Company" v={company?.name ?? "—"} />
              <Row k="Close date" v={fmtDate(deal.expectedCloseDate)} />
              <Row k="Owner" v={owner?.name ?? "Unassigned"} />
            </dl>
          </div>

          {contact && (
            <div className="rounded-xl border border-ash/12 bg-graphite p-4">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ash/70">Contact</h3>
              <div className="text-sm font-semibold text-bone">{contact.firstName} {contact.lastName}</div>
              {contact.title && <div className="text-[12px] text-ash/70">{contact.title}</div>}
              <div className="mt-3 space-y-1.5 text-[13px] text-ash">
                {contact.email && <div className="truncate">{contact.email}</div>}
                {contact.phone && <div>{contact.phone}</div>}
              </div>
              <Link href="/contacts" className="mt-3 inline-block text-[12px] text-ember transition-opacity hover:opacity-80">View in contacts →</Link>
            </div>
          )}
        </aside>
      </div>

      {editing && (
        <DealForm initial={{ ...deal }} contacts={contacts} reps={reps} onClose={() => setEditing(false)} />
      )}
    </div>
  );
}

function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-ash/12 bg-graphite p-4">
      <div className="text-[11px] font-medium uppercase tracking-wide text-ash/60">{label}</div>
      <div className="mt-1.5 text-xl font-bold tracking-tight text-bone">{value}</div>
      {sub && <div className={`mt-0.5 text-[11px] ${accent ? "text-amber-400" : "text-ash/50"}`}>{sub}</div>}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 text-ash/60">{k}</dt>
      <dd className="min-w-0 text-right text-ash">{v}</dd>
    </div>
  );
}

"use client";

import type { AuditReport, AuditFlag, FlagSeverity } from "@/agents/auditor";

const PHP = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
});

const SEV_STYLE: Record<FlagSeverity, { chip: string; border: string }> = {
  high: { chip: "bg-rose-500/15 text-rose-400", border: "border-rose-500/30" },
  medium: { chip: "bg-amber-500/15 text-amber-400", border: "border-amber-500/30" },
  low: { chip: "bg-ash/10 text-ash", border: "border-ash/15" },
};

function FlagRow({ flag }: { flag: AuditFlag }) {
  const s = SEV_STYLE[flag.severity];
  return (
    <div className={`rounded-lg border ${s.border} bg-graphite p-3`}>
      <div className="flex items-start justify-between gap-2">
        <h5 className="text-sm font-semibold text-bone">{flag.title}</h5>
        <span
          className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${s.chip}`}
        >
          {flag.severity}
        </span>
      </div>
      <p className="mt-1 text-sm text-ash">{flag.detail}</p>
      <p className="mt-2 text-sm text-ember">
        <span className="font-medium">Do:</span> {flag.suggestedAction}
      </p>
      {/* Evidence — every flag cites its source (PRD §10) */}
      <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-ash/10 pt-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-ash/70">
          Evidence
        </span>
        {flag.evidence.map((e, i) => (
          <span
            key={i}
            className="rounded bg-obsidian px-1.5 py-0.5 text-[11px] text-ash"
            title={`${e.kind}:${e.id}`}
          >
            {e.label} · {e.id}
          </span>
        ))}
      </div>
    </div>
  );
}

export function AuditReportView({ report }: { report: AuditReport }) {
  const gapPositive = report.optimismGap > 0;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div>
        <p className="rounded-lg bg-obsidian p-3 text-sm leading-relaxed text-ash">
          {report.summary}
        </p>
      </div>

      {/* Pipeline truth: rep vs evidence */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg border border-ash/15 p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-ash/70">
            At rep confidence
          </div>
          <div className="mt-1 text-sm font-semibold text-ash">
            {PHP.format(report.repWeighted)}
          </div>
        </div>
        <div className="rounded-lg border border-ash/15 p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-ash/70">
            At the evidence
          </div>
          <div className="mt-1 text-sm font-semibold text-ash">
            {PHP.format(report.auditorWeighted)}
          </div>
        </div>
        <div
          className={`rounded-lg border p-3 ${gapPositive ? "border-rose-500/30 bg-rose-500/10" : "border-emerald-500/30 bg-emerald-500/10"}`}
        >
          <div className="text-[10px] font-semibold uppercase tracking-wide text-ash/70">
            Optimism gap
          </div>
          <div
            className={`mt-1 text-sm font-semibold ${gapPositive ? "text-rose-400" : "text-emerald-400"}`}
          >
            {PHP.format(report.optimismGap)}
          </div>
        </div>
      </div>

      <div className="flex gap-3 text-xs text-ash">
        <span>{report.totalFlags} flags</span>
        <span>·</span>
        <span>{report.highSeverity} high-severity</span>
        <span>·</span>
        <span>{report.cleanDeals} clean</span>
      </div>

      {/* Per-deal */}
      <div className="space-y-4">
        {report.deals.map((d) => (
          <div key={d.dealId} className="rounded-xl border border-ash/15 p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h4 className="text-sm font-semibold text-bone">
                  {d.prospectName}
                </h4>
                <p className="text-xs text-ash/70">
                  {d.dealName} · {d.stageLabel} · {d.amountLabel}
                </p>
              </div>
              <div className="text-right">
                <div className="text-xs text-ash/70">rep / evidence</div>
                <div className="text-sm font-semibold">
                  <span className="text-ash">{d.repConfidence}%</span>
                  <span className="text-ash/50"> → </span>
                  <span
                    className={
                      d.auditorConfidence < d.repConfidence
                        ? "text-rose-400"
                        : "text-emerald-400"
                    }
                  >
                    {d.auditorConfidence}%
                  </span>
                </div>
              </div>
            </div>

            {d.flags.length === 0 ? (
              <p className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2 text-sm text-emerald-400">
                Clean — record matches the evidence.
              </p>
            ) : (
              <div className="mt-3 space-y-2">
                {d.flags.map((f) => (
                  <FlagRow key={f.id} flag={f} />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <p className="border-t border-ash/10 pt-3 text-xs text-ash/70">
        Every flag cites the record it came from. The Auditor surfaces; the
        manager decides.
      </p>
    </div>
  );
}

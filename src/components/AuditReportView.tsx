"use client";

import type { AuditReport, AuditFlag, FlagSeverity } from "@/agents/auditor";

const PHP = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
});

const SEV_STYLE: Record<FlagSeverity, { chip: string; border: string }> = {
  high: { chip: "bg-rose-100 text-rose-700", border: "border-rose-200" },
  medium: { chip: "bg-amber-100 text-amber-700", border: "border-amber-200" },
  low: { chip: "bg-slate-100 text-slate-600", border: "border-slate-200" },
};

function FlagRow({ flag }: { flag: AuditFlag }) {
  const s = SEV_STYLE[flag.severity];
  return (
    <div className={`rounded-lg border ${s.border} bg-white p-3`}>
      <div className="flex items-start justify-between gap-2">
        <h5 className="text-sm font-semibold text-slate-800">{flag.title}</h5>
        <span
          className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${s.chip}`}
        >
          {flag.severity}
        </span>
      </div>
      <p className="mt-1 text-sm text-slate-600">{flag.detail}</p>
      <p className="mt-2 text-sm text-indigo-700">
        <span className="font-medium">Do:</span> {flag.suggestedAction}
      </p>
      {/* Evidence — every flag cites its source (PRD §10) */}
      <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          Evidence
        </span>
        {flag.evidence.map((e, i) => (
          <span
            key={i}
            className="rounded bg-slate-50 px-1.5 py-0.5 text-[11px] text-slate-500"
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
        <p className="rounded-lg bg-slate-50 p-3 text-sm leading-relaxed text-slate-700">
          {report.summary}
        </p>
      </div>

      {/* Pipeline truth: rep vs evidence */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg border border-slate-200 p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            At rep confidence
          </div>
          <div className="mt-1 text-sm font-semibold text-slate-700">
            {PHP.format(report.repWeighted)}
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            At the evidence
          </div>
          <div className="mt-1 text-sm font-semibold text-slate-700">
            {PHP.format(report.auditorWeighted)}
          </div>
        </div>
        <div
          className={`rounded-lg border p-3 ${gapPositive ? "border-rose-200 bg-rose-50" : "border-green-200 bg-green-50"}`}
        >
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Optimism gap
          </div>
          <div
            className={`mt-1 text-sm font-semibold ${gapPositive ? "text-rose-700" : "text-green-700"}`}
          >
            {PHP.format(report.optimismGap)}
          </div>
        </div>
      </div>

      <div className="flex gap-3 text-xs text-slate-500">
        <span>{report.totalFlags} flags</span>
        <span>·</span>
        <span>{report.highSeverity} high-severity</span>
        <span>·</span>
        <span>{report.cleanDeals} clean</span>
      </div>

      {/* Per-deal */}
      <div className="space-y-4">
        {report.deals.map((d) => (
          <div key={d.dealId} className="rounded-xl border border-slate-200 p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h4 className="text-sm font-semibold text-slate-800">
                  {d.prospectName}
                </h4>
                <p className="text-xs text-slate-400">
                  {d.dealName} · {d.stageLabel} · {d.amountLabel}
                </p>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-400">rep / evidence</div>
                <div className="text-sm font-semibold">
                  <span className="text-slate-500">{d.repConfidence}%</span>
                  <span className="text-slate-300"> → </span>
                  <span
                    className={
                      d.auditorConfidence < d.repConfidence
                        ? "text-rose-600"
                        : "text-green-600"
                    }
                  >
                    {d.auditorConfidence}%
                  </span>
                </div>
              </div>
            </div>

            {d.flags.length === 0 ? (
              <p className="mt-3 rounded-lg border border-green-200 bg-green-50 p-2 text-sm text-green-700">
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

      <p className="border-t border-slate-100 pt-3 text-xs text-slate-400">
        Every flag cites the record it came from. The Auditor surfaces; the
        manager decides.
      </p>
    </div>
  );
}

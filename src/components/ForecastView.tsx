"use client";

import type { Forecast, ForecastCategory, ForecastLine } from "@/agents/forecaster";

const PHP = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
});

const CAT_STYLE: Record<ForecastCategory, { label: string; chip: string }> = {
  commit: { label: "Commit", chip: "bg-green-100 text-green-700" },
  "best-case": { label: "Best case", chip: "bg-amber-100 text-amber-700" },
  pipeline: { label: "Pipeline", chip: "bg-slate-100 text-slate-600" },
};

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "rep" | "evidence" | "gap";
}) {
  const color =
    tone === "evidence"
      ? "text-green-700"
      : tone === "gap"
        ? "text-rose-700"
        : "text-slate-700";
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </div>
      <div className={`mt-1 text-sm font-semibold ${color}`}>{value}</div>
    </div>
  );
}

function DealRow({ line }: { line: ForecastLine }) {
  const cat = CAT_STYLE[line.category];
  return (
    <div className="flex items-center justify-between gap-3 border-t border-slate-100 py-2.5 text-sm">
      <div className="min-w-0">
        <div className="truncate font-medium text-slate-800">
          {line.prospectName}
        </div>
        <div className="truncate text-xs text-slate-400">
          {line.amountLabel} · closes {line.closeLabel}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className="text-xs text-slate-500">
          {line.repConfidence}%
          <span className="text-slate-300"> → </span>
          <span
            className={
              line.evidenceConfidence < line.repConfidence
                ? "text-rose-600"
                : "text-green-600"
            }
          >
            {line.evidenceConfidence}%
          </span>
        </span>
        <span
          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${cat.chip}`}
        >
          {cat.label}
        </span>
      </div>
    </div>
  );
}

export function ForecastView({ forecast }: { forecast: Forecast }) {
  const h = forecast.headline;
  return (
    <div className="space-y-6">
      {/* Digest */}
      <p className="rounded-lg bg-slate-50 p-3 text-sm leading-relaxed text-slate-700">
        {forecast.digest}
      </p>

      {/* Headline: this month, rep vs evidence */}
      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          {forecast.targetMonthLabel} · {h.dealCount} deal
          {h.dealCount === 1 ? "" : "s"} closing
        </h4>
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Rep forecast" value={PHP.format(h.repWeighted)} tone="rep" />
          <Stat
            label="Evidence-based"
            value={PHP.format(h.evidenceWeighted)}
            tone="evidence"
          />
          <Stat label="Optimism gap" value={PHP.format(h.gap)} tone="gap" />
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Stat label="Commit" value={PHP.format(h.commit)} />
          <Stat label="Best case" value={PHP.format(h.bestCase)} />
        </div>
      </div>

      {/* Top inflators */}
      {forecast.topInflators.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            What&apos;s inflating the number
          </h4>
          <ul className="space-y-2">
            {forecast.topInflators.map((l) => (
              <li
                key={l.dealId}
                className="flex items-center justify-between rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm"
              >
                <span className="text-rose-900">
                  {l.prospectName} — {l.repConfidence}% logged vs{" "}
                  {l.evidenceConfidence}% on the evidence
                </span>
                <span className="shrink-0 font-semibold text-rose-700">
                  +{PHP.format(l.inflation)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* By month */}
      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Across the pipeline
        </h4>
        <div className="space-y-4">
          {forecast.months.map((m) => (
            <div key={m.month} className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-800">
                  {m.monthLabel}
                </span>
                <span className="text-sm">
                  <span className="text-slate-500">{PHP.format(m.repWeighted)}</span>
                  <span className="text-slate-300"> → </span>
                  <span className="font-semibold text-green-700">
                    {PHP.format(m.evidenceWeighted)}
                  </span>
                </span>
              </div>
              {forecast.lines
                .filter((l) => l.month === m.month)
                .map((l) => (
                  <DealRow key={l.dealId} line={l} />
                ))}
            </div>
          ))}
        </div>
      </div>

      <p className="border-t border-slate-100 pt-3 text-xs text-slate-400">
        The evidence-based number weights each deal by the Auditor&apos;s
        reconciled confidence, not the rep&apos;s. The manager reviews; the
        forecast stays honest.
      </p>
    </div>
  );
}

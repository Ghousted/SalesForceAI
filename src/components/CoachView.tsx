"use client";

import type { CoachReport, RepCoaching } from "@/agents/coach";

const PHP = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
});

const PRIORITY_STYLE: Record<RepCoaching["priority"], string> = {
  high: "bg-rose-100 text-rose-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-slate-100 text-slate-600",
};

export function CoachView({ report }: { report: CoachReport }) {
  return (
    <div className="space-y-6">
      <p className="rounded-lg bg-slate-50 p-3 text-sm leading-relaxed text-slate-700">
        {report.summary}
      </p>

      {report.reps.length === 0 ? (
        <p className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          No coaching flags across the floor — reps are on top of their pipeline.
        </p>
      ) : (
        <div className="space-y-4">
          {report.reps.map((r) => (
            <div key={r.repId} className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="text-sm font-semibold text-slate-800">{r.repName}</h4>
                  <p className="text-xs text-slate-400">
                    {r.dealCount} deals · {r.flagCount} flags · gap {PHP.format(r.optimismGap)}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${PRIORITY_STYLE[r.priority]}`}
                >
                  {r.priority}
                </span>
              </div>

              <p className="mt-2 rounded-lg bg-indigo-50 p-2.5 text-sm text-indigo-800">
                {r.coaching}
              </p>

              <div className="mt-3 space-y-2">
                {r.focuses.map((f, i) => (
                  <div key={i} className="text-sm">
                    <span className="font-medium text-slate-700">{f.area}</span>
                    <span className="ml-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
                      {f.count}
                    </span>
                    <p className="mt-0.5 text-slate-600">{f.tip}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="border-t border-slate-100 pt-3 text-xs text-slate-400">
        Coaching comes from the same evidence the Auditor flags. The manager acts
        on the tips.
      </p>
    </div>
  );
}

"use client";

import type { CoachReport, RepCoaching } from "@/agents/coach";

const PHP = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
});

const PRIORITY_STYLE: Record<RepCoaching["priority"], string> = {
  high: "bg-rose-500/15 text-rose-400",
  medium: "bg-amber-500/15 text-amber-400",
  low: "bg-ash/10 text-ash",
};

export function CoachView({ report }: { report: CoachReport }) {
  return (
    <div className="space-y-6">
      <p className="rounded-lg bg-obsidian p-3 text-sm leading-relaxed text-ash">
        {report.summary}
      </p>

      {report.reps.length === 0 ? (
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-400">
          No coaching flags across the floor — reps are on top of their pipeline.
        </p>
      ) : (
        <div className="space-y-4">
          {report.reps.map((r) => (
            <div key={r.repId} className="rounded-xl border border-ash/15 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="text-sm font-semibold text-bone">{r.repName}</h4>
                  <p className="text-xs text-ash/70">
                    {r.dealCount} deals · {r.flagCount} flags · gap {PHP.format(r.optimismGap)}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${PRIORITY_STYLE[r.priority]}`}
                >
                  {r.priority}
                </span>
              </div>

              <p className="mt-2 rounded-lg bg-ember-smoke p-2.5 text-sm text-ember">
                {r.coaching}
              </p>

              <div className="mt-3 space-y-2">
                {r.focuses.map((f, i) => (
                  <div key={i} className="text-sm">
                    <span className="font-medium text-ash">{f.area}</span>
                    <span className="ml-1 rounded bg-ash/10 px-1.5 py-0.5 text-[10px] text-ash">
                      {f.count}
                    </span>
                    <p className="mt-0.5 text-ash">{f.tip}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="border-t border-ash/10 pt-3 text-xs text-ash/70">
        Coaching comes from the same evidence the Auditor flags. The manager acts
        on the tips.
      </p>
    </div>
  );
}

"use client";

import type { AnalystReport } from "@/agents/analyst";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        {title}
      </h4>
      {children}
    </div>
  );
}

export function AnalystView({ report }: { report: AnalystReport }) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold text-[var(--foreground)]">
          {report.prospectName}
        </h3>
        <p className="text-sm text-[var(--muted)]">
          {report.company ?? "—"}
          {report.callWhen && ` · ${report.callLabel} · ${report.callWhen}`}
        </p>
      </div>

      <Section title="How it went">
        <p className="rounded-lg bg-slate-50 p-3 text-sm leading-relaxed text-slate-700">
          {report.narrative}
        </p>
      </Section>

      {report.noCall ? null : (
        <>
          {report.wentWell.length > 0 && (
            <Section title="What went well">
              <ul className="space-y-1.5">
                {report.wentWell.map((w, i) => (
                  <li key={i} className="flex gap-2 text-sm text-slate-700">
                    <span className="text-green-500">✓</span>
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}
          {report.toImprove.length > 0 && (
            <Section title="To improve">
              <ul className="space-y-1.5">
                {report.toImprove.map((t, i) => (
                  <li key={i} className="flex gap-2 text-sm text-slate-700">
                    <span className="text-amber-500">→</span>
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </>
      )}

      <Section title="Next move">
        <p className="rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-sm font-medium text-indigo-800">
          {report.nextStep}
        </p>
      </Section>

      <p className="border-t border-slate-100 pt-3 text-xs text-slate-400">
        The Analyst reviews what's on record. The call itself — and the close —
        stay yours.
      </p>
    </div>
  );
}

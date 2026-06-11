"use client";

import type { AnalystReport } from "@/agents/analyst";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ash/70">
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
        <p className="rounded-lg bg-obsidian p-3 text-sm leading-relaxed text-ash">
          {report.narrative}
        </p>
      </Section>

      {report.noCall ? null : (
        <>
          {report.wentWell.length > 0 && (
            <Section title="What went well">
              <ul className="space-y-1.5">
                {report.wentWell.map((w, i) => (
                  <li key={i} className="flex gap-2 text-sm text-ash">
                    <span className="text-emerald-400">✓</span>
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
                  <li key={i} className="flex gap-2 text-sm text-ash">
                    <span className="text-amber-400">→</span>
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </>
      )}

      <Section title="Next move">
        <p className="rounded-lg border border-ember/50 bg-ember-smoke p-3 text-sm font-medium text-ember">
          {report.nextStep}
        </p>
      </Section>

      <p className="border-t border-ash/10 pt-3 text-xs text-ash/70">
        The Analyst reviews what's on record. The call itself — and the close —
        stay yours.
      </p>
    </div>
  );
}

"use client";

import type { ScoutBrief } from "@/agents/scout";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        {title}
      </h4>
      {children}
    </div>
  );
}

export function ScoutBriefView({ brief }: { brief: ScoutBrief }) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-xl font-semibold text-[var(--foreground)]">
          {brief.prospectName}
        </h3>
        <p className="text-sm text-[var(--muted)]">
          {brief.title} · {brief.company} · {brief.location}
        </p>
        {brief.dealHeadline && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-md bg-indigo-50 px-2 py-1 font-medium text-indigo-700">
              {brief.dealHeadline}
            </span>
            {brief.stageLabel && (
              <span className="rounded-md bg-slate-100 px-2 py-1 text-slate-600">
                {brief.stageLabel}
              </span>
            )}
            {brief.amountLabel && (
              <span className="text-slate-500">{brief.amountLabel}</span>
            )}
            {brief.expectedClose && (
              <span className="text-slate-400">
                · target close {brief.expectedClose}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Narrative (the LLM-seam output) */}
      <Section title="The short version">
        <p className="rounded-lg bg-slate-50 p-3 text-sm leading-relaxed text-slate-700">
          {brief.narrative}
        </p>
      </Section>

      {/* Signals */}
      {brief.signals.length > 0 && (
        <Section title="Act on this">
          <ul className="space-y-2">
            {brief.signals.map((s, i) => (
              <li
                key={i}
                className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
              >
                <span className="mt-0.5 text-amber-500">●</span>
                <span>{s.text}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Talking points */}
      <Section title="Talking points">
        <ul className="space-y-1.5">
          {brief.talkingPoints.map((p, i) => (
            <li key={i} className="flex gap-2 text-sm text-slate-700">
              <span className="text-indigo-400">→</span>
              <span>{p}</span>
            </li>
          ))}
        </ul>
      </Section>

      {/* Open risk */}
      {brief.openRisk && (
        <Section title="Watch out">
          <p className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
            {brief.openRisk}
          </p>
        </Section>
      )}

      {/* Timeline */}
      <Section title="What's happened so far">
        <ol className="relative space-y-3 border-l border-slate-200 pl-4">
          {brief.timeline.map((t, i) => (
            <li key={i} className="relative">
              <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-slate-300" />
              <div className="text-xs text-slate-400">
                {new Date(t.when).toLocaleDateString("en-PH", {
                  month: "short",
                  day: "numeric",
                })}{" "}
                · {t.type}
              </div>
              <div className="text-sm text-slate-700">{t.text}</div>
            </li>
          ))}
        </ol>
      </Section>

      <p className="border-t border-slate-100 pt-3 text-xs text-slate-400">
        Scout only reads the record — every line above traces to a real activity.
        The call, and the close, stay yours.
      </p>
    </div>
  );
}

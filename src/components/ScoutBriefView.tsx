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
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ash/70">
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
            <span className="rounded-md bg-ember-smoke px-2 py-1 font-medium text-ember">
              {brief.dealHeadline}
            </span>
            {brief.stageLabel && (
              <span className="rounded-md bg-ash/10 px-2 py-1 text-ash">
                {brief.stageLabel}
              </span>
            )}
            {brief.amountLabel && (
              <span className="text-ash">{brief.amountLabel}</span>
            )}
            {brief.expectedClose && (
              <span className="text-ash/70">
                · target close {brief.expectedClose}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Narrative (the LLM-seam output) */}
      <Section title="The short version">
        <p className="rounded-lg bg-obsidian p-3 text-sm leading-relaxed text-ash">
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
                className="flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-400"
              >
                <span className="mt-0.5 text-amber-400">●</span>
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
            <li key={i} className="flex gap-2 text-sm text-ash">
              <span className="text-ember">→</span>
              <span>{p}</span>
            </li>
          ))}
        </ul>
      </Section>

      {/* Open risk */}
      {brief.openRisk && (
        <Section title="Watch out">
          <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-400">
            {brief.openRisk}
          </p>
        </Section>
      )}

      {/* Timeline */}
      <Section title="What's happened so far">
        <ol className="relative space-y-3 border-l border-ash/15 pl-4">
          {brief.timeline.map((t, i) => (
            <li key={i} className="relative">
              <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-ash/20" />
              <div className="text-xs text-ash/70">
                {new Date(t.when).toLocaleDateString("en-PH", {
                  month: "short",
                  day: "numeric",
                })}{" "}
                · {t.type}
              </div>
              <div className="text-sm text-ash">{t.text}</div>
            </li>
          ))}
        </ol>
      </Section>

      <p className="border-t border-ash/10 pt-3 text-xs text-ash/70">
        Scout only reads the record — every line above traces to a real activity.
        The call, and the close, stay yours.
      </p>
    </div>
  );
}

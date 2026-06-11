"use client";

import type { DealMetrics } from "@/lib/home/metrics";

const PHP = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 1,
  notation: "compact",
});

/** The dashboard metrics strip — four pipeline stats. */
export function MetricsRow({ metrics }: { metrics: DealMetrics }) {
  const avgConf =
    metrics.pipeline > 0 ? Math.round((metrics.weighted / metrics.pipeline) * 100) : 0;

  const cards = [
    { label: "Open pipeline", value: PHP.format(metrics.pipeline), sub: `${metrics.openCount} open deal${metrics.openCount === 1 ? "" : "s"}` },
    { label: "Weighted forecast", value: PHP.format(metrics.weighted), sub: "by rep confidence" },
    { label: "Won", value: PHP.format(metrics.wonValue), sub: `${metrics.wonCount} closed-won` },
    { label: "Avg confidence", value: `${avgConf}%`, sub: "across the open book" },
  ];

  return (
    <div className="mb-10 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((c) => (
        <div
          key={c.label}
          data-reveal="hero"
          className="rounded-xl border border-ash/12 bg-graphite p-4"
        >
          <div className="text-[11px] font-medium uppercase tracking-wide text-ash/60">{c.label}</div>
          <div className="mt-1.5 text-2xl font-bold tracking-tight text-bone">{c.value}</div>
          <div className="mt-0.5 text-[11px] text-ash/50">{c.sub}</div>
        </div>
      ))}
    </div>
  );
}

"use client";

import { useRef } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import type { ReportVM, FunnelRow } from "@/lib/reports";

gsap.registerPlugin(useGSAP);

/**
 * Reports — the floor's numbers in the Cron language: obsidian canvas, one
 * ember accent, and motion that draws the data in (bars grow, the win-rate
 * ring sweeps, stats count up). SSR carries the final values; animation only
 * rewinds and replays them when motion is allowed, so reduced-motion users and
 * crawlers see the finished page.
 */

const PHP = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
});

function compact(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `₱${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (Math.abs(n) >= 1_000) return `₱${Math.round(n / 1_000)}k`;
  return `₱${n}`;
}

export function ReportsView({ report }: { report: ReportVM }) {
  const root = useRef<HTMLDivElement>(null);
  const maxCount = Math.max(1, ...report.funnel.map((f) => f.count));

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const ease = "power3.out";

        // Page furniture rises in.
        gsap.fromTo(
          "[data-reveal]",
          { y: 16, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.55, ease, stagger: 0.06, clearProps: "opacity,transform" },
        );

        // Stats count up from zero to the SSR'd value.
        gsap.utils.toArray<HTMLElement>("[data-countup]").forEach((el) => {
          const target = Number(el.dataset.countup);
          const fmt = el.dataset.format;
          const state = { v: 0 };
          gsap.to(state, {
            v: target,
            duration: 1.1,
            ease: "power2.out",
            delay: 0.15,
            onUpdate() {
              el.textContent =
                fmt === "compact" ? compact(state.v) : fmt === "pct" ? `${Math.round(state.v)}%` : String(Math.round(state.v));
            },
          });
        });

        // Funnel bars grow from the left.
        gsap.fromTo(
          "[data-bar]",
          { scaleX: 0, transformOrigin: "0 50%" },
          { scaleX: 1, duration: 0.8, ease, delay: 0.25, stagger: 0.07, clearProps: "transform" },
        );

        // Win-rate ring sweeps to its arc.
        const ring = root.current?.querySelector<SVGCircleElement>("[data-ring]");
        if (ring) {
          const C = Number(ring.dataset.circ);
          const off = Number(ring.dataset.off);
          gsap.fromTo(ring, { strokeDashoffset: C }, { strokeDashoffset: off, duration: 1.2, ease: "power2.inOut", delay: 0.3 });
        }

        // Leaderboard rows stagger in.
        gsap.fromTo(
          "[data-row]",
          { x: -10, opacity: 0 },
          { x: 0, opacity: 1, duration: 0.4, ease, delay: 0.35, stagger: 0.05, clearProps: "opacity,transform" },
        );
      });
    },
    { scope: root },
  );

  const rate = report.winRate.rate;

  return (
    <div ref={root}>
      <div data-reveal className="mb-7">
        <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
        <p className="mt-1 text-[13px] text-ash/70">
          The same truth the agents act on — what the team believes vs. what the record supports.
        </p>
      </div>

      {/* Headline stats */}
      <div data-reveal className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label="Win rate"
          value={
            rate === null ? (
              "—"
            ) : (
              <span data-countup={rate} data-format="pct">{`${rate}%`}</span>
            )
          }
          sub={`${report.winRate.won} won · ${report.winRate.lost} lost`}
        />
        <Stat
          label="Closed-won value"
          value={<span data-countup={report.wonValue} data-format="compact">{compact(report.wonValue)}</span>}
          sub={PHP.format(report.wonValue)}
        />
        <Stat
          label="Pipeline · rep confidence"
          value={<span data-countup={report.gap.repWeighted} data-format="compact">{compact(report.gap.repWeighted)}</span>}
          sub="what the team believes"
        />
        <Stat
          label="Pipeline · evidence"
          value={<span data-countup={report.gap.auditorWeighted} data-format="compact">{compact(report.gap.auditorWeighted)}</span>}
          sub={
            report.gap.optimismGap > 0
              ? `${compact(report.gap.optimismGap)} optimism gap`
              : "matches the record"
          }
          accent={report.gap.optimismGap > 0}
        />
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
        {/* Funnel */}
        <section data-reveal className="lg:col-span-3">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ash/70">
            Pipeline funnel
          </h2>
          <div className="space-y-3 rounded-xl border border-ash/12 bg-graphite p-5">
            {report.funnel.map((f) => (
              <FunnelBar key={f.stage} row={f} maxCount={maxCount} />
            ))}
          </div>
        </section>

        {/* Win-rate ring + gap callout */}
        <section data-reveal className="lg:col-span-2">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ash/70">
            Close performance
          </h2>
          <div className="flex items-center gap-5 rounded-xl border border-ash/12 bg-graphite p-5">
            <WinRing rate={rate} />
            <div className="min-w-0">
              <div className="text-sm font-semibold text-bone">
                {rate === null ? "No closed deals yet" : `${report.winRate.won} of ${report.winRate.won + report.winRate.lost} closed deals won`}
              </div>
              <p className="mt-1 text-[12px] leading-[1.5] text-ash/70">
                {rate === null
                  ? "Win rate appears once deals start closing."
                  : `Worth ${PHP.format(report.wonValue)} in closed-won value.`}
              </p>
            </div>
          </div>

          <div
            className={`mt-3 rounded-xl border p-4 ${
              report.gap.optimismGap > 0 ? "border-ember/30 bg-ember/[0.06]" : "border-emerald-500/30 bg-emerald-500/10"
            }`}
          >
            {report.gap.optimismGap > 0 ? (
              <>
                <div className="text-sm font-semibold text-bone">
                  {compact(report.gap.optimismGap)} of optimism in the pipeline
                </div>
                <p className="mt-1 text-[12px] leading-[1.5] text-ash">
                  The team&apos;s confidence is ahead of the evidence. The Auditor&apos;s flags show
                  exactly which deals carry the gap.
                </p>
              </>
            ) : (
              <>
                <div className="text-sm font-semibold text-emerald-400">Confidence matches the record</div>
                <p className="mt-1 text-[12px] leading-[1.5] text-ash">
                  No optimism gap — the pipeline is as real as it looks.
                </p>
              </>
            )}
          </div>
        </section>
      </div>

      {/* Leaderboard */}
      <section data-reveal className="mt-8">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ash/70">
          Rep leaderboard
        </h2>
        <div className="overflow-hidden rounded-xl border border-ash/12 bg-graphite">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-ash/10 text-left text-[11px] uppercase tracking-wide text-ash/60">
                <th className="px-4 py-2.5 font-medium">Rep</th>
                <th className="px-3 py-2.5 text-right font-medium">Open deals</th>
                <th className="px-3 py-2.5 text-right font-medium">Pipeline</th>
                <th className="px-3 py-2.5 text-right font-medium">Weighted</th>
                <th className="px-4 py-2.5 text-right font-medium">Won</th>
              </tr>
            </thead>
            <tbody>
              {report.leaderboard.map((r, i) => (
                <tr key={r.repId} data-row className="border-b border-ash/5 last:border-0">
                  <td className="px-4 py-2.5">
                    <span
                      className={`mr-2.5 inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                        i === 0 ? "bg-ember/20 text-ember" : "bg-ash/10 text-ash/60"
                      }`}
                    >
                      {i + 1}
                    </span>
                    <span className="font-medium text-bone">{r.name}</span>
                  </td>
                  <td className="px-3 py-2.5 text-right text-ash">{r.openCount}</td>
                  <td className="px-3 py-2.5 text-right text-ash">{compact(r.pipeline)}</td>
                  <td className="px-3 py-2.5 text-right text-ash">{compact(r.weighted)}</td>
                  <td className="px-4 py-2.5 text-right text-ash">
                    {r.wonCount > 0 ? `${r.wonCount} · ${compact(r.wonValue)}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[12px] text-ash/50">
          Weighted = open pipeline × the rep&apos;s own confidence. The evidence-based view is in the
          headline stats — the gap between them is what the Auditor watches.
        </p>
      </section>
    </div>
  );
}

function FunnelBar({ row, maxCount }: { row: FunnelRow; maxCount: number }) {
  const pct = Math.max(4, Math.round((row.count / maxCount) * 100));
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-[12px]">
        <span className="text-ash">{row.label}</span>
        <span className="text-ash/60">
          {row.count} deal{row.count === 1 ? "" : "s"} · {compact(row.value)}
        </span>
      </div>
      <div className="h-5 overflow-hidden rounded-[3px] bg-ash/5">
        {row.count > 0 && (
          <div data-bar className="h-full rounded-[3px] bg-ember/80" style={{ width: `${pct}%` }} />
        )}
      </div>
    </div>
  );
}

/** Ember arc on an ash track — the win rate at a glance. */
function WinRing({ rate }: { rate: number | null }) {
  const R = 42;
  const C = 2 * Math.PI * R;
  const off = rate === null ? C : C * (1 - rate / 100);
  return (
    <div className="relative h-28 w-28 shrink-0">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={R} fill="none" stroke="currentColor" strokeWidth="7" className="text-ash/10" />
        {rate !== null && (
          <circle
            data-ring
            data-circ={C}
            data-off={off}
            cx="50"
            cy="50"
            r={R}
            fill="none"
            stroke="#ff4700"
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={off}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xl font-bold tracking-tight text-bone">
          {rate === null ? "—" : `${rate}%`}
        </span>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-ash/12 bg-graphite p-4">
      <div className="text-[11px] font-medium uppercase tracking-wide text-ash/60">{label}</div>
      <div className="mt-1.5 text-xl font-bold tracking-tight text-bone">{value}</div>
      {sub && <div className={`mt-0.5 text-[11px] ${accent ? "text-amber-400" : "text-ash/50"}`}>{sub}</div>}
    </div>
  );
}

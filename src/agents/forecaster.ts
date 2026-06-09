import { auditBook } from "./auditor";
import { spineNow } from "@/lib/data/spine";
import { getLLM } from "@/lib/llm/provider";
import { php, formatDate } from "@/lib/format";
import type { AgentRunResult } from "./types";

/**
 * Forecaster — "adds it all up to predict the month." (Behind the scenes, Ops.)
 *
 * It builds directly on the Auditor: every deal already carries an
 * evidence-based confidence and the optimism gap is already computed. The
 * Forecaster's job is to roll those up into a period forecast and — the whole
 * point — show the *honest* number (weighted by evidence) next to the *rep*
 * number (weighted by self-reported confidence), so a manager forecasts from
 * reconciled reality rather than optimism.
 *
 * Deterministic maths; only the manager digest routes through the LLM seam.
 */

const CLOSED_STAGES = new Set(["closed-won", "closed-lost"]);

/** Evidence-confidence thresholds for the forecast ladder. */
const COMMIT_FLOOR = 70;
const BEST_CASE_FLOOR = 40;

export type ForecastCategory = "commit" | "best-case" | "pipeline";

export interface ForecastLine {
  dealId: string;
  dealName: string;
  prospectName: string;
  amount: number;
  amountLabel: string;
  closeLabel: string;
  month: string; // "YYYY-MM"
  monthLabel: string;
  repConfidence: number;
  evidenceConfidence: number;
  category: ForecastCategory;
  /** PHP this deal adds to the optimism gap (amount × (rep − evidence)). */
  inflation: number;
  flagCount: number;
}

export interface MonthForecast {
  month: string;
  monthLabel: string;
  dealCount: number;
  /** Σ amount where evidence ≥ commit floor. */
  commit: number;
  /** Σ amount where evidence ≥ best-case floor (includes commit). */
  bestCase: number;
  repWeighted: number;
  evidenceWeighted: number;
  gap: number;
}

export interface Forecast {
  generatedFor: string;
  targetMonth: string;
  targetMonthLabel: string;
  digest: string;
  headline: {
    dealCount: number;
    commit: number;
    bestCase: number;
    repWeighted: number;
    evidenceWeighted: number;
    gap: number;
  };
  months: MonthForecast[];
  lines: ForecastLine[];
  /** Deals inflating the forecast most — where rep optimism outruns evidence. */
  topInflators: ForecastLine[];
}

function monthKey(iso: string): string {
  return iso.slice(0, 7); // "YYYY-MM"
}
function monthLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("en-PH", {
    month: "long",
    year: "numeric",
  });
}
function categorize(evidence: number): ForecastCategory {
  if (evidence >= COMMIT_FLOOR) return "commit";
  if (evidence >= BEST_CASE_FLOOR) return "best-case";
  return "pipeline";
}

function summariseMonth(month: string, label: string, lines: ForecastLine[]): MonthForecast {
  const inMonth = lines.filter((l) => l.month === month);
  const commit = inMonth
    .filter((l) => l.category === "commit")
    .reduce((s, l) => s + l.amount, 0);
  const bestCase = inMonth
    .filter((l) => l.category !== "pipeline")
    .reduce((s, l) => s + l.amount, 0);
  const repWeighted = inMonth.reduce(
    (s, l) => s + (l.amount * l.repConfidence) / 100,
    0,
  );
  const evidenceWeighted = inMonth.reduce(
    (s, l) => s + (l.amount * l.evidenceConfidence) / 100,
    0,
  );
  return {
    month,
    monthLabel: label,
    dealCount: inMonth.length,
    commit: Math.round(commit),
    bestCase: Math.round(bestCase),
    repWeighted: Math.round(repWeighted),
    evidenceWeighted: Math.round(evidenceWeighted),
    gap: Math.round(repWeighted - evidenceWeighted),
  };
}

export async function runForecaster(
  repId?: string,
): Promise<AgentRunResult<Forecast>> {
  const now = spineNow();
  const targetMonth = now.toISOString().slice(0, 7);
  const targetMonthLabel = now.toLocaleDateString("en-PH", {
    month: "long",
    year: "numeric",
  });

  // Open deals only, carrying the Auditor's evidence-based confidence.
  const audits = auditBook(repId).filter(
    (d) => !CLOSED_STAGES.has(stageKeyFromLabel(d.stageLabel)),
  );

  const lines: ForecastLine[] = audits
    .map((d) => {
      const inflation = Math.round(
        (d.amount * (d.repConfidence - d.auditorConfidence)) / 100,
      );
      return {
        dealId: d.dealId,
        dealName: d.dealName,
        prospectName: d.prospectName,
        amount: d.amount,
        amountLabel: d.amountLabel,
        closeLabel: formatDate(d.expectedCloseDate),
        month: monthKey(d.expectedCloseDate),
        monthLabel: monthLabel(d.expectedCloseDate),
        repConfidence: d.repConfidence,
        evidenceConfidence: d.auditorConfidence,
        category: categorize(d.auditorConfidence),
        inflation,
        flagCount: d.flags.length,
      };
    })
    .sort((a, b) => a.month.localeCompare(b.month));

  // One bucket per distinct close month, in chronological order.
  const monthsSeen = Array.from(new Set(lines.map((l) => l.month))).sort();
  const months = monthsSeen.map((m) => {
    const label = lines.find((l) => l.month === m)!.monthLabel;
    return summariseMonth(m, label, lines);
  });

  const target =
    months.find((m) => m.month === targetMonth) ??
    summariseMonth(targetMonth, targetMonthLabel, lines);

  const topInflators = [...lines]
    .filter((l) => l.inflation > 0)
    .sort((a, b) => b.inflation - a.inflation)
    .slice(0, 3);

  const llm = getLLM();
  const digest = await llm.complete({
    agent: "forecaster",
    system:
      "You are the Forecaster briefing a sales manager. In 2 sentences, give the month's evidence-based number vs the rep number and the gap, then name the single deal inflating the forecast most. Use only the figures provided.",
    user:
      `${targetMonthLabel}: evidence-based forecast ${php(target.evidenceWeighted)} vs rep forecast ${php(target.repWeighted)} (gap ${php(target.gap)}), across ${target.dealCount} deal(s); commit ${php(target.commit)}, best case ${php(target.bestCase)}. ` +
      (topInflators[0]
        ? `Biggest inflator: ${topInflators[0].prospectName} adds ${php(topInflators[0].inflation)} of optimism (${topInflators[0].repConfidence}% logged vs ${topInflators[0].evidenceConfidence}% on the evidence).`
        : "No optimism gap — rep and evidence agree."),
    grounding: { target, months, topInflators },
  });

  return {
    agentId: "forecaster",
    headline: `${targetMonthLabel}: ${php(target.evidenceWeighted)} forecast (evidence-based)`,
    data: {
      generatedFor: repId ?? "all reps",
      targetMonth,
      targetMonthLabel,
      digest,
      headline: {
        dealCount: target.dealCount,
        commit: target.commit,
        bestCase: target.bestCase,
        repWeighted: target.repWeighted,
        evidenceWeighted: target.evidenceWeighted,
        gap: target.gap,
      },
      months,
      lines,
      topInflators,
    },
    requiresApproval: undefined,
    evidence: lines.map((l) => ({
      kind: "deal" as const,
      id: l.dealId,
      label: l.dealName,
    })),
  };
}

/** Forecaster's push status for the roster home. */
export function forecasterStatus(repId: string): {
  monthLabel: string;
  evidenceWeighted: number;
} {
  const now = spineNow();
  const targetMonth = now.toISOString().slice(0, 7);
  const audits = auditBook(repId).filter(
    (d) => monthKey(d.expectedCloseDate) === targetMonth,
  );
  const evidenceWeighted = audits.reduce(
    (s, d) => s + (d.amount * d.auditorConfidence) / 100,
    0,
  );
  return {
    monthLabel: now.toLocaleDateString("en-PH", { month: "short" }),
    evidenceWeighted: Math.round(evidenceWeighted),
  };
}

/**
 * The DealAudit carries a human stage label; map it back to a stage key just to
 * filter out closed deals. Kept local so the Auditor's public shape is unchanged.
 */
function stageKeyFromLabel(label: string): string {
  if (/won/i.test(label)) return "closed-won";
  if (/lost/i.test(label)) return "closed-lost";
  return "open";
}

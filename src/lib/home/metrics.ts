import type { Deal } from "@/lib/data/types";

/** Pipeline metrics for the dashboard header — derived from a set of deals. */
export interface DealMetrics {
  openCount: number;
  /** Σ amount of open deals. */
  pipeline: number;
  /** Σ amount × rep confidence of open deals. */
  weighted: number;
  /** Σ amount of closed-won deals. */
  wonValue: number;
  wonCount: number;
}

export function buildDealMetrics(deals: Deal[]): DealMetrics {
  let openCount = 0;
  let pipeline = 0;
  let weighted = 0;
  let wonValue = 0;
  let wonCount = 0;
  for (const d of deals) {
    if (d.stage === "closed-won") {
      wonValue += d.amount;
      wonCount++;
    } else if (d.stage !== "closed-lost") {
      openCount++;
      pipeline += d.amount;
      weighted += (d.amount * d.repConfidence) / 100;
    }
  }
  return {
    openCount,
    pipeline,
    weighted: Math.round(weighted),
    wonValue,
    wonCount,
  };
}

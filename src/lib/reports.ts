import { listAllDeals, listDealsForRep, listReps } from "@/lib/data/spine";
import { auditBook } from "@/agents/auditor";
import { DEAL_STAGE_LABELS, type DealStage } from "@/lib/data/types";

/**
 * Reporting view-model — all server-computed from the spine + the Auditor's
 * evidence-based confidence, so the charts carry the same truth the agents act
 * on (not a separate metrics pipeline that can drift).
 */

const OPEN_STAGES: DealStage[] = [
  "new",
  "qualifying",
  "viewing-scheduled",
  "proposal",
  "reservation",
];

export interface FunnelRow {
  stage: DealStage;
  label: string;
  count: number;
  value: number;
}

export interface LeaderRow {
  repId: string;
  name: string;
  openCount: number;
  pipeline: number;
  /** Pipeline weighted by the rep's own confidence. */
  weighted: number;
  wonValue: number;
  wonCount: number;
}

export interface ReportVM {
  funnel: FunnelRow[];
  winRate: { won: number; lost: number; rate: number | null };
  wonValue: number;
  gap: { repWeighted: number; auditorWeighted: number; optimismGap: number };
  leaderboard: LeaderRow[];
}

export function buildReport(): ReportVM {
  const deals = listAllDeals();

  const funnel: FunnelRow[] = OPEN_STAGES.map((stage) => {
    const inStage = deals.filter((d) => d.stage === stage);
    return {
      stage,
      label: DEAL_STAGE_LABELS[stage],
      count: inStage.length,
      value: inStage.reduce((s, d) => s + d.amount, 0),
    };
  });

  const won = deals.filter((d) => d.stage === "closed-won");
  const lost = deals.filter((d) => d.stage === "closed-lost");
  const closed = won.length + lost.length;
  const winRate = {
    won: won.length,
    lost: lost.length,
    rate: closed > 0 ? Math.round((won.length / closed) * 100) : null,
  };
  const wonValue = won.reduce((s, d) => s + d.amount, 0);

  // Optimism gap over OPEN deals only — closed deals have no confidence story.
  const openIds = new Set(deals.filter((d) => OPEN_STAGES.includes(d.stage)).map((d) => d.id));
  const audits = auditBook().filter((a) => openIds.has(a.dealId));
  const repWeighted = audits.reduce((s, a) => s + (a.amount * a.repConfidence) / 100, 0);
  const auditorWeighted = audits.reduce((s, a) => s + (a.amount * a.auditorConfidence) / 100, 0);

  const leaderboard: LeaderRow[] = listReps()
    .map((rep) => {
      const book = listDealsForRep(rep.id);
      const open = book.filter((d) => OPEN_STAGES.includes(d.stage));
      const repWon = book.filter((d) => d.stage === "closed-won");
      return {
        repId: rep.id,
        name: rep.name,
        openCount: open.length,
        pipeline: open.reduce((s, d) => s + d.amount, 0),
        weighted: open.reduce((s, d) => s + (d.amount * d.repConfidence) / 100, 0),
        wonValue: repWon.reduce((s, d) => s + d.amount, 0),
        wonCount: repWon.length,
      };
    })
    .sort((a, b) => b.weighted - a.weighted);

  return {
    funnel,
    winRate,
    wonValue,
    gap: {
      repWeighted: Math.round(repWeighted),
      auditorWeighted: Math.round(auditorWeighted),
      optimismGap: Math.round(repWeighted - auditorWeighted),
    },
    leaderboard,
  };
}

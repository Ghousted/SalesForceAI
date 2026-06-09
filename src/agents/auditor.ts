import {
  listAllDeals,
  listDealsForRep,
  listActivitiesForContact,
  getContact,
  spineNow,
} from "@/lib/data/spine";
import { DEAL_STAGE_LABELS, type Activity, type Deal } from "@/lib/data/types";
import { getLLM } from "@/lib/llm/provider";
import { php, formatDate, daysBetween } from "@/lib/format";
import type { AgentRunResult, EvidenceRef } from "./types";

/**
 * Auditor — "fact-checks notes against what really happened." (Must-have.)
 *
 * It reconciles each deal's *recorded* state (stage, the rep's own confidence)
 * against the *actual* activity on the spine, and raises flags where the record
 * is more optimistic than the evidence supports.
 *
 * Two PRD rules govern the whole design:
 *  - §10 "Trustable flags": every flag MUST cite its evidence (a specific
 *    activity/email/note) so a manager can verify it. No uncited flags.
 *  - §12 risk: inaccurate flags erode trust fast — so rules are conservative
 *    and a clean deal produces *no* flags rather than noise.
 *
 * The reconciliation is deterministic (grounded in records); only the
 * manager-facing summary sentence routes through the LLM seam.
 */

export type FlagSeverity = "high" | "medium" | "low";

const SEVERITY_RANK: Record<FlagSeverity, number> = { high: 3, medium: 2, low: 1 };

export interface AuditFlag {
  id: string;
  ruleId: string;
  dealId: string;
  dealName: string;
  prospectName: string;
  severity: FlagSeverity;
  title: string;
  detail: string;
  /** What the rep should do about it. */
  suggestedAction: string;
  /** Provenance — the records this flag is built on (PRD §10). */
  evidence: EvidenceRef[];
  /** How much this rule discounts the deal's confidence. */
  confidenceImpact: number;
}

export interface DealAudit {
  dealId: string;
  dealName: string;
  prospectName: string;
  stageLabel: string;
  amount: number;
  amountLabel: string;
  expectedCloseDate: string;
  repConfidence: number;
  /** Auditor's grounded confidence after applying flag impacts. */
  auditorConfidence: number;
  flags: AuditFlag[];
}

export interface AuditReport {
  generatedFor: string;
  summary: string;
  deals: DealAudit[];
  totalFlags: number;
  highSeverity: number;
  cleanDeals: number;
  /** Pipeline weighted by the rep's own confidence. */
  repWeighted: number;
  /** Pipeline weighted by the Auditor's grounded confidence. */
  auditorWeighted: number;
  /** repWeighted − auditorWeighted: the optimism gap, in PHP. */
  optimismGap: number;
}

// --- Rule helpers -----------------------------------------------------------

function lastInbound(acts: Activity[]): Activity | undefined {
  return acts.filter((a) => a.direction === "inbound").at(-1);
}
function lastOutbound(acts: Activity[]): Activity | undefined {
  return acts.filter((a) => a.direction === "outbound").at(-1);
}
function ev(a: Activity, label: string): EvidenceRef {
  return { kind: "activity", id: a.id, label };
}

const RISK_NOTE = /risk|cold|not yet|hasn'?t|missed|overdue|stalled|no response/i;

/**
 * Run every rule against one deal. Each rule that fires returns a fully-cited
 * flag or nothing. Rules are intentionally narrow to avoid false positives.
 */
function auditDeal(deal: Deal): DealAudit {
  const contact = getContact(deal.contactId);
  const prospectName = contact
    ? `${contact.firstName} ${contact.lastName}`
    : deal.contactId;
  const acts = listActivitiesForContact(deal.contactId);
  const now = spineNow();
  const flags: AuditFlag[] = [];

  const closeIn = daysBetween(now, deal.expectedCloseDate);
  const highStakes = deal.amount >= 20_000_000 || closeIn <= 21;

  // R1 — Unanswered inbound: the prospect's latest message is newer than the
  // rep's latest reply (or there is no reply at all).
  const inbound = lastInbound(acts);
  const outbound = lastOutbound(acts);
  if (inbound && (!outbound || inbound.timestamp > outbound.timestamp)) {
    flags.push({
      id: `${deal.id}:R1`,
      ruleId: "unanswered-inbound",
      dealId: deal.id,
      dealName: deal.name,
      prospectName,
      severity: highStakes ? "high" : "medium",
      title: "Prospect is waiting on a reply",
      detail: `${prospectName} last reached out on ${formatDate(inbound.timestamp)} ("${inbound.subject}") and there's no response logged since. The deal is recorded at ${deal.repConfidence}% confidence.`,
      suggestedAction: `Reply to "${inbound.subject}" before the next touch.`,
      evidence: [ev(inbound, "prospect's last message")],
      confidenceImpact: highStakes ? 18 : 12,
    });
  }

  // R2 — Stage vs evidence mismatch: the stage claims an artifact exists that
  // the activity record doesn't back up.
  if (deal.stage === "proposal") {
    const hasProposal = acts.some(
      (a) =>
        a.direction === "outbound" &&
        /proposal|quote|terms|offer/i.test(`${a.subject} ${a.body}`),
    );
    if (!hasProposal) {
      flags.push({
        id: `${deal.id}:R2`,
        ruleId: "stage-evidence-mismatch",
        dealId: deal.id,
        dealName: deal.name,
        prospectName,
        severity: "high",
        title: "Stage says proposal sent — none on record",
        detail: `Deal is in "${DEAL_STAGE_LABELS[deal.stage]}" but no outbound proposal is logged in the activity history.`,
        suggestedAction: "Send the proposal or correct the deal stage.",
        evidence: [{ kind: "deal", id: deal.id, label: deal.name }],
        confidenceImpact: 20,
      });
    }
  }
  if (deal.stage === "viewing-scheduled") {
    const hasViewing = acts.some((a) => a.type === "viewing");
    if (!hasViewing) {
      flags.push({
        id: `${deal.id}:R2v`,
        ruleId: "stage-evidence-mismatch",
        dealId: deal.id,
        dealName: deal.name,
        prospectName,
        severity: "medium",
        title: "Stage says viewing scheduled — none on record",
        detail: `Deal is in "${DEAL_STAGE_LABELS[deal.stage]}" but no viewing activity is logged.`,
        suggestedAction: "Book the viewing or correct the deal stage.",
        evidence: [{ kind: "deal", id: deal.id, label: deal.name }],
        confidenceImpact: 15,
      });
    }
  }

  // R3 — Optimistic confidence: an internal note flags risk, yet the rep's
  // confidence is still ≥ 50%.
  const riskNote = acts.find((a) => a.type === "note" && RISK_NOTE.test(a.body));
  if (riskNote && deal.repConfidence >= 50) {
    flags.push({
      id: `${deal.id}:R3`,
      ruleId: "optimistic-confidence",
      dealId: deal.id,
      dealName: deal.name,
      prospectName,
      severity: "high",
      title: "Confidence looks optimistic",
      detail: `An internal note raises a risk ("${riskNote.body}") but the deal is still logged at ${deal.repConfidence}% confidence.`,
      suggestedAction: "Re-rate the deal or act on the noted risk this week.",
      evidence: [ev(riskNote, "internal risk note")],
      confidenceImpact: 20,
    });
  }

  // R4 — Close-date pressure: close date is near while an open concern stands.
  if (closeIn >= 0 && closeIn <= 30 && (inbound || riskNote)) {
    const already = flags.length > 0;
    flags.push({
      id: `${deal.id}:R4`,
      ruleId: "close-date-pressure",
      dealId: deal.id,
      dealName: deal.name,
      prospectName,
      severity: already ? "medium" : "low",
      title: `Closes in ${closeIn} days with an open thread`,
      detail: `Target close is ${formatDate(deal.expectedCloseDate)} (${closeIn} days out) while there's still an unresolved item on the deal.`,
      suggestedAction: "Resolve the open item or move the close date to reality.",
      evidence: [{ kind: "deal", id: deal.id, label: deal.name }],
      confidenceImpact: 8,
    });
  }

  // R5 — Going quiet: no activity in over 21 days.
  const lastAct = acts.at(-1);
  if (lastAct) {
    const sinceLast = daysBetween(lastAct.timestamp, now);
    if (sinceLast > 21) {
      flags.push({
        id: `${deal.id}:R5`,
        ruleId: "going-quiet",
        dealId: deal.id,
        dealName: deal.name,
        prospectName,
        severity: "low",
        title: `Quiet for ${sinceLast} days`,
        detail: `Last activity was ${formatDate(lastAct.timestamp)} ("${lastAct.subject}").`,
        suggestedAction: "Re-engage or let the deal lapse honestly.",
        evidence: [ev(lastAct, "most recent activity")],
        confidenceImpact: 10,
      });
    }
  }

  const totalImpact = flags.reduce((s, f) => s + f.confidenceImpact, 0);
  const auditorConfidence = Math.max(
    5,
    Math.min(deal.repConfidence, deal.repConfidence - totalImpact),
  );

  // Sort flags by severity, highest first.
  flags.sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]);

  return {
    dealId: deal.id,
    dealName: deal.name,
    prospectName,
    stageLabel: DEAL_STAGE_LABELS[deal.stage],
    amount: deal.amount,
    amountLabel: php(deal.amount),
    expectedCloseDate: deal.expectedCloseDate,
    repConfidence: deal.repConfidence,
    auditorConfidence,
    flags,
  };
}

/**
 * Reconcile a rep's book (or the whole floor if `repId` omitted) into per-deal
 * audits. Shared with the Forecaster, which builds on each deal's
 * evidence-based confidence.
 */
export function auditBook(repId?: string): DealAudit[] {
  const deals = repId ? listDealsForRep(repId) : listAllDeals();
  return deals.map(auditDeal);
}

/**
 * Run the Auditor over a rep's book (or the whole floor if `repId` omitted).
 */
export async function runAuditor(
  repId?: string,
): Promise<AgentRunResult<AuditReport>> {
  const audits = auditBook(repId);

  const totalFlags = audits.reduce((s, d) => s + d.flags.length, 0);
  const highSeverity = audits.reduce(
    (s, d) => s + d.flags.filter((f) => f.severity === "high").length,
    0,
  );
  const cleanDeals = audits.filter((d) => d.flags.length === 0).length;

  const repWeighted = audits.reduce(
    (s, d) => s + (d.amount * d.repConfidence) / 100,
    0,
  );
  const auditorWeighted = audits.reduce(
    (s, d) => s + (d.amount * d.auditorConfidence) / 100,
    0,
  );
  const optimismGap = repWeighted - auditorWeighted;

  // Manager-facing summary through the LLM seam, grounded in the tallies above.
  const llm = getLLM();
  const summary = await llm.complete({
    agent: "auditor",
    system:
      "You are the Auditor reporting to a sales manager. In 1–2 sentences, state how many flags were raised, the biggest risk, and the gap between the team's pipeline confidence and the evidence. Be factual; cite numbers only from the input.",
    user:
      `${totalFlags} flag(s) across ${audits.length} deals (${highSeverity} high-severity, ${cleanDeals} clean). ` +
      `Pipeline at rep confidence: ${php(Math.round(repWeighted))}; at evidence-based confidence: ${php(Math.round(auditorWeighted))}; ` +
      `optimism gap: ${php(Math.round(optimismGap))}.` +
      (highSeverity > 0
        ? ` Biggest risks: ${audits
            .flatMap((d) => d.flags)
            .filter((f) => f.severity === "high")
            .map((f) => `${f.prospectName} — ${f.title}`)
            .join("; ")}.`
        : ""),
    grounding: audits,
  });

  // Every flag carries evidence — assert provenance at the report level too.
  const evidence: EvidenceRef[] = audits.flatMap((d) =>
    d.flags.flatMap((f) => f.evidence),
  );

  return {
    agentId: "auditor",
    headline: `${totalFlags} flag${totalFlags === 1 ? "" : "s"} across ${audits.length} deals`,
    data: {
      generatedFor: repId ?? "all reps",
      summary,
      deals: audits,
      totalFlags,
      highSeverity,
      cleanDeals,
      repWeighted: Math.round(repWeighted),
      auditorWeighted: Math.round(auditorWeighted),
      optimismGap: Math.round(optimismGap),
    },
    evidence,
    requiresApproval: undefined, // Auditor surfaces flags; the manager acts.
  };
}

/** Auditor's push status for the roster home. */
export function auditorStatus(repId: string): {
  totalFlags: number;
  highSeverity: number;
} {
  const audits = auditBook(repId);
  return {
    totalFlags: audits.reduce((s, d) => s + d.flags.length, 0),
    highSeverity: audits.reduce(
      (s, d) => s + d.flags.filter((f) => f.severity === "high").length,
      0,
    ),
  };
}

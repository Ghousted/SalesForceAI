import {
  buildDossier,
  listContactsForRep,
  type ProspectDossier,
} from "@/lib/data/spine";
import { DEAL_STAGE_LABELS, type Activity } from "@/lib/data/types";
import { getLLM } from "@/lib/llm/provider";
import { formatDate } from "@/lib/format";
import type { AgentRunResult, EvidenceRef } from "./types";

/**
 * Analyst — "watches the replay and tells you how it went." (After, Rep.)
 *
 * Post-call analysis: it reads the most recent call/meeting and the activity
 * around it, and tells the rep what went well, what to improve, and the single
 * next move. Read-only. (With real conversation-intelligence transcripts it goes
 * deeper; here it reasons over the logged interaction + timeline.)
 */

const CALL_TYPES = new Set(["call", "meeting", "viewing"]);

export interface AnalystReport {
  contactId: string;
  prospectName: string;
  company: string | null;
  dealHeadline: string | null;
  stageLabel: string | null;
  callLabel: string | null;
  callWhen: string | null;
  noCall: boolean;
  narrative: string;
  wentWell: string[];
  toImprove: string[];
  nextStep: string;
}

function lastCall(acts: Activity[]): Activity | undefined {
  return acts.filter((a) => CALL_TYPES.has(a.type)).at(-1);
}

function analyze(dossier: ProspectDossier, call: Activity) {
  const { activities, deal } = dossier;
  const after = activities.filter((a) => a.timestamp > call.timestamp);
  const inboundAfter = after.find((a) => a.direction === "inbound");
  const outboundAfter = after.find((a) => a.direction === "outbound");

  const wentWell: string[] = [];
  const toImprove: string[] = [];

  wentWell.push(`A ${call.type} took place on ${formatDate(call.timestamp)} — you're engaged.`);
  if (inboundAfter)
    wentWell.push(`The prospect re-engaged afterward ("${inboundAfter.subject}").`);
  if (deal && (deal.stage === "proposal" || deal.stage === "reservation"))
    wentWell.push(`The deal is at "${DEAL_STAGE_LABELS[deal.stage]}" — real momentum.`);

  if (inboundAfter && (!outboundAfter || inboundAfter.timestamp > outboundAfter.timestamp))
    toImprove.push(`Their message since the ${call.type} ("${inboundAfter.subject}") isn't answered yet.`);
  if (!outboundAfter && !inboundAfter)
    toImprove.push(`No follow-up is logged after the ${call.type}.`);
  if (after.length === 0)
    toImprove.push("Nothing has happened since — the thread can go cold fast.");

  let nextStep: string;
  if (inboundAfter) nextStep = `Reply to "${inboundAfter.subject}" today — it's the open thread.`;
  else if (deal?.stage === "proposal") nextStep = "Chase a decision date on the proposal.";
  else if (deal?.stage === "viewing-scheduled") nextStep = "Confirm the viewing and prep for it.";
  else nextStep = "Send a short recap and propose the next concrete step.";

  return { wentWell, toImprove, nextStep };
}

export async function runAnalyst(contactId: string): Promise<AgentRunResult<AnalystReport>> {
  const dossier = buildDossier(contactId);
  if (!dossier) throw new Error(`Analyst: no contact ${contactId}`);

  const { contact, company, deal, activities } = dossier;
  const prospectName = `${contact.firstName} ${contact.lastName}`.trim();
  const call = lastCall(activities);

  if (!call) {
    return {
      agentId: "analyst",
      headline: `No call to analyze for ${prospectName} yet`,
      data: {
        contactId, prospectName,
        company: company?.name ?? null,
        dealHeadline: deal?.property ?? null,
        stageLabel: deal ? DEAL_STAGE_LABELS[deal.stage] : null,
        callLabel: null, callWhen: null, noCall: true,
        narrative: "No call or meeting is on record for this prospect yet — nothing to review.",
        wentWell: [], toImprove: [], nextStep: "Book the first call.",
      },
      evidence: [{ kind: "contact", id: contact.id, label: prospectName }],
    };
  }

  const { wentWell, toImprove, nextStep } = analyze(dossier, call);

  const llm = getLLM();
  const narrative = await llm.complete({
    agent: "analyst",
    system:
      "You are the Analyst doing a post-call review. In 2–3 sentences, assess how the last interaction went and name the single most important next move. Use ONLY the facts given — if the call record is thin or has no notes, say the record is light rather than inventing what was discussed. Never fabricate topics, interest, or outcomes not in the facts.",
    user:
      `${prospectName}${company ? ` at ${company.name}` : ""}. ` +
      `Last ${call.type} on ${formatDate(call.timestamp)}: "${call.subject}". ` +
      (call.body.trim()
        ? `Call notes: ${call.body}. `
        : "No notes were recorded for this call — do not guess what was discussed. ") +
      (deal ? `Deal "${deal.property}" at ${DEAL_STAGE_LABELS[deal.stage]}. ` : "") +
      `What went well: ${wentWell.join("; ")}. To improve: ${toImprove.join("; ") || "nothing major"}.`,
    grounding: dossier,
  });

  const evidence: EvidenceRef[] = [
    { kind: "contact", id: contact.id, label: prospectName },
    { kind: "activity", id: call.id, label: `${call.type}: ${call.subject}` },
  ];

  return {
    agentId: "analyst",
    headline: `Post-call review for ${prospectName}`,
    data: {
      contactId, prospectName,
      company: company?.name ?? null,
      dealHeadline: deal?.property ?? null,
      stageLabel: deal ? DEAL_STAGE_LABELS[deal.stage] : null,
      callLabel: `${call.type} — ${call.subject}`,
      callWhen: formatDate(call.timestamp),
      noCall: false,
      narrative, wentWell, toImprove, nextStep,
    },
    evidence,
  };
}

/** Analyst's push status: how many of the rep's prospects have a call to review. */
export function analystStatus(repId: string): { reviewable: number } {
  const reviewable = listContactsForRep(repId).filter((c) => {
    const d = buildDossier(c.id);
    return d ? Boolean(lastCall(d.activities)) : false;
  }).length;
  return { reviewable };
}

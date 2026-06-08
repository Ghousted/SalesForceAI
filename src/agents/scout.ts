import {
  buildDossier,
  listContactsForRep,
  type ProspectDossier,
} from "@/lib/data/spine";
import { DEAL_STAGE_LABELS } from "@/lib/data/types";
import { getLLM } from "@/lib/llm/provider";
import { php, formatDate } from "@/lib/format";
import type { AgentRunResult, EvidenceRef } from "./types";

/**
 * Scout — "reads up on someone before you meet them."
 *
 * Produces a pre-call brief grounded entirely in the data spine. Every signal
 * and timeline entry cites the activity it came from (evidence). The narrative
 * paragraph is the one part routed through the LLM seam; the structure is
 * deterministic so the brief is trustworthy even on the stub provider.
 */

export interface TimelineEntry {
  when: string; // ISO
  type: string;
  text: string;
  evidenceId: string;
}

export interface Signal {
  text: string;
  evidenceId: string;
}

export interface ScoutBrief {
  contactId: string;
  prospectName: string;
  title: string;
  company: string;
  location: string;
  persona: string;
  dealHeadline: string | null;
  stageLabel: string | null;
  amountLabel: string | null;
  expectedClose: string | null;
  narrative: string;
  timeline: TimelineEntry[];
  signals: Signal[];
  talkingPoints: string[];
  openRisk: string | null;
}

/** Pick out things the rep should act on, each tied to a real activity. */
function extractSignals(dossier: ProspectDossier): Signal[] {
  const signals: Signal[] = [];
  for (const a of dossier.activities) {
    if (a.direction === "inbound") {
      signals.push({
        text: `${dossier.contact.firstName} reached out — "${a.subject}": ${a.body}`,
        evidenceId: a.id,
      });
    }
    if (a.type === "note" && /risk|cold|not yet|missed|overdue/i.test(a.body)) {
      signals.push({ text: a.body, evidenceId: a.id });
    }
    if (a.type === "viewing") {
      signals.push({
        text: `Upcoming viewing on ${formatDate(a.timestamp)} — ${a.body}`,
        evidenceId: a.id,
      });
    }
  }
  return signals;
}

function buildTalkingPoints(dossier: ProspectDossier, signals: Signal[]): string[] {
  const points: string[] = [];
  const { contact, deal } = dossier;

  // Persona-led opener.
  points.push(
    `Lead with what ${contact.firstName} values: ${contact.persona.split(".")[0]}.`,
  );

  // Address the most recent inbound question directly.
  const inbound = dossier.activities.filter((a) => a.direction === "inbound").at(-1);
  if (inbound) {
    points.push(`Have an answer ready for their last message: "${inbound.subject}".`);
  }

  // Stage-appropriate next step.
  if (deal) {
    switch (deal.stage) {
      case "proposal":
        points.push("They have the proposal — aim to resolve open concerns and set a decision date.");
        break;
      case "viewing-scheduled":
        points.push("Use the viewing to build trust; don't push for commitment on-site.");
        break;
      case "qualifying":
        points.push("Qualify on timeline and budget before investing in a full proposal.");
        break;
      default:
        points.push("Confirm the next concrete step before the call ends.");
    }
  }

  if (signals.length === 0) {
    points.push("No fresh signals — open by re-confirming their priorities.");
  }
  return points;
}

function findOpenRisk(dossier: ProspectDossier): string | null {
  const note = dossier.activities.find(
    (a) => a.type === "note" && /risk|cold|not yet|missed|overdue/i.test(a.body),
  );
  if (note) return note.body;

  // Unanswered inbound is a risk.
  const acts = dossier.activities;
  const lastInbound = acts.filter((a) => a.direction === "inbound").at(-1);
  const lastOutbound = acts.filter((a) => a.direction === "outbound").at(-1);
  if (
    lastInbound &&
    (!lastOutbound || lastInbound.timestamp > lastOutbound.timestamp)
  ) {
    return `${dossier.contact.firstName}'s last message is awaiting a reply.`;
  }
  return null;
}

/** Run Scout for one prospect. */
export async function runScout(contactId: string): Promise<AgentRunResult<ScoutBrief>> {
  const dossier = buildDossier(contactId);
  if (!dossier) {
    throw new Error(`Scout: no contact found for id ${contactId}`);
  }

  const { contact, company, deal, activities } = dossier;
  const fullName = `${contact.firstName} ${contact.lastName}`;

  const timeline: TimelineEntry[] = activities.map((a) => ({
    when: a.timestamp,
    type: a.type,
    text: `${a.subject} — ${a.body}`,
    evidenceId: a.id,
  }));

  const signals = extractSignals(dossier);
  const talkingPoints = buildTalkingPoints(dossier, signals);
  const openRisk = findOpenRisk(dossier);

  // Compose a grounded prompt for the LLM seam. The stub echoes the `user`
  // payload; a real model would generate from the same facts.
  const factSheet = [
    `${fullName}, ${contact.title} at ${company?.name ?? "—"} (${company?.location ?? "—"}).`,
    deal
      ? `Considering ${deal.property}, currently "${DEAL_STAGE_LABELS[deal.stage]}", worth ${php(deal.amount)}, target close ${formatDate(deal.expectedCloseDate)}.`
      : "No active deal on record.",
    `Persona: ${contact.persona}`,
    signals.length
      ? `Act on: ${signals.map((s) => s.text).join(" | ")}`
      : "No fresh signals.",
  ].join(" ");

  const llm = getLLM();
  const narrative = await llm.complete({
    system:
      "You are Scout, a pre-call briefer. In 2–3 sentences, tell the rep who this person is, where the deal stands, and the single most important thing to handle on the call. Use only the facts given.",
    user: factSheet,
    grounding: dossier,
  });

  const evidence: EvidenceRef[] = [
    { kind: "contact", id: contact.id, label: fullName },
    ...(deal ? [{ kind: "deal" as const, id: deal.id, label: deal.name }] : []),
    ...signals.map((s) => ({
      kind: "activity" as const,
      id: s.evidenceId,
      label: "signal",
    })),
  ];

  const brief: ScoutBrief = {
    contactId: contact.id,
    prospectName: fullName,
    title: contact.title,
    company: company?.name ?? "—",
    location: company?.location ?? "—",
    persona: contact.persona,
    dealHeadline: deal?.property ?? null,
    stageLabel: deal ? DEAL_STAGE_LABELS[deal.stage] : null,
    amountLabel: deal ? php(deal.amount) : null,
    expectedClose: deal ? formatDate(deal.expectedCloseDate) : null,
    narrative,
    timeline,
    signals,
    talkingPoints,
    openRisk,
  };

  return {
    agentId: "scout",
    headline: `Pre-call brief for ${fullName}`,
    data: brief,
    evidence,
    requiresApproval: undefined, // Scout only reads; nothing to approve.
  };
}

/** Scout's push status for the roster home (e.g. "3 briefs ready"). */
export function scoutStatus(repId: string): { count: number; needsAttention: number } {
  const contacts = listContactsForRep(repId);
  let needsAttention = 0;
  for (const c of contacts) {
    const d = buildDossier(c.id);
    if (d && findOpenRisk(d)) needsAttention++;
  }
  return { count: contacts.length, needsAttention };
}

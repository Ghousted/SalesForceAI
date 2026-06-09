import {
  buildDossier,
  listAllContacts,
  listContactsForRep,
  listReps,
  spineNow,
  type ProspectDossier,
} from "@/lib/data/spine";
import { daysBetween } from "@/lib/format";
import { getLLM } from "@/lib/llm/provider";
import { addAction, listActions } from "@/lib/actions/store";
import { autonomyFor } from "@/lib/actions/policy";
import { executeAction } from "@/lib/actions/executor";
import type { AgentAction } from "@/lib/actions/types";
import type { AgentRunResult } from "./types";

/**
 * Dispatcher — "hands each new enquiry to the right person." (Before, Ops.)
 *
 * The first *automated* agent: it finds new (unassigned) leads, scores them,
 * routes each to the least-loaded rep, and — through the action spine — either
 * assigns them automatically (AUTONOMY_DISPATCHER=auto) or queues a one-tap
 * approval. The write itself is internal and reversible, which is why this is
 * the safe first slice of the automation layer.
 */

const SENIOR_TITLE =
  /chief|ceo|founder|owner|president|vp|vice president|head of|director|partner|managing/i;

export type LeadTier = "hot" | "warm" | "cold";

export interface ScoredLead {
  contactId: string;
  name: string;
  title: string;
  company: string | null;
  score: number;
  tier: LeadTier;
  reasons: string[];
  routedToId: string;
  routedToName: string;
  rationale: string;
  actionId: string;
  actionStatus: AgentAction["status"];
}

export interface DispatchReport {
  newLeads: number;
  routed: ScoredLead[];
  autoExecuted: number;
  awaitingApproval: number;
  message: string;
}

/** Deterministic lead score from the dossier. */
function scoreLead(d: ProspectDossier): { score: number; tier: LeadTier; reasons: string[] } {
  const reasons: string[] = [];
  let score = 20;
  if (d.company) {
    score += 20;
    reasons.push(`Tied to a company (${d.company.name})`);
  }
  if (SENIOR_TITLE.test(d.contact.title)) {
    score += 25;
    reasons.push(`Senior title: ${d.contact.title}`);
  }
  if (d.contact.email) {
    score += 10;
    reasons.push("Has an email on file");
  }
  const now = spineNow();
  const recentInbound = d.activities.some(
    (a) => a.direction === "inbound" && daysBetween(a.timestamp, now) <= 30,
  );
  if (recentInbound) {
    score += 25;
    reasons.push("Engaged inbound in the last 30 days");
  }
  score = Math.min(100, score);
  const tier: LeadTier = score >= 70 ? "hot" : score >= 45 ? "warm" : "cold";
  return { score, tier, reasons };
}

/** Pick the rep with the fewest owned contacts (simple load balancing). */
function leastLoadedRep(): { id: string; name: string } | undefined {
  const reps = listReps();
  if (reps.length === 0) return undefined;
  let best = reps[0];
  let bestLoad = listContactsForRep(best.id).length;
  for (const r of reps.slice(1)) {
    const load = listContactsForRep(r.id).length;
    if (load < bestLoad) {
      best = r;
      bestLoad = load;
    }
  }
  return { id: best.id, name: best.name };
}

export async function runDispatcher(): Promise<AgentRunResult<DispatchReport>> {
  // "New" leads = contacts with no owner yet.
  const newLeads = listAllContacts().filter((c) => !c.ownerRepId);
  const owner = leastLoadedRep();

  if (newLeads.length === 0 || !owner) {
    const message = !owner
      ? "No reps available to route to."
      : "No new leads to route — every contact already has an owner.";
    return {
      agentId: "dispatcher",
      headline: message,
      data: { newLeads: 0, routed: [], autoExecuted: 0, awaitingApproval: 0, message },
      evidence: [],
    };
  }

  const llm = getLLM();
  const routed: ScoredLead[] = [];
  let autoExecuted = 0;
  let awaitingApproval = 0;

  // Skip leads that already have a routing waiting in the queue — re-running
  // the Dispatcher shouldn't pile up duplicate proposals for the same person.
  const alreadyQueued = new Set(
    listActions({ pending: true, agentId: "dispatcher" }).map((a) => a.target.id),
  );

  for (const contact of newLeads) {
    if (alreadyQueued.has(contact.id)) continue;
    const dossier = buildDossier(contact.id);
    if (!dossier) continue;
    const name = `${contact.firstName} ${contact.lastName}`.trim();
    const { score, tier, reasons } = scoreLead(dossier);

    const rationale = await llm.complete({
      agent: "dispatcher",
      system:
        "You are the Dispatcher routing a new sales lead. In one sentence, say how warm this lead is and how the rep should prioritize it. Use only the facts given.",
      user: `Lead: ${name}${contact.title ? `, ${contact.title}` : ""}${dossier.company ? ` at ${dossier.company.name}` : ""}. Score ${score}/100 (${tier}). Signals: ${reasons.join("; ") || "none"}.`,
      grounding: { score, tier, reasons },
    });

    const autonomy = autonomyFor("dispatcher", "assign-owner");
    let action = addAction({
      agentId: "dispatcher",
      kind: "assign-owner",
      title: `Route ${name} → ${owner.name}`,
      detail: `${tier.toUpperCase()} lead (${score}/100). ${rationale}`,
      target: { kind: "contact", id: contact.id, label: name },
      payload: { ownerId: owner.id, ownerName: owner.name, score, tier },
      autonomy,
      status: autonomy === "auto" ? "executed" : "proposed",
    });

    if (autonomy === "auto") {
      action = await executeAction({ ...action, status: "proposed" }); // run the write
      if (action.status === "executed") autoExecuted++;
    } else {
      awaitingApproval++;
    }

    routed.push({
      contactId: contact.id,
      name,
      title: contact.title,
      company: dossier.company?.name ?? null,
      score,
      tier,
      reasons,
      routedToId: owner.id,
      routedToName: owner.name,
      rationale,
      actionId: action.id,
      actionStatus: action.status,
    });
  }

  routed.sort((a, b) => b.score - a.score);
  const message =
    routed.length === 0
      ? "New leads are already in your inbox awaiting approval."
      : autoExecuted > 0
        ? `${routed.length} lead${routed.length === 1 ? "" : "s"} routed automatically.`
        : `${routed.length} lead${routed.length === 1 ? "" : "s"} scored — awaiting your approval.`;

  return {
    agentId: "dispatcher",
    headline: `${routed.length} new lead${routed.length === 1 ? "" : "s"} routed to ${owner.name}`,
    data: { newLeads: newLeads.length, routed, autoExecuted, awaitingApproval, message },
    evidence: routed.map((l) => ({ kind: "contact" as const, id: l.contactId, label: l.name })),
  };
}

/** Dispatcher's push status for the roster home. */
export function dispatcherStatus(): { newLeads: number } {
  return { newLeads: listAllContacts().filter((c) => !c.ownerRepId).length };
}

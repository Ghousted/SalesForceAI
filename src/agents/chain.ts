import { runScribe } from "./scribe";
import { runScout } from "./scout";
import type { DealAudit } from "./auditor";
import { addAction, listActions } from "@/lib/actions/store";
import { autonomyFor } from "@/lib/actions/policy";
import { executeAction } from "@/lib/actions/executor";
import { logActivity } from "@/lib/data/writes";
import {
  ensureSnapshot,
  getDealForContact,
  listActivitiesForContact,
} from "@/lib/data/spine";
import { DEAL_STAGE_LABELS, type DealStage } from "@/lib/data/types";

/**
 * Agent chaining — how the team works each other's findings.
 *
 * One agent *finds* (or finishes) something; this module routes the follow-on
 * work to the agent that handles it, the way a sales manager hands work to the
 * floor:
 *
 *  - Auditor: unanswered-inbound / going-quiet → Scribe drafts the reply or
 *    re-engagement email (send-email is always gated → approval inbox).
 *  - Auditor: stage-evidence-mismatch → an `update-stage` proposal to walk the
 *    deal back to the stage the evidence supports.
 *  - Dispatcher: lead routed → Scout preps the pre-call brief and pins it to
 *    the contact's timeline, so the new owner opens the record already briefed.
 *
 * Everything is deduped (pending queue / recent timeline) so re-runs never spam
 * the inbox or the record.
 */

/** Flags Scribe can act on by writing to the prospect. */
const FOLLOW_UP_RULES = new Set(["unanswered-inbound", "going-quiet"]);

/** Don't queue more than a handful of drafts per audit pass. */
const MAX_DRAFTS_PER_RUN = 3;

export interface ChainOutcome {
  drafts: number;
  stageFixes: number;
}

/** The stage the evidence actually supports, per mismatch flag. */
function evidencedStage(flagId: string): DealStage {
  // ":R2v" = viewing claimed but none logged → back to qualifying;
  // ":R2"  = proposal claimed but none sent  → back to viewing-scheduled.
  return flagId.endsWith(":R2v") ? "qualifying" : "viewing-scheduled";
}

/** A brief stays fresh this long before Scout writes a new one. */
const BRIEF_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const BRIEF_SUBJECT = "Pre-call brief";

/**
 * Dispatcher → Scout handoff: once a lead is routed (auto or approved), Scout
 * reads up on them and leaves the brief on the timeline, attributed. Returns
 * whether a brief was written (false = fresh one already there, or no dossier).
 */
export async function chainFromRouting(contactId: string): Promise<boolean> {
  // The routing write just invalidated the snapshot — rehydrate before reading.
  await ensureSnapshot();

  const fresh = listActivitiesForContact(contactId).some(
    (a) =>
      a.actorId === "scout" &&
      a.subject.startsWith(BRIEF_SUBJECT) &&
      Date.now() - Date.parse(a.timestamp) < BRIEF_TTL_MS,
  );
  if (fresh) return false;

  try {
    const { data: brief } = await runScout(contactId);
    const body = [
      brief.narrative,
      brief.openRisk ? `Open risk: ${brief.openRisk}` : "",
      brief.talkingPoints.length
        ? `Talking points:\n${brief.talkingPoints.map((p) => `• ${p}`).join("\n")}`
        : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    await logActivity({
      contactId,
      dealId: getDealForContact(contactId)?.id,
      type: "note",
      subject: `${BRIEF_SUBJECT} — ${brief.prospectName}`,
      body,
      actorId: "scout",
    });
    return true;
  } catch {
    // No dossier (deleted contact) or LLM hiccup — the routing still stands.
    return false;
  }
}

export async function chainFromAudit(audits: DealAudit[]): Promise<ChainOutcome> {
  const pending = await listActions({ pending: true });
  const emailQueued = new Set(
    pending
      .filter((a) => a.kind === "send-email")
      .map((a) => String(a.payload.contactId ?? a.target.id)),
  );
  const stageQueued = new Set(
    pending.filter((a) => a.kind === "update-stage").map((a) => a.target.id),
  );

  const outcome: ChainOutcome = { drafts: 0, stageFixes: 0 };

  // Work the riskiest deals first — same order a manager would.
  const ordered = [...audits].sort(
    (a, b) => a.auditorConfidence - b.auditorConfidence,
  );

  for (const audit of ordered) {
    const followUp = audit.flags.find((f) => FOLLOW_UP_RULES.has(f.ruleId));
    if (
      followUp &&
      audit.contactId &&
      !emailQueued.has(audit.contactId) &&
      outcome.drafts < MAX_DRAFTS_PER_RUN
    ) {
      try {
        await runScribe(audit.contactId, {
          reason: `${followUp.title} — ${followUp.suggestedAction}`,
          proposedBy: "Auditor",
        });
        emailQueued.add(audit.contactId);
        outcome.drafts++;
      } catch {
        // Contact without a dossier (e.g. deleted) — skip, don't fail the run.
      }
    }

    const mismatch = audit.flags.find((f) => f.ruleId === "stage-evidence-mismatch");
    if (mismatch && !stageQueued.has(audit.dealId)) {
      const stage = evidencedStage(mismatch.id);
      const autonomy = autonomyFor("auditor", "update-stage");
      let action = await addAction({
        agentId: "auditor",
        kind: "update-stage",
        title: `Walk ${audit.dealName} back to "${DEAL_STAGE_LABELS[stage]}"`,
        detail:
          `${mismatch.detail} ` +
          `The Auditor proposes correcting the stage to "${DEAL_STAGE_LABELS[stage]}" until the record supports the claim.`,
        target: { kind: "deal", id: audit.dealId, label: audit.dealName },
        payload: { stage, contactId: audit.contactId, ruleId: mismatch.ruleId },
        autonomy,
        status: "proposed",
      });
      if (autonomy === "auto") {
        action = await executeAction({ ...action, status: "proposed" });
      }
      stageQueued.add(audit.dealId);
      outcome.stageFixes++;
    }
  }

  return outcome;
}

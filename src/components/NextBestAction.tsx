"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { AuditFlag } from "@/agents/auditor";
import type { AgentAction } from "@/lib/actions/types";
import { DEAL_STAGE_LABELS, type DealStage } from "@/lib/data/types";
import { ActionList } from "./ActionList";

/**
 * "Next best action" — the agent team's one recommendation for this record,
 * plus any of their proposals waiting on the human, approvable in place.
 *
 * HubSpot shows you the record; an agent-native CRM tells you what to do with
 * it. The recommendation is the top Auditor flag (already severity-sorted);
 * the buttons delegate the fix to the right agent in one tap.
 */

const FOLLOW_UP_RULES = new Set(["unanswered-inbound", "going-quiet"]);

/** Mirror of the Auditor's chain rule: the stage the evidence supports. */
function evidencedStage(flagId: string): DealStage {
  return flagId.endsWith(":R2v") ? "qualifying" : "viewing-scheduled";
}

export function NextBestAction({
  contactId,
  dealId,
  flag,
  prospectName,
}: {
  contactId: string | null;
  dealId?: string;
  /** Top audit flag for this record (severity-sorted upstream), if any. */
  flag: AuditFlag | null;
  prospectName?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [proposals, setProposals] = useState<AgentAction[]>([]);

  const refreshProposals = useCallback(async () => {
    try {
      const res = await fetch("/api/actions?status=pending");
      const data = await res.json();
      const all = (data.actions ?? []) as AgentAction[];
      setProposals(
        all.filter(
          (a) =>
            a.target.id === contactId ||
            (dealId && a.target.id === dealId) ||
            (contactId && String(a.payload?.contactId ?? "") === contactId),
        ),
      );
    } catch {
      /* keep whatever we have */
    }
  }, [contactId, dealId]);

  useEffect(() => {
    void refreshProposals();
  }, [refreshProposals]);

  async function delegateToScribe() {
    if (!contactId) return;
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch("/api/scribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId,
          reason: flag ? `${flag.title} — ${flag.suggestedAction}` : undefined,
        }),
      });
      const data = await res.json();
      if (data.error) setNote(data.error);
      else {
        setNote("Scribe drafted it — review below.");
        await refreshProposals();
      }
    } catch {
      setNote("Couldn't reach Scribe.");
    } finally {
      setBusy(false);
    }
  }

  async function fixStage(stage: DealStage) {
    if (!dealId) return;
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch("/api/crm/deals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: dealId, stage }),
      });
      if (!res.ok) setNote("Couldn't update the stage.");
      else router.refresh();
    } catch {
      setNote("Couldn't update the stage.");
    } finally {
      setBusy(false);
    }
  }

  function onProposalResolved(updated: AgentAction) {
    setProposals((prev) => prev.filter((a) => a.id !== updated.id));
    router.refresh(); // timeline/stage may have changed
  }

  const isFollowUp = flag ? FOLLOW_UP_RULES.has(flag.ruleId) : false;
  const isMismatch = flag?.ruleId === "stage-evidence-mismatch";

  return (
    <section className="mb-8">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ash/70">
        Next best action
      </h2>
      <div className="rounded-xl border border-ember/30 bg-ember/[0.06] p-4">
        {flag ? (
          <>
            <div className="text-sm font-semibold text-bone">{flag.title}</div>
            <p className="mt-1 text-[13px] leading-[1.5] text-ash">{flag.suggestedAction}</p>
          </>
        ) : (
          <>
            <div className="text-sm font-semibold text-bone">Keep the thread warm</div>
            <p className="mt-1 text-[13px] leading-[1.5] text-ash">
              No flags on this record. A short check-in keeps
              {prospectName ? ` ${prospectName}` : " the prospect"} engaged.
            </p>
          </>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          {contactId && (isFollowUp || !flag) && (
            <button
              onClick={delegateToScribe}
              disabled={busy}
              className="rounded-[4px] bg-ember px-3.5 py-1.5 text-[13px] font-medium text-bone ember-glow transition-transform hover:scale-[1.02] disabled:opacity-50"
            >
              {busy ? "Scribe is writing…" : "Have Scribe draft it"}
            </button>
          )}
          {isMismatch && dealId && flag && (
            <button
              onClick={() => fixStage(evidencedStage(flag.id))}
              disabled={busy}
              className="rounded-[4px] border border-ash/20 px-3.5 py-1.5 text-[13px] font-medium text-ash transition-colors hover:border-ember hover:text-bone disabled:opacity-50"
            >
              Fix stage → {DEAL_STAGE_LABELS[evidencedStage(flag.id)]}
            </button>
          )}
        </div>
        {note && <p className="mt-2 text-[12px] text-ember">{note}</p>}
      </div>

      {proposals.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ash/60">
            Waiting on you · {proposals.length}
          </h3>
          <ActionList actions={proposals} onResolved={onProposalResolved} />
        </div>
      )}
    </section>
  );
}

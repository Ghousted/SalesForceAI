import { ROSTER } from "@/agents/registry";
import { scoutStatus } from "@/agents/scout";
import { auditorStatus } from "@/agents/auditor";
import { forecasterStatus } from "@/agents/forecaster";
import { sparringStatus } from "@/agents/sparring";
import { dispatcherStatus } from "@/agents/dispatcher";
import { pendingCount } from "@/lib/actions/store";
import { php } from "@/lib/format";
import type { AgentMeta, AgentStatus, AgentWhen } from "@/agents/types";
import { listContactsForRep, getRep } from "@/lib/data/spine";

/**
 * Builds the roster home view-model (PRD §7): each agent with a push status —
 * mostly "done" lines, a few "needs you" nudges.
 *
 * Scout's status is computed for real from the spine. The other agents are not
 * yet runnable in this build, so they carry representative statuses that convey
 * the push model; they are tagged `implemented: false` so the UI can label them
 * honestly as upcoming.
 */

export interface AgentCardVM {
  meta: AgentMeta;
  status: AgentStatus;
}

export interface HomeVM {
  repId: string;
  repName: string;
  role: "rep" | "manager";
  groups: { when: AgentWhen; agents: AgentCardVM[] }[];
}

// Representative push statuses for not-yet-runnable agents, so the team reads
// as alive. Clearly placeholders — paired with the "upcoming" tag in the UI.
const PLACEHOLDER_STATUS: Record<string, AgentStatus> = {
  human: { kind: "idle", message: "Your move — the close stays yours" },
  analyst: { kind: "idle", message: "Activates after your next call (Phase 2)" },
  coach: { kind: "idle", message: "Watching for coaching moments (Phase 2)" },
};

function statusForAgent(id: string, repId: string): AgentStatus {
  if (id === "dispatcher") {
    const { newLeads } = dispatcherStatus();
    const pending = pendingCount("dispatcher");
    if (pending > 0) {
      return { kind: "needs", message: `${pending} routing${pending === 1 ? "" : "s"} to approve` };
    }
    if (newLeads > 0) {
      return { kind: "needs", message: `${newLeads} new lead${newLeads === 1 ? "" : "s"} to route` };
    }
    return { kind: "done", message: "All leads routed" };
  }
  if (id === "scout") {
    const { count, needsAttention } = scoutStatus(repId);
    if (needsAttention > 0) {
      return {
        kind: "needs",
        message: `${count} briefs ready · ${needsAttention} need a look`,
      };
    }
    return { kind: "done", message: `${count} briefs ready` };
  }
  if (id === "auditor") {
    const { totalFlags, highSeverity } = auditorStatus(repId);
    if (totalFlags === 0) {
      return { kind: "done", message: "Pipeline reconciled · no flags" };
    }
    return {
      kind: highSeverity > 0 ? "needs" : "done",
      message: `${totalFlags} flag${totalFlags === 1 ? "" : "s"}${highSeverity > 0 ? ` · ${highSeverity} high` : ""}`,
    };
  }
  if (id === "forecaster") {
    const { monthLabel, evidenceWeighted } = forecasterStatus(repId);
    return {
      kind: "done",
      message: `${monthLabel}: ${php(evidenceWeighted)} (evidence-based)`,
    };
  }
  if (id === "sparring-partner") {
    const { scenarios } = sparringStatus(repId);
    return {
      kind: "idle",
      message: `Ready to rehearse · ${scenarios} scenario${scenarios === 1 ? "" : "s"}`,
    };
  }
  if (id === "scribe") {
    const drafts = pendingCount("scribe");
    if (drafts > 0) {
      return { kind: "needs", message: `${drafts} follow-up${drafts === 1 ? "" : "s"} to approve` };
    }
    return { kind: "idle", message: "Ready to draft follow-ups" };
  }
  return PLACEHOLDER_STATUS[id] ?? { kind: "idle", message: "Ready" };
}

const WHEN_ORDER: AgentWhen[] = ["before", "call", "after", "behind"];

export function buildHomeVM(repId: string, role: "rep" | "manager"): HomeVM {
  const rep = getRep(repId);

  const groups = WHEN_ORDER.map((when) => ({
    when,
    agents: ROSTER.filter((a) => a.when === when).map((meta) => ({
      meta,
      status: statusForAgent(meta.id, repId),
    })),
  })).filter((g) => g.agents.length > 0);

  return {
    repId,
    repName: rep?.name ?? "Rep",
    role,
    groups,
  };
}

export function repContactCount(repId: string): number {
  return listContactsForRep(repId).length;
}

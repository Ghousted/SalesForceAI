import { ROSTER } from "@/agents/registry";
import { scoutStatus } from "@/agents/scout";
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
  dispatcher: { kind: "done", message: "Routing rules ready (Phase 2)" },
  "sparring-partner": { kind: "idle", message: "Ready to rehearse" },
  human: { kind: "idle", message: "Your move — the close stays yours" },
  analyst: { kind: "idle", message: "Activates after your next call (Phase 2)" },
  scribe: { kind: "idle", message: "Drafts follow-ups on request (Phase 2)" },
  auditor: { kind: "needs", message: "1 deal note looks optimistic" },
  forecaster: { kind: "done", message: "Forecast refreshes each morning" },
  coach: { kind: "idle", message: "Watching for coaching moments (Phase 2)" },
};

function statusForAgent(id: string, repId: string): AgentStatus {
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

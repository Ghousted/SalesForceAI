import { ROSTER } from "@/agents/registry";
import { scoutStatus } from "@/agents/scout";
import { auditorStatus } from "@/agents/auditor";
import { forecasterStatus } from "@/agents/forecaster";
import { sparringStatus } from "@/agents/sparring";
import { dispatcherStatus } from "@/agents/dispatcher";
import { analystStatus } from "@/agents/analyst";
import { coachStatus } from "@/agents/coach";
import { pendingCountsByAgent, listActions } from "@/lib/actions/store";
import { recentRuns } from "@/lib/triggers/runner";
import { getSetupStatus } from "@/lib/onboarding/setup";
import { ensureAgentConfig, agentDisplayName, agentEnabled } from "@/lib/agents/config";
import { php } from "@/lib/format";
import type { AgentMeta, AgentStatus, AgentWhen } from "@/agents/types";
import { listContactsForRep, getRep, listAllContacts, listAllDeals } from "@/lib/data/spine";

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
  displayName: string;
  enabled: boolean;
}

export interface DigestItem {
  agentId: string;
  agentName: string;
  summary: string;
  at: string; // ISO
}

/** "While you were away" — what the team did unprompted in the last 24h. */
export interface HomeDigest {
  items: DigestItem[];
  pendingCount: number;
  executedToday: number;
}

export interface HomeVM {
  repId: string;
  repName: string;
  role: "rep" | "manager";
  groups: { when: AgentWhen; agents: AgentCardVM[] }[];
  digest: HomeDigest;
  /** No contacts and no deals in the whole workspace — show first-run onboarding. */
  workspaceEmpty: boolean;
  /** The workspace is currently populated with the demo sample pack. */
  sampleDataLoaded: boolean;
  /** Getting-started guide progress for the dashboard chip. */
  setup: { completed: number; total: number; percent: number; show: boolean };
}

// Representative push statuses for not-yet-runnable agents, so the team reads
// as alive. Clearly placeholders — paired with the "upcoming" tag in the UI.
const PLACEHOLDER_STATUS: Record<string, AgentStatus> = {
  human: { kind: "idle", message: "Your move — the close stays yours" },
};

function statusForAgent(
  id: string,
  repId: string,
  pendingByAgent: Record<string, number>,
): AgentStatus {
  if (id === "dispatcher") {
    const { newLeads } = dispatcherStatus();
    const pending = pendingByAgent["dispatcher"] ?? 0;
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
    const drafts = pendingByAgent["scribe"] ?? 0;
    if (drafts > 0) {
      return { kind: "needs", message: `${drafts} follow-up${drafts === 1 ? "" : "s"} to approve` };
    }
    return { kind: "idle", message: "Ready to draft follow-ups" };
  }
  if (id === "analyst") {
    const { reviewable } = analystStatus(repId);
    return reviewable > 0
      ? { kind: "idle", message: `${reviewable} call${reviewable === 1 ? "" : "s"} to review` }
      : { kind: "idle", message: "Reviews your calls after they happen" };
  }
  if (id === "coach") {
    const { repsToCoach } = coachStatus();
    return repsToCoach > 0
      ? { kind: "needs", message: `${repsToCoach} rep${repsToCoach === 1 ? "" : "s"} need a hand` }
      : { kind: "done", message: "Floor looks healthy" };
  }
  return PLACEHOLDER_STATUS[id] ?? { kind: "idle", message: "Ready" };
}

const WHEN_ORDER: AgentWhen[] = ["before", "call", "after", "behind"];

/** Last-24h agent activity, condensed for the strip under the hero. */
async function buildDigest(pendingByAgent: Record<string, number>): Promise<HomeDigest> {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;

  // One line per trigger (newest run wins) so a chatty agent doesn't flood it.
  const seen = new Set<string>();
  const items: DigestItem[] = [];
  for (const run of await recentRuns(30)) {
    if (Date.parse(run.at) < cutoff || run.status !== "ok") continue;
    if (seen.has(run.triggerId)) continue;
    seen.add(run.triggerId);
    items.push({
      agentId: run.agentId,
      agentName: agentDisplayName(run.agentId),
      summary: run.summary,
      at: run.at,
    });
    if (items.length >= 4) break;
  }

  const all = await listActions();
  const executedToday = all.filter(
    (a) => a.status === "executed" && a.resolvedAt && Date.parse(a.resolvedAt) >= cutoff,
  ).length;
  const pendingCount = Object.values(pendingByAgent).reduce((s, n) => s + n, 0);

  return { items, pendingCount, executedToday };
}

export async function buildHomeVM(
  repId: string,
  role: "rep" | "manager",
): Promise<HomeVM> {
  const rep = getRep(repId);
  const pendingByAgent = await pendingCountsByAgent();
  await ensureAgentConfig();
  const digest = await buildDigest(pendingByAgent);

  // First-run / sample-data signals (computed from the already-loaded snapshot).
  const allContacts = listAllContacts();
  const workspaceEmpty = allContacts.length === 0 && listAllDeals().length === 0;
  const sampleDataLoaded = allContacts.some((c) => c.id.startsWith("smpl_"));
  const setupStatus = await getSetupStatus();

  const groups = WHEN_ORDER.map((when) => ({
    when,
    agents: ROSTER.filter((a) => a.when === when).map((meta) => ({
      meta,
      status:
        meta.id !== "human" && !agentEnabled(meta.id)
          ? { kind: "idle" as const, message: "Paused" }
          : statusForAgent(meta.id, repId, pendingByAgent),
      displayName: meta.id === "human" ? meta.name : agentDisplayName(meta.id),
      enabled: meta.id === "human" ? true : agentEnabled(meta.id),
    })),
  })).filter((g) => g.agents.length > 0);

  return {
    repId,
    repName: rep?.name ?? "Rep",
    role,
    groups,
    digest,
    workspaceEmpty,
    sampleDataLoaded,
    setup: {
      completed: setupStatus.completed,
      total: setupStatus.total,
      percent: setupStatus.percent,
      show: setupStatus.show,
    },
  };
}

export function repContactCount(repId: string): number {
  return listContactsForRep(repId).length;
}

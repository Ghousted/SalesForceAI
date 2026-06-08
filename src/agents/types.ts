/**
 * Agent roster types.
 *
 * The roster is the product surface (PRD §6/§7): the user sees teammates, not
 * menus. These types carry both the *presentational* metadata for the roster
 * home screen and the *orchestration* metadata (when in the lifecycle the agent
 * helps, which side it serves, and whether a human approves its output).
 */

/** Where in the deal lifecycle the agent helps. Drives roster grouping. */
export type AgentWhen = "before" | "call" | "after" | "behind";

export const WHEN_LABELS: Record<AgentWhen, string> = {
  before: "Before the call",
  call: "The call",
  after: "After the call",
  behind: "Behind the scenes",
};

/** Which workspace the agent primarily serves. */
export type AgentSide = "rep" | "ops" | "human";

export type AgentPhase = 1 | 2;

/** A push status the agent surfaces on the home screen. */
export interface AgentStatus {
  /** "done" = quiet work completed; "needs" = a human decision is waiting. */
  kind: "done" | "needs" | "idle";
  /** Short line shown on the agent's card, e.g. "3 briefs ready". */
  message: string;
}

export interface AgentMeta {
  id: string;
  name: string;
  when: AgentWhen;
  side: AgentSide;
  /** Everyday-analogy description (PRD: friendly by default). */
  plainDescription: string;
  /** The CRM capability this agent wraps. */
  wraps: string;
  humanInLoop: string;
  mustHave: boolean;
  phase: AgentPhase;
  /** Whether the agent is runnable in this build (tracer bullet: only Scout). */
  implemented: boolean;
}

/** Result returned by a runnable agent. */
export interface AgentRunResult<T = unknown> {
  agentId: string;
  /** Human-readable headline for the run. */
  headline: string;
  /** Structured output specific to the agent. */
  data: T;
  /** Provenance: which spine records this run was grounded in. */
  evidence: EvidenceRef[];
  /** Anything requiring human approval before it leaves the building. */
  requiresApproval?: string;
}

/**
 * Every claim an agent makes must cite its source (PRD §10: "trustable flags").
 */
export interface EvidenceRef {
  kind: "activity" | "deal" | "contact" | "company";
  id: string;
  label: string;
}

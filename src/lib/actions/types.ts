/**
 * Agent actions — the spine of automation.
 *
 * When an agent wants to *do* something (not just report), it proposes an
 * `AgentAction`. Depending on the autonomy policy, the action either executes
 * immediately (auto) or waits in the queue for a one-tap human approval (ask).
 * This is how "AI owns the system, the human owns the close" is enforced at the
 * action layer: anything that leaves the building can be gated.
 *
 * Generic and agent-agnostic — Dispatcher is the first user, the rest slot in.
 */

export type ActionKind =
  | "assign-owner" // route a lead to a rep (internal, reversible)
  | "update-stage" // move a deal's pipeline stage
  | "log-activity" // write a note/activity
  | "send-email"; // outbound to a prospect (external — the gated one)

export type ActionStatus =
  | "proposed" // waiting for human approval
  | "executed" // done (auto, or approved then run)
  | "rejected" // human declined
  | "failed"; // tried to execute, errored

export type Autonomy = "auto" | "ask";

export interface ActionTarget {
  kind: "contact" | "deal" | "company";
  id: string;
  label: string;
}

export interface AgentAction {
  id: string;
  agentId: string;
  kind: ActionKind;
  /** One-line human summary, e.g. "Route Maria Johnson → Clyde Padua". */
  title: string;
  /** Why / what — the agent's reasoning, shown in the inbox. */
  detail: string;
  target: ActionTarget;
  /** Action-specific data the executor needs (e.g. { ownerId }). */
  payload: Record<string, unknown>;
  status: ActionStatus;
  autonomy: Autonomy;
  createdAt: string; // ISO
  resolvedAt?: string; // ISO
  /** Populated when status is "failed". */
  error?: string;
}

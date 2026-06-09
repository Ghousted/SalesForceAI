import type { ActionKind, Autonomy } from "./types";

/**
 * Autonomy policy — how much an agent may do without asking.
 *
 * Default is **ask** (propose → one-tap approve), the safe, PRD-aligned setting.
 * Flip an agent to fully autonomous with an env var, e.g. `AUTONOMY_DISPATCHER=auto`.
 *
 * External, customer-facing actions (`send-email`) are always forced to `ask`
 * regardless of the agent's setting — "the human owns the close": nothing
 * reaches a prospect without a human tap. (Relax this later only deliberately.)
 */

const ALWAYS_ASK: ActionKind[] = ["send-email"];

export function autonomyFor(agentId: string, kind: ActionKind): Autonomy {
  if (ALWAYS_ASK.includes(kind)) return "ask";
  const env = process.env[`AUTONOMY_${agentId.toUpperCase().replace(/-/g, "_")}`];
  return env?.toLowerCase() === "auto" ? "auto" : "ask";
}

import { runScout } from "@/agents/scout";
import { listContactsForRep } from "@/lib/data/spine";
import type { AgentRunResult } from "@/agents/types";

/**
 * The command bar (PRD §7: pull). Plain-language input is matched to an agent
 * and a target, then the agent runs. This is a deliberately small intent
 * matcher — the seam where natural-language routing (and the LLM) plugs in
 * later. Today it covers the implemented surface: Scout briefs by name.
 */

export interface CommandOutcome {
  ok: boolean;
  /** Which agent handled it, if any. */
  agentId?: string;
  message: string;
  result?: AgentRunResult;
  /** Suggestions when we couldn't route. */
  suggestions?: string[];
}

const SCOUT_TRIGGERS = /\b(brief|prep|prepare|scout|read up|background|who is)\b/i;

export async function runCommand(
  text: string,
  repId: string,
): Promise<CommandOutcome> {
  const input = text.trim();
  if (!input) {
    return { ok: false, message: "Type a command, e.g. \"brief me on Elena\"." };
  }

  const contacts = listContactsForRep(repId);

  // Match a prospect by first or last name mentioned in the text.
  const matched = contacts.find((c) => {
    const hay = input.toLowerCase();
    return (
      hay.includes(c.firstName.toLowerCase()) ||
      hay.includes(c.lastName.toLowerCase())
    );
  });

  const wantsScout = SCOUT_TRIGGERS.test(input) || matched != null;

  if (wantsScout) {
    if (!matched) {
      return {
        ok: false,
        agentId: "scout",
        message: "Scout: which prospect? I couldn't find that name.",
        suggestions: contacts.map((c) => `Brief me on ${c.firstName}`),
      };
    }
    const result = await runScout(matched.id);
    return {
      ok: true,
      agentId: "scout",
      message: result.headline,
      result,
    };
  }

  return {
    ok: false,
    message:
      "Only Scout is wired up in this build. Try asking for a pre-call brief.",
    suggestions: contacts.map((c) => `Brief me on ${c.firstName}`),
  };
}

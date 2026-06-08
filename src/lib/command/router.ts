import { runScout } from "@/agents/scout";
import { runAuditor } from "@/agents/auditor";
import { runForecaster } from "@/agents/forecaster";
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
  /** Directive to the client to open an interactive practice session. */
  openSpar?: { contactId: string; prospectName: string };
}

const SCOUT_TRIGGERS = /\b(brief|prep|prepare|scout|read up|background|who is)\b/i;
const AUDITOR_TRIGGERS =
  /\b(audit|reconcile|flags?|check (?:my |the )?(?:deals|pipeline|notes)|pipeline truth|what'?s slipping|risk)\b/i;
const FORECASTER_TRIGGERS =
  /\b(forecast|predict|projection|the (?:month|number)|how much.*(?:close|month)|what will we close|quota|commit)\b/i;
const SPARRING_TRIGGERS =
  /\b(practi[sc]e|rehearse|spar|role.?play|drill|objection|prep me|warm.?up)\b/i;

export async function runCommand(
  text: string,
  repId: string,
): Promise<CommandOutcome> {
  const input = text.trim();
  if (!input) {
    return { ok: false, message: "Type a command, e.g. \"brief me on Elena\"." };
  }

  const contacts = listContactsForRep(repId);

  // Auditor: a book-wide reconciliation, not tied to one prospect. Checked
  // before Scout so "check my pipeline" doesn't get read as a name lookup.
  if (AUDITOR_TRIGGERS.test(input)) {
    const result = await runAuditor(repId);
    return {
      ok: true,
      agentId: "auditor",
      message: result.headline,
      result,
    };
  }

  // Forecaster: rolls the book up into the month's number.
  if (FORECASTER_TRIGGERS.test(input)) {
    const result = await runForecaster(repId);
    return {
      ok: true,
      agentId: "forecaster",
      message: result.headline,
      result,
    };
  }

  // Match a prospect by first or last name mentioned in the text.
  const matched = contacts.find((c) => {
    const hay = input.toLowerCase();
    return (
      hay.includes(c.firstName.toLowerCase()) ||
      hay.includes(c.lastName.toLowerCase())
    );
  });

  // Sparring Partner: an interactive session — checked before Scout so
  // "practice with Elena" opens a rehearsal rather than a brief.
  if (SPARRING_TRIGGERS.test(input)) {
    if (!matched) {
      return {
        ok: false,
        agentId: "sparring-partner",
        message: "Sparring Partner: who do you want to rehearse against?",
        suggestions: contacts.map((c) => `Practice with ${c.firstName}`),
      };
    }
    return {
      ok: true,
      agentId: "sparring-partner",
      message: `Starting practice with ${matched.firstName}…`,
      openSpar: {
        contactId: matched.id,
        prospectName: `${matched.firstName} ${matched.lastName}`,
      },
    };
  }

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
      'Try "brief me on Elena" (Scout), "check my pipeline" (Auditor), "forecast the month" (Forecaster), or "practice with Elena" (Sparring Partner).',
    suggestions: contacts.map((c) => `Brief me on ${c.firstName}`),
  };
}

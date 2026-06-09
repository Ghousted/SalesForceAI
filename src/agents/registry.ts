import type { AgentMeta } from "./types";

/**
 * The roster (PRD §6). Order = the deal lifecycle, so the home screen reads as
 * a sequence: Dispatcher → Scout → Sparring Partner → [the human] →
 * Analyst → Scribe → Auditor → Forecaster → Coach.
 *
 * `implemented` marks what is runnable in this tracer-bullet build. Only Scout
 * is wired end-to-end; the rest render on the roster with their push status so
 * the full team is legible from day one.
 */
export const ROSTER: AgentMeta[] = [
  {
    id: "dispatcher",
    name: "Dispatcher",
    when: "before",
    side: "ops",
    plainDescription: "Hands each new enquiry to the right person.",
    wraps: "Lead scoring, lead rotation / auto-assignment, workflows",
    humanInLoop: "Manager can override",
    mustHave: false,
    phase: 2,
    implemented: true,
  },
  {
    id: "scout",
    name: "Scout",
    when: "before",
    side: "rep",
    plainDescription: "Reads up on someone before you meet them.",
    wraps: "Contact/company records, activity timeline, playbooks",
    humanInLoop: "Rep reviews brief",
    mustHave: false,
    phase: 1,
    implemented: true,
  },
  {
    id: "sparring-partner",
    name: "Sparring Partner",
    when: "before",
    side: "rep",
    plainDescription: "A practice partner to rehearse with.",
    wraps: "Playbooks + practice mode (extends beyond the CRM)",
    humanInLoop: "Rep-driven",
    mustHave: true,
    phase: 1,
    implemented: true,
  },
  {
    id: "human",
    name: "You",
    when: "call",
    side: "human",
    plainDescription: "Have the actual conversation and close.",
    wraps: "This part stays human.",
    humanInLoop: "This is the human",
    mustHave: true,
    phase: 1,
    implemented: false,
  },
  {
    id: "analyst",
    name: "Analyst",
    when: "after",
    side: "rep",
    plainDescription: "Watches the replay and tells you how it went.",
    wraps: "Conversation intelligence, call recording & transcription",
    humanInLoop: "Rep reviews insights",
    mustHave: false,
    phase: 2,
    implemented: false,
  },
  {
    id: "scribe",
    name: "Scribe",
    when: "after",
    side: "rep",
    plainDescription: "Writes the thank-you note for you to approve.",
    wraps: "Email templates, sequences, snippets",
    humanInLoop: "Rep approves & sends",
    mustHave: false,
    phase: 2,
    implemented: false,
  },
  {
    id: "auditor",
    name: "Auditor",
    when: "behind",
    side: "ops",
    plainDescription: "Fact-checks notes against what really happened.",
    wraps: "Deal pipeline/stages, deal insights, reporting + conversation data",
    humanInLoop: "Manager reviews flags",
    mustHave: true,
    phase: 1,
    implemented: true,
  },
  {
    id: "forecaster",
    name: "Forecaster",
    when: "behind",
    side: "ops",
    plainDescription: "Adds it all up to predict the month.",
    wraps: "Forecasting tool, sales analytics dashboards",
    humanInLoop: "Manager reviews",
    mustHave: false,
    phase: 1,
    implemented: true,
  },
  {
    id: "coach",
    name: "Coach",
    when: "behind",
    side: "ops",
    plainDescription: "Notices who needs a hand, and with what.",
    wraps: "Conversation-intelligence coaching, performance reports",
    humanInLoop: "Manager acts on tips",
    mustHave: false,
    phase: 2,
    implemented: false,
  },
];

export function getAgentMeta(id: string): AgentMeta | undefined {
  return ROSTER.find((a) => a.id === id);
}

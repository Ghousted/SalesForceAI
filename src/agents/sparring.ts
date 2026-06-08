import { buildDossier, listContactsForRep, type ProspectDossier } from "@/lib/data/spine";
import { getLLM } from "@/lib/llm/provider";
import type { AgentRunResult } from "./types";

/**
 * Sparring Partner — "a practice partner to rehearse with." (Must-have, Before.)
 *
 * Unlike the read-only report agents, this one role-plays the *prospect*: it
 * raises objections grounded in that prospect's real persona, deal and recent
 * messages, reacts in character to the rep's answers, and scores the session.
 *
 * Design notes:
 *  - **Extends beyond the CRM** (PRD §6) — practice mode is new behaviour, but
 *    every objection is still grounded in real spine context so rehearsal maps
 *    to the actual deal.
 *  - **Stateless & deterministic** — the objection plan is derived from data;
 *    the session is recomputed from the transcript the client sends each turn,
 *    so there is no server-side session store and replays are consistent.
 *  - **LLM seam for the dynamic part** — objection prompts are the scripted
 *    playbook; the prospect's in-character reactions route through the provider,
 *    so a real model upgrades the role-play with no shape change.
 */

export interface Objection {
  id: string;
  theme: string;
  /** What the prospect says (the partner's line). */
  prompt: string;
  /** Terms a strong answer would touch — used to evaluate the rep. */
  keywords: string[];
  /** Shown as a hint after the turn. */
  coachingTip: string;
}

export interface TurnEvaluation {
  score: number; // 0–100
  strengths: string[];
  misses: string[];
}

export interface CompletedTurn {
  objection: Objection;
  repMessage: string;
  evaluation: TurnEvaluation;
  /** The prospect's in-character reaction (LLM seam). */
  inCharacterReply: string;
}

export interface Scorecard {
  overall: number;
  label: string;
  perObjection: { theme: string; score: number }[];
  summary: string;
}

export interface SparState {
  contactId: string;
  prospectName: string;
  persona: string;
  scenario: string;
  total: number;
  index: number;
  turns: CompletedTurn[];
  currentObjection: Objection | null;
  done: boolean;
  scorecard: Scorecard | null;
}

export interface SparAnswer {
  objectionId: string;
  repMessage: string;
}

// --- Objection derivation ---------------------------------------------------

interface Detector {
  theme: string;
  test: (d: ProspectDossier, haystack: string) => boolean;
  build: (d: ProspectDossier) => Omit<Objection, "id">;
}

/** All searchable text for a prospect, lower-cased. */
function haystackFor(d: ProspectDossier): string {
  return [
    d.contact.persona,
    ...d.activities.map((a) => `${a.subject} ${a.body}`),
  ]
    .join(" ")
    .toLowerCase();
}

const DETECTORS: Detector[] = [
  {
    theme: "Flexibility / exit",
    test: (_d, h) => /leas|resell|resale|short-term|flexib|exit|sublet|rent out|plans change/.test(h),
    build: (d) => ({
      theme: "Flexibility / exit",
      prompt: `Before we go further — what if our plans change? My ${d.contact.firstName === "Elena" ? "husband" : "family"} and I want to know we're not locked in. Can the unit be leased out or resold easily?`,
      keywords: ["leas", "rent", "resell", "resale", "flexib", "exit", "policy", "allow", "value", "appreciat"],
      coachingTip: "Acknowledge the worry, state the building's actual policy, and reframe flexibility as a strength.",
    }),
  },
  {
    theme: "Competitor comparison",
    test: (_d, h) => /competitor|viewed two|comparing|other develop|three project|also looking|shopping/.test(h),
    build: () => ({
      theme: "Competitor comparison",
      prompt: "Honestly, I'm looking at two other developments that are a bit cheaper. Why should I go with you instead of them?",
      keywords: ["unique", "differen", "value", "location", "quality", "track record", "unlike", "advantage", "developer", "resale"],
      coachingTip: "Don't bash competitors — anchor on specific, verifiable differentiators that matter to this buyer.",
    }),
  },
  {
    theme: "ROI / yield",
    test: (_d, h) => /roi|yield|rental|return|turnover|investment|appreciat/.test(h),
    build: () => ({
      theme: "ROI / yield",
      prompt: "I'm buying this purely as an investment. What rental yield can I realistically expect, and when does the unit turn over? I'm not in a rush, so give me real numbers.",
      keywords: ["yield", "roi", "return", "appreciat", "rental", "turnover", "%", "percent", "data", "projection", "average"],
      coachingTip: "Lead with concrete, defensible figures and the turnover date — vagueness loses an analytical buyer.",
    }),
  },
  {
    theme: "Don't rush me",
    test: (d, h) => /rush|pushy|pressure|patient|cautious|slow|previous agent/.test(h) || d.contact.persona.toLowerCase().includes("relationship"),
    build: () => ({
      theme: "Don't rush me",
      prompt: "I'll be honest — the last agent pushed me hard and it put me off. I don't want to be rushed into this. Can you respect that?",
      keywords: ["understand", "your pace", "take your time", "no pressure", "whenever", "comfortable", "no rush", "here for you", "questions"],
      coachingTip: "Match their pace, give them control, and offer value with no ask attached.",
    }),
  },
  {
    theme: "Timing",
    test: (_d, h) => /timing|wedding|november|q3|relocat|move-in|deliver|ready by|deadline/.test(h),
    build: () => ({
      theme: "Timing",
      prompt: "Timing really matters to me — I need this sorted around a date I can't move. Can you actually deliver on that schedule, or are you just telling me what I want to hear?",
      keywords: ["timeline", "before", "ready", "schedule", "date", "deliver", "turnover", "move-in", "commit", "milestone"],
      coachingTip: "Be specific and honest about timelines; a credible 'here's the real schedule' beats an eager 'yes'.",
    }),
  },
];

/** A universal closing/price test, always added last. */
function priceObjection(d: ProspectDossier): Omit<Objection, "id"> {
  const amount = d.deal
    ? new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 }).format(d.deal.amount)
    : "the price";
  return {
    theme: "Price / value",
    prompt: `${amount} is a lot of money. Convince me it's worth it — what exactly am I paying for that I couldn't get for less elsewhere?`,
    keywords: ["value", "worth", "payment", "terms", "financing", "included", "justif", "compared", "long-term", "quality", "location"],
    coachingTip: "Shift from price to value: tie the number to outcomes this specific buyer cares about.",
  };
}

/** Derive up to 3 grounded objections + a closing price test. */
export function deriveObjections(d: ProspectDossier): Objection[] {
  const h = haystackFor(d);
  const picked: Omit<Objection, "id">[] = [];
  const seen = new Set<string>();
  for (const det of DETECTORS) {
    if (picked.length >= 3) break;
    if (det.test(d, h) && !seen.has(det.theme)) {
      picked.push(det.build(d));
      seen.add(det.theme);
    }
  }
  picked.push(priceObjection(d));
  return picked.map((o, i) => ({ ...o, id: `obj${i + 1}` }));
}

// --- Evaluation -------------------------------------------------------------

const ACK_RE = /understand|hear you|good question|appreciate|fair (point|enough)|makes sense|i see|that'?s valid|i get/i;
const CONCRETE_RE = /\d|will|let me|i can|we (offer|provide|have|can)|next step|schedule|send|happy to|for example|specifically/i;

function evaluate(objection: Objection, repMessage: string): TurnEvaluation {
  const text = repMessage.toLowerCase();
  const matched = objection.keywords.filter((k) => text.includes(k));
  const addressed = matched.length > 0;
  const acknowledged = ACK_RE.test(repMessage);
  const concrete = CONCRETE_RE.test(repMessage);
  const effort = repMessage.trim().length >= 40;

  let score = 0;
  if (addressed) score += 40;
  if (acknowledged) score += 20;
  if (concrete) score += 25;
  if (effort) score += 15;
  score = Math.max(0, Math.min(100, score));

  const strengths: string[] = [];
  const misses: string[] = [];
  if (acknowledged) strengths.push("Acknowledged the concern before answering.");
  else misses.push("Didn't acknowledge the concern — jump-cut straight to selling.");
  if (addressed) strengths.push(`Spoke to the actual issue (${objection.theme.toLowerCase()}).`);
  else misses.push(`Didn't address the ${objection.theme.toLowerCase()} point directly.`);
  if (concrete) strengths.push("Gave something concrete to hold onto.");
  else misses.push("Stayed vague — no specifics, numbers, or next step.");
  if (!effort) misses.push("Answer was thin; give it more substance.");

  return { score, strengths, misses };
}

function reactionTone(score: number): { mood: string; line: (name: string, theme: string) => string } {
  if (score >= 70)
    return {
      mood: "won-over",
      line: (_n, _t) => "Okay — that actually answers it. I appreciate the straight reply. What's next?",
    };
  if (score >= 40)
    return {
      mood: "partly-satisfied",
      line: (_n, t) => `Hm. That's part of it, but I'm still not fully settled on the ${t.toLowerCase()}. Can you go a bit deeper?`,
    };
  return {
    mood: "unconvinced",
    line: (_n, t) => `Honestly, I didn't really hear an answer to my concern about ${t.toLowerCase()}. That's the kind of thing that makes me hesitate.`,
  };
}

async function composeReaction(
  d: ProspectDossier,
  objection: Objection,
  evaluation: TurnEvaluation,
): Promise<string> {
  const tone = reactionTone(evaluation.score);
  const scripted = tone.line(d.contact.firstName, objection.theme);
  const llm = getLLM();
  return llm.complete({
    system: `Role-play as ${d.contact.firstName}, a real-estate prospect. Persona: ${d.contact.persona} Stay in character and reply in 1–2 sentences as the buyer, ${tone.mood} by the salesperson's last answer. Do not break character.`,
    user: scripted,
    grounding: { objection, evaluation },
  });
}

function buildScorecard(turns: CompletedTurn[]): Scorecard {
  const overall = turns.length
    ? Math.round(turns.reduce((s, t) => s + t.evaluation.score, 0) / turns.length)
    : 0;
  const label = overall >= 75 ? "Strong" : overall >= 50 ? "Solid, with gaps" : "Needs work";
  const perObjection = turns.map((t) => ({ theme: t.objection.theme, score: t.evaluation.score }));
  const best = [...perObjection].sort((a, b) => b.score - a.score)[0];
  const worst = [...perObjection].sort((a, b) => a.score - b.score)[0];
  const summary =
    `You handled ${turns.length} objection${turns.length === 1 ? "" : "s"}, averaging ${overall}/100 (${label}).` +
    (best ? ` Strongest: ${best.theme.toLowerCase()} (${best.score}).` : "") +
    (worst && worst !== best ? ` Work on: ${worst.theme.toLowerCase()} (${worst.score}).` : "");
  return { overall, label, perObjection, summary };
}

// --- Session ----------------------------------------------------------------

/**
 * Recompute the whole session from the transcript (stateless). `answers` is the
 * ordered list of rep replies so far; the function evaluates each, generates the
 * prospect's reaction, and returns the next objection (or the scorecard).
 */
export async function runSparSession(
  contactId: string,
  answers: SparAnswer[],
): Promise<AgentRunResult<SparState>> {
  const dossier = buildDossier(contactId);
  if (!dossier) throw new Error(`Sparring Partner: no contact ${contactId}`);

  const objections = deriveObjections(dossier);

  const turns: CompletedTurn[] = [];
  for (let i = 0; i < answers.length && i < objections.length; i++) {
    const objection = objections[i];
    const evaluation = evaluate(objection, answers[i].repMessage);
    const inCharacterReply = await composeReaction(dossier, objection, evaluation);
    turns.push({ objection, repMessage: answers[i].repMessage, evaluation, inCharacterReply });
  }

  const index = turns.length;
  const currentObjection = index < objections.length ? objections[index] : null;
  const done = currentObjection === null;
  const scorecard = done ? buildScorecard(turns) : null;

  const scenario = dossier.deal
    ? `Rehearsing ${dossier.contact.firstName} on the "${dossier.deal.property}" deal.`
    : `Rehearsing a conversation with ${dossier.contact.firstName}.`;

  const state: SparState = {
    contactId,
    prospectName: `${dossier.contact.firstName} ${dossier.contact.lastName}`,
    persona: dossier.contact.persona,
    scenario,
    total: objections.length,
    index,
    turns,
    currentObjection,
    done,
    scorecard,
  };

  return {
    agentId: "sparring-partner",
    headline: done
      ? `Practice complete — ${scorecard?.overall ?? 0}/100`
      : `Rehearsing with ${dossier.contact.firstName} (${index}/${objections.length})`,
    data: state,
    evidence: [{ kind: "contact", id: contactId, label: state.prospectName }],
  };
}

/** Sparring Partner's push status for the roster home. */
export function sparringStatus(repId: string): { scenarios: number } {
  return { scenarios: listContactsForRep(repId).length };
}

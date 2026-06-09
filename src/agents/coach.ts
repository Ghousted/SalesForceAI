import { listReps } from "@/lib/data/spine";
import { auditBook } from "./auditor";
import { getLLM } from "@/lib/llm/provider";
import { php } from "@/lib/format";
import type { AgentRunResult } from "./types";

/**
 * Coach — "notices who needs a hand, and with what." (Behind the scenes, Ops.)
 *
 * Manager-facing. It groups the Auditor's flags per rep into coaching themes
 * (follow-up discipline, honest forecasting, pipeline hygiene…) and surfaces who
 * to coach and on what. Read-only — the manager acts on the tips. Reuses
 * `auditBook` so coaching and the pipeline truth come from the same evidence.
 */

interface FocusTemplate {
  area: string;
  tip: (n: number) => string;
}

// Maps an Auditor rule to a coaching theme.
const RULE_FOCUS: Record<string, FocusTemplate> = {
  "unanswered-inbound": {
    area: "Follow-up discipline",
    tip: (n) => `${n} deal${n === 1 ? "" : "s"} have the prospect waiting on a reply. Block time daily to clear inbound before new outreach.`,
  },
  "optimistic-confidence": {
    area: "Honest forecasting",
    tip: (n) => `${n} deal${n === 1 ? "" : "s"} rated higher than the evidence supports. Re-rate at deal reviews; reward accuracy, not optimism.`,
  },
  "going-quiet": {
    area: "Pipeline hygiene",
    tip: (n) => `${n} deal${n === 1 ? "" : "s"} have gone quiet. Set a re-engage-or-close rule so stale deals stop inflating the pipe.`,
  },
  "stage-evidence-mismatch": {
    area: "CRM accuracy",
    tip: (n) => `${n} deal${n === 1 ? "" : "s"} sit in a stage the activity doesn't support. Tighten stage-change criteria.`,
  },
  "close-date-pressure": {
    area: "Close-date realism",
    tip: (n) => `${n} deal${n === 1 ? "" : "s"} are dated to close with open threads. Move close dates to reality.`,
  },
};

export interface CoachFocus {
  area: string;
  count: number;
  tip: string;
}

export interface RepCoaching {
  repId: string;
  repName: string;
  dealCount: number;
  flagCount: number;
  highSeverity: number;
  optimismGap: number;
  priority: "high" | "medium" | "low";
  focuses: CoachFocus[];
  coaching: string; // LLM
}

export interface CoachReport {
  reps: RepCoaching[];
  summary: string;
  floorFlags: number;
}

export async function runCoach(): Promise<AgentRunResult<CoachReport>> {
  const llm = getLLM();
  const reps: RepCoaching[] = [];
  let floorFlags = 0;

  for (const rep of listReps()) {
    const audits = auditBook(rep.id);
    if (audits.length === 0) continue;

    const flags = audits.flatMap((d) => d.flags);
    if (flags.length === 0) continue; // no coaching needed
    floorFlags += flags.length;

    const byRule = new Map<string, number>();
    for (const f of flags) byRule.set(f.ruleId, (byRule.get(f.ruleId) ?? 0) + 1);

    const focuses: CoachFocus[] = [];
    for (const [ruleId, count] of byRule) {
      const t = RULE_FOCUS[ruleId];
      if (t) focuses.push({ area: t.area, count, tip: t.tip(count) });
    }
    focuses.sort((a, b) => b.count - a.count);

    const highSeverity = flags.filter((f) => f.severity === "high").length;
    const optimismGap = audits.reduce(
      (s, d) => s + (d.amount * (d.repConfidence - d.auditorConfidence)) / 100,
      0,
    );
    const priority: RepCoaching["priority"] =
      highSeverity >= 2 || optimismGap > 5_000_000 ? "high" : flags.length > 1 ? "medium" : "low";

    const coaching = await llm.complete({
      agent: "coach",
      system:
        "You are a sales Coach advising the manager on one rep. In 1–2 sentences, name the rep's main pattern to work on and one concrete coaching action. Be supportive and specific; use only the facts given.",
      user:
        `Rep ${rep.name}: ${audits.length} deals, ${flags.length} flags (${highSeverity} high). ` +
        `Optimism gap ${php(Math.round(optimismGap))}. ` +
        `Themes: ${focuses.map((f) => `${f.area} (${f.count})`).join(", ")}.`,
      grounding: { focuses, optimismGap },
    });

    reps.push({
      repId: rep.id,
      repName: rep.name,
      dealCount: audits.length,
      flagCount: flags.length,
      highSeverity,
      optimismGap: Math.round(optimismGap),
      priority,
      focuses,
      coaching,
    });
  }

  const rank = { high: 0, medium: 1, low: 2 };
  reps.sort((a, b) => rank[a.priority] - rank[b.priority] || b.flagCount - a.flagCount);

  const summary = await llm.complete({
    agent: "coach",
    system:
      "You are a sales Coach summarizing for the manager. In 1–2 sentences, say who most needs coaching and on what, across the floor. Use only the facts given.",
    user:
      reps.length === 0
        ? "No coaching flags across the floor — reps are on top of their pipeline."
        : `Reps needing attention: ${reps.map((r) => `${r.repName} (${r.priority}, focus: ${r.focuses[0]?.area ?? "general"})`).join("; ")}. Floor flags: ${floorFlags}.`,
    grounding: { reps: reps.map((r) => ({ name: r.repName, priority: r.priority })) },
  });

  return {
    agentId: "coach",
    headline:
      reps.length === 0
        ? "No coaching needed — the floor is healthy"
        : `${reps.length} rep${reps.length === 1 ? "" : "s"} to coach`,
    data: { reps, summary, floorFlags },
    evidence: reps.map((r) => ({ kind: "contact" as const, id: r.repId, label: r.repName })),
  };
}

/** Coach's push status. */
export function coachStatus(): { repsToCoach: number } {
  let count = 0;
  for (const rep of listReps()) {
    const audits = auditBook(rep.id);
    if (audits.some((d) => d.flags.length > 0)) count++;
  }
  return { repsToCoach: count };
}

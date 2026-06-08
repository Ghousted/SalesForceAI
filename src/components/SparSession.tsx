"use client";

import { useEffect, useRef, useState } from "react";
import type {
  SparState,
  SparAnswer,
  CompletedTurn,
  TurnEvaluation,
} from "@/agents/sparring";
import type { AgentRunResult } from "@/agents/types";

function scoreColor(score: number): string {
  if (score >= 70) return "text-green-700";
  if (score >= 40) return "text-amber-700";
  return "text-rose-700";
}

function Bubble({
  side,
  children,
}: {
  side: "prospect" | "rep";
  children: React.ReactNode;
}) {
  const isRep = side === "rep";
  return (
    <div className={`flex ${isRep ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${
          isRep
            ? "rounded-br-sm bg-indigo-600 text-white"
            : "rounded-bl-sm bg-slate-100 text-slate-800"
        }`}
      >
        {children}
      </div>
    </div>
  );
}

function EvalNote({ evaluation }: { evaluation: TurnEvaluation }) {
  return (
    <div className="mx-auto max-w-[90%] rounded-lg border border-slate-200 bg-white p-2.5 text-xs">
      <div className="mb-1 flex items-center justify-between">
        <span className="font-semibold uppercase tracking-wide text-slate-400">
          Coach
        </span>
        <span className={`font-semibold ${scoreColor(evaluation.score)}`}>
          {evaluation.score}/100
        </span>
      </div>
      {evaluation.strengths.map((s, i) => (
        <div key={`s${i}`} className="text-green-700">
          ✓ {s}
        </div>
      ))}
      {evaluation.misses.map((m, i) => (
        <div key={`m${i}`} className="text-rose-600">
          ✕ {m}
        </div>
      ))}
    </div>
  );
}

export function SparSession({
  contactId,
  onClose,
}: {
  contactId: string;
  onClose: () => void;
}) {
  const [state, setState] = useState<SparState | null>(null);
  const [answers, setAnswers] = useState<SparAnswer[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function post(nextAnswers: SparAnswer[]) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/spar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId, answers: nextAnswers }),
      });
      const data = (await res.json()) as
        | AgentRunResult<SparState>
        | { error: string };
      if ("error" in data) setError(data.error);
      else setState(data.data);
    } catch {
      setError("Couldn't reach the Sparring Partner.");
    } finally {
      setBusy(false);
    }
  }

  // Start the session on mount.
  useEffect(() => {
    void post([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactId]);

  // Keep the transcript scrolled to the latest line.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [state]);

  function send() {
    if (!input.trim() || busy || !state?.currentObjection) return;
    const next = [
      ...answers,
      { objectionId: state.currentObjection.id, repMessage: input.trim() },
    ];
    setAnswers(next);
    setInput("");
    void post(next);
  }

  return (
    <div className="flex flex-col">
      {/* Scenario header */}
      <div className="border-b border-slate-100 px-1 pb-3">
        <p className="text-sm text-slate-600">
          {state?.scenario ?? "Setting up the session…"}
        </p>
        {state && (
          <div className="mt-1 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-indigo-500 transition-all"
                style={{ width: `${(state.index / state.total) * 100}%` }}
              />
            </div>
            <span className="text-xs text-slate-400">
              {state.index}/{state.total}
            </span>
          </div>
        )}
      </div>

      {/* Transcript */}
      <div ref={scrollRef} className="max-h-[55vh] min-h-[30vh] space-y-3 overflow-y-auto py-4">
        {state?.turns.map((t: CompletedTurn, i) => (
          <div key={i} className="space-y-2">
            <Bubble side="prospect">{t.objection.prompt}</Bubble>
            <Bubble side="rep">{t.repMessage}</Bubble>
            <EvalNote evaluation={t.evaluation} />
            <div className="text-center text-[11px] text-slate-400">
              💡 {t.objection.coachingTip}
            </div>
            <Bubble side="prospect">{t.inCharacterReply}</Bubble>
          </div>
        ))}

        {/* The pending objection */}
        {state?.currentObjection && (
          <Bubble side="prospect">{state.currentObjection.prompt}</Bubble>
        )}

        {/* Scorecard */}
        {state?.done && state.scorecard && (
          <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-indigo-900">
                Session scorecard
              </span>
              <span
                className={`text-lg font-bold ${scoreColor(state.scorecard.overall)}`}
              >
                {state.scorecard.overall}/100
              </span>
            </div>
            <p className="mt-1 text-sm text-indigo-800">
              {state.scorecard.summary}
            </p>
            <div className="mt-3 space-y-1">
              {state.scorecard.perObjection.map((p, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between text-xs"
                >
                  <span className="text-slate-600">{p.theme}</span>
                  <span className={`font-semibold ${scoreColor(p.score)}`}>
                    {p.score}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {error && <p className="text-sm text-rose-600">{error}</p>}
      </div>

      {/* Composer */}
      <div className="border-t border-slate-100 pt-3">
        {state?.done ? (
          <button
            onClick={onClose}
            className="w-full rounded-lg bg-slate-800 py-2.5 text-sm font-medium text-white hover:bg-slate-900"
          >
            Done — close
          </button>
        ) : (
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={2}
              disabled={busy || !state?.currentObjection}
              placeholder={
                busy ? "…" : "Type your response to the objection…"
              }
              className="flex-1 resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-300"
            />
            <button
              onClick={send}
              disabled={busy || !input.trim() || !state?.currentObjection}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition disabled:opacity-40 enabled:hover:bg-indigo-700"
            >
              Send
            </button>
          </div>
        )}
        <p className="mt-2 text-center text-[11px] text-slate-400">
          Practice only — no real prospect is contacted. The live call stays
          yours.
        </p>
      </div>
    </div>
  );
}

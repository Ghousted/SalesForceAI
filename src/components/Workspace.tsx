"use client";

import { useState } from "react";
import Link from "next/link";
import type { ScoutBrief } from "@/agents/scout";
import type { AgentRunResult } from "@/agents/types";
import { WHEN_LABELS } from "@/agents/types";
import type { HomeVM } from "@/lib/home/viewModel";
import { AgentCard } from "./AgentCard";
import { CommandBar } from "./CommandBar";
import { ScoutBriefView } from "./ScoutBriefView";

export interface ContactSummary {
  id: string;
  name: string;
  dealName: string | null;
  stageLabel: string | null;
}

export function Workspace({
  home,
  contacts,
}: {
  home: HomeVM;
  contacts: ContactSummary[];
}) {
  const [busy, setBusy] = useState(false);
  const [brief, setBrief] = useState<ScoutBrief | null>(null);
  const [picking, setPicking] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function scoutFor(contactId: string) {
    setBusy(true);
    setNote(null);
    setPicking(false);
    try {
      const res = await fetch("/api/scout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId }),
      });
      const data = (await res.json()) as AgentRunResult<ScoutBrief> | { error: string };
      if ("error" in data) setNote(data.error);
      else setBrief(data.data);
    } catch {
      setNote("Couldn't reach Scout.");
    } finally {
      setBusy(false);
    }
  }

  async function runCommand(text: string) {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch("/api/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, repId: home.repId }),
      });
      const data = await res.json();
      if (data.result?.data) {
        setBrief(data.result.data as ScoutBrief);
      } else {
        setNote(
          data.message +
            (data.suggestions?.length
              ? ` (try: ${data.suggestions.slice(0, 2).join(", ")})`
              : ""),
        );
      }
    } catch {
      setNote("Command failed.");
    } finally {
      setBusy(false);
    }
  }

  function onOpenAgent(id: string) {
    if (id === "scout") setPicking(true);
  }

  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      {/* Top bar */}
      <header className="mb-7 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
            S
          </div>
          <div>
            <div className="text-sm font-semibold leading-tight">Sales OS</div>
            <div className="text-xs text-slate-400">
              AI owns the system · the human owns the close
            </div>
          </div>
        </div>
        <nav className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 text-sm">
          <Link
            href="/"
            className={`rounded-md px-3 py-1 font-medium ${home.role === "rep" ? "bg-white shadow-sm" : "text-slate-500"}`}
          >
            Rep
          </Link>
          <Link
            href="/manager"
            className={`rounded-md px-3 py-1 font-medium ${home.role === "manager" ? "bg-white shadow-sm" : "text-slate-500"}`}
          >
            Manager
          </Link>
        </nav>
      </header>

      {/* Greeting + command bar */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          {home.role === "manager" ? "Your floor" : `Good day, ${home.repName.split(" ")[0]}`}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {home.role === "manager"
            ? "The same team, watching the whole pipeline's truth."
            : "Here's your team and what they've handled. The live call is yours."}
        </p>
        <div className="mt-4">
          <CommandBar
            onSubmit={runCommand}
            busy={busy}
            placeholder={
              contacts[0]
                ? `Ask your team… e.g. "brief me on ${contacts[0].name.split(" ")[0]}"`
                : "Ask your team…"
            }
          />
          {note && <p className="mt-2 text-sm text-amber-700">{note}</p>}
        </div>
      </div>

      {/* Roster, grouped by lifecycle */}
      <div className="space-y-7">
        {home.groups.map((g) => (
          <section key={g.when}>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
              {WHEN_LABELS[g.when]}
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {g.agents.map((a) => (
                <AgentCard key={a.meta.id} vm={a} onOpen={onOpenAgent} />
              ))}
            </div>
          </section>
        ))}
      </div>

      {/* Prospect picker */}
      {picking && (
        <Overlay onClose={() => setPicking(false)} title="Who are you meeting?">
          <ul className="divide-y divide-slate-100">
            {contacts.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => scoutFor(c.id)}
                  className="flex w-full items-center justify-between py-3 text-left hover:bg-slate-50"
                >
                  <span>
                    <span className="font-medium text-slate-800">{c.name}</span>
                    {c.dealName && (
                      <span className="block text-xs text-slate-400">
                        {c.dealName}
                      </span>
                    )}
                  </span>
                  {c.stageLabel && (
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                      {c.stageLabel}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </Overlay>
      )}

      {/* Scout brief slide-over */}
      {brief && (
        <Overlay onClose={() => setBrief(null)} title="Scout · pre-call brief" wide>
          <ScoutBriefView brief={brief} />
        </Overlay>
      )}
    </div>
  );
}

function Overlay({
  title,
  children,
  onClose,
  wide,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/30"
      onClick={onClose}
    >
      <div
        className={`h-full overflow-y-auto bg-white shadow-2xl ${wide ? "w-full max-w-xl" : "w-full max-w-md"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-white/90 px-5 py-3 backdrop-blur">
          <span className="text-sm font-semibold text-slate-600">{title}</span>
          <button
            onClick={onClose}
            className="rounded-md px-2 py-1 text-slate-400 hover:bg-slate-100"
          >
            ✕
          </button>
        </div>
        <div className="px-5 py-5">{children}</div>
      </div>
    </div>
  );
}

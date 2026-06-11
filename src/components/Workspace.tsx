"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import type { ScoutBrief } from "@/agents/scout";
import type { AuditReport } from "@/agents/auditor";
import type { Forecast } from "@/agents/forecaster";
import type { DispatchReport } from "@/agents/dispatcher";
import type { AnalystReport } from "@/agents/analyst";
import type { CoachReport } from "@/agents/coach";
import type { AgentRunResult } from "@/agents/types";
import type { AgentAction } from "@/lib/actions/types";
import { WHEN_LABELS } from "@/agents/types";
import type { HomeVM } from "@/lib/home/viewModel";
import { AgentCard } from "./AgentCard";
import { CommandBar } from "./CommandBar";
import { ScoutBriefView } from "./ScoutBriefView";
import { AuditReportView } from "./AuditReportView";
import { ForecastView } from "./ForecastView";
import { SparSession } from "./SparSession";
import { ActionList } from "./ActionList";
import { AutomationsPanel } from "./AutomationsPanel";
import { AnalystView } from "./AnalystView";
import { CoachView } from "./CoachView";
import { MetricsRow } from "./MetricsRow";
import { Onboarding, SampleDataBanner } from "./Onboarding";
import type { DealMetrics } from "@/lib/home/metrics";

export interface ContactSummary {
  id: string;
  name: string;
  dealName: string | null;
  stageLabel: string | null;
}

gsap.registerPlugin(useGSAP);

export function Workspace({
  home,
  contacts,
  metrics,
}: {
  home: HomeVM;
  contacts: ContactSummary[];
  metrics?: DealMetrics;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [brief, setBrief] = useState<ScoutBrief | null>(null);
  const [audit, setAudit] = useState<AuditReport | null>(null);
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [analyst, setAnalyst] = useState<AnalystReport | null>(null);
  const [coach, setCoach] = useState<CoachReport | null>(null);
  const [picking, setPicking] = useState(false);
  const [pickMode, setPickMode] = useState<"scout" | "spar" | "scribe" | "analyst">("scout");
  const [sparContact, setSparContact] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [pending, setPending] = useState<AgentAction[]>([]);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [automationsOpen, setAutomationsOpen] = useState(false);

  const refreshPending = useCallback(async () => {
    try {
      const res = await fetch("/api/actions?status=pending");
      const data = await res.json();
      setPending((data.actions ?? []) as AgentAction[]);
    } catch {
      /* inbox stays as-is */
    }
  }, []);

  // Poll so proposals from auto-fired triggers surface in the inbox badge.
  useEffect(() => {
    void refreshPending();
    const t = setInterval(() => void refreshPending(), 30_000);
    return () => clearInterval(t);
  }, [refreshPending]);

  // Entrance: the bar settles, the headline rises, the roster staggers in.
  // matchMedia → no animation for reduced-motion (content stays as SSR'd);
  // fromTo + clearProps guarantees elements always end fully visible.
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const ease = "power3.out";
        const o = { immediateRender: true, clearProps: "opacity,transform" } as const;
        gsap.fromTo("[data-reveal='bar']", { y: -12, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease, ...o });
        gsap.fromTo(
          "[data-reveal='hero']",
          { y: 22, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.7, ease, delay: 0.05, stagger: 0.08, ...o },
        );
        gsap.fromTo(
          ".agent-card",
          { y: 18, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.5, ease, delay: 0.2, stagger: { each: 0.045, from: "start" }, ...o },
        );
      });
    },
    { scope: root },
  );

  async function runDispatcher() {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch("/api/dispatcher", { method: "POST" });
      const data = (await res.json()) as
        | AgentRunResult<DispatchReport>
        | { error: string };
      if ("error" in data) setNote(data.error);
      else setNote(data.data.message);
      await refreshPending();
      setInboxOpen(true);
    } catch {
      setNote("Couldn't reach the Dispatcher.");
    } finally {
      setBusy(false);
    }
  }

  function onActionResolved(updated: AgentAction) {
    // Drop it from the pending list once it's no longer awaiting approval.
    setPending((prev) => prev.filter((a) => a.id !== updated.id));
  }

  async function analystFor(contactId: string) {
    setBusy(true);
    setNote(null);
    setPicking(false);
    try {
      const res = await fetch("/api/analyst", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId }),
      });
      const data = (await res.json()) as AgentRunResult<AnalystReport> | { error: string };
      if ("error" in data) setNote(data.error);
      else setAnalyst(data.data);
    } catch {
      setNote("Couldn't reach the Analyst.");
    } finally {
      setBusy(false);
    }
  }

  async function runCoach() {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch("/api/coach", { method: "POST" });
      const data = (await res.json()) as AgentRunResult<CoachReport> | { error: string };
      if ("error" in data) setNote(data.error);
      else setCoach(data.data);
    } catch {
      setNote("Couldn't reach the Coach.");
    } finally {
      setBusy(false);
    }
  }

  async function scribeFor(contactId: string) {
    setBusy(true);
    setNote(null);
    setPicking(false);
    try {
      const res = await fetch("/api/scribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId }),
      });
      const data = await res.json();
      if (data.error) setNote(data.error);
      else {
        setNote(`Scribe drafted a follow-up to ${data.data.prospectName} — review it in your inbox.`);
        await refreshPending();
        setInboxOpen(true);
      }
    } catch {
      setNote("Couldn't reach Scribe.");
    } finally {
      setBusy(false);
    }
  }

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

  async function runAudit() {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repId: home.repId }),
      });
      const data = (await res.json()) as AgentRunResult<AuditReport> | { error: string };
      if ("error" in data) setNote(data.error);
      else setAudit(data.data);
    } catch {
      setNote("Couldn't reach the Auditor.");
    } finally {
      setBusy(false);
    }
  }

  async function runForecast() {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch("/api/forecast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repId: home.repId }),
      });
      const data = (await res.json()) as AgentRunResult<Forecast> | { error: string };
      if ("error" in data) setNote(data.error);
      else setForecast(data.data);
    } catch {
      setNote("Couldn't reach the Forecaster.");
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
      if (data.openSpar) {
        setSparContact(data.openSpar.contactId as string);
      } else if (data.result?.agentId === "auditor") {
        setAudit(data.result.data as AuditReport);
      } else if (data.result?.agentId === "forecaster") {
        setForecast(data.result.data as Forecast);
      } else if (data.result?.data) {
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
    if (id === "scout") {
      setPickMode("scout");
      setPicking(true);
    }
    if (id === "sparring-partner") {
      setPickMode("spar");
      setPicking(true);
    }
    if (id === "scribe") {
      setPickMode("scribe");
      setPicking(true);
    }
    if (id === "analyst") {
      setPickMode("analyst");
      setPicking(true);
    }
    if (id === "auditor") runAudit();
    if (id === "forecaster") runForecast();
    if (id === "dispatcher") runDispatcher();
    if (id === "coach") runCoach();
  }

  return (
    <div ref={root}>
      {/* Page actions */}
      <div data-reveal="bar" className="mb-8 flex items-center justify-end gap-2">
        <button
          onClick={() => setAutomationsOpen(true)}
          className="rounded-full px-3 py-1.5 text-[13px] font-medium text-ash transition-colors hover:text-bone"
        >
          Automations
        </button>
        <button
          onClick={() => setInboxOpen(true)}
          className="relative rounded-[4px] bg-ember px-3.5 py-1.5 text-[13px] font-medium text-bone ember-glow transition-transform hover:scale-[1.03]"
        >
          Inbox
          {pending.length > 0 && (
            <span className="ml-1.5 rounded-full bg-bone/20 px-1.5 py-0.5 text-[10px] font-bold text-bone">
              {pending.length}
            </span>
          )}
        </button>
        <nav className="ml-1 flex items-center gap-0.5 rounded-full bg-ash/10 p-0.5 text-[13px]">
          <Link
            href="/app"
            className={`rounded-full px-3 py-1 font-medium transition-colors ${home.role === "rep" ? "bg-graphite text-bone" : "text-ash hover:text-bone"}`}
          >
            Rep
          </Link>
          <Link
            href="/manager"
            className={`rounded-full px-3 py-1 font-medium transition-colors ${home.role === "manager" ? "bg-graphite text-bone" : "text-ash hover:text-bone"}`}
          >
            Manager
          </Link>
        </nav>
      </div>

      {/* Hero — the signature display headline */}
      <div className="mb-12">
        <h1
          data-reveal="hero"
          className="text-[clamp(2.75rem,8vw,5.5rem)] font-bold leading-[0.9] tracking-[-0.021em] text-bone"
        >
          {home.role === "manager" ? "Your floor." : `Good day, ${home.repName.split(" ")[0]}.`}
        </h1>
        <p data-reveal="hero" className="mt-5 max-w-xl text-[15px] leading-[1.5] text-ash">
          {home.role === "manager"
            ? "The same team, watching the whole pipeline's truth — AI owns the system, you own the close."
            : "Here's your team and what they've handled. The live call is yours."}
        </p>
        <div data-reveal="hero" className="mt-7 max-w-2xl">
          <CommandBar
            onSubmit={runCommand}
            busy={busy}
            placeholder={
              contacts[0]
                ? `Ask your team… e.g. "brief me on ${contacts[0].name.split(" ")[0]}"`
                : "Ask your team…"
            }
          />
          {note && <p className="mt-2 text-sm text-ember">{note}</p>}
        </div>
      </div>

      {/* Setup-guide progress — pinned until the checklist is done or dismissed */}
      {home.setup.show && !home.workspaceEmpty && (
        <Link
          href="/setup"
          data-reveal="hero"
          className="group mb-6 flex items-center gap-3 rounded-lg border border-ember/25 bg-ember/[0.06] px-4 py-2.5 transition-colors hover:border-ember/50"
        >
          <span className="text-[13px] font-medium text-bone">Setup guide</span>
          <span className="h-1.5 w-28 overflow-hidden rounded-full bg-ash/10">
            <span className="block h-full rounded-full bg-ember" style={{ width: `${Math.max(4, home.setup.percent)}%` }} />
          </span>
          <span className="text-[12px] text-ash/70">
            {home.setup.completed} of {home.setup.total} done
          </span>
          <span className="ml-auto text-[12px] font-medium text-ember transition-transform group-hover:translate-x-0.5">
            Continue →
          </span>
        </Link>
      )}

      {/* First-run onboarding — only when the workspace has no records at all */}
      {home.workspaceEmpty && <Onboarding name={home.repName} />}

      {/* Sample-data notice — so demo data is never mistaken for real */}
      {home.sampleDataLoaded && <SampleDataBanner />}

      {/* While you were away — what the team did unprompted */}
      {(home.digest.items.length > 0 || home.digest.pendingCount > 0) && (
        <section data-reveal="hero" className="mb-10">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ash/70">
            While you were away
          </h2>
          <div className="rounded-xl border border-ash/12 bg-graphite p-4">
            <ul className="space-y-2">
              {home.digest.items.map((d) => (
                <li key={`${d.agentId}-${d.at}`} className="flex items-baseline gap-2.5 text-[13px]">
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-ember/15 px-2 py-0.5 text-[10px] font-semibold text-ember">
                    <span className="h-1 w-1 rounded-full bg-ember" />
                    {d.agentName}
                  </span>
                  <span className="min-w-0 text-ash">{d.summary}</span>
                  <span className="ml-auto shrink-0 text-[11px] text-ash/50">{relTime(d.at)}</span>
                </li>
              ))}
              {home.digest.items.length === 0 && (
                <li className="text-[13px] text-ash/60">The team is standing by — proposals below need your call.</li>
              )}
            </ul>
            <div className="mt-3 flex items-center gap-3 border-t border-ash/10 pt-3 text-[12px] text-ash/70">
              <span>{home.digest.executedToday} action{home.digest.executedToday === 1 ? "" : "s"} executed today</span>
              {home.digest.pendingCount > 0 && (
                <button
                  onClick={() => setInboxOpen(true)}
                  className="ml-auto rounded-[4px] bg-ember px-3 py-1 text-[12px] font-medium text-bone ember-glow transition-transform hover:scale-[1.03]"
                >
                  Review {home.digest.pendingCount} waiting
                </button>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Pipeline metrics — hidden on an empty workspace (all zeros add no signal) */}
      {metrics && !home.workspaceEmpty && <MetricsRow metrics={metrics} />}

      {/* Roster, grouped by lifecycle */}
      <div className="space-y-7">
        {home.groups.map((g) => (
          <section key={g.when}>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ash/70">
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

      {/* Prospect picker (shared by Scout + Sparring Partner) */}
      {picking && (
        <Overlay
          onClose={() => setPicking(false)}
          title={
            pickMode === "spar"
              ? "Who do you want to rehearse against?"
              : pickMode === "scribe"
                ? "Who should Scribe write to?"
                : pickMode === "analyst"
                  ? "Which call should the Analyst review?"
                  : "Who are you meeting?"
          }
        >
          <ul className="divide-y divide-ash/10">
            {contacts.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => {
                    setPicking(false);
                    if (pickMode === "spar") setSparContact(c.id);
                    else if (pickMode === "scribe") scribeFor(c.id);
                    else if (pickMode === "analyst") analystFor(c.id);
                    else scoutFor(c.id);
                  }}
                  className="flex w-full items-center justify-between py-3 text-left hover:bg-obsidian"
                >
                  <span>
                    <span className="font-medium text-bone">{c.name}</span>
                    {c.dealName && (
                      <span className="block text-xs text-ash/70">
                        {c.dealName}
                      </span>
                    )}
                  </span>
                  {c.stageLabel && (
                    <span className="rounded bg-ash/10 px-2 py-0.5 text-xs text-ash">
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

      {/* Auditor report slide-over */}
      {audit && (
        <Overlay
          onClose={() => setAudit(null)}
          title="Auditor · pipeline truth"
          wide
        >
          <AuditReportView report={audit} />
        </Overlay>
      )}

      {/* Forecaster slide-over */}
      {forecast && (
        <Overlay
          onClose={() => setForecast(null)}
          title="Forecaster · the month"
          wide
        >
          <ForecastView forecast={forecast} />
        </Overlay>
      )}

      {/* Analyst — post-call review */}
      {analyst && (
        <Overlay onClose={() => setAnalyst(null)} title="Analyst · post-call review" wide>
          <AnalystView report={analyst} />
        </Overlay>
      )}

      {/* Coach — who needs a hand */}
      {coach && (
        <Overlay onClose={() => setCoach(null)} title="Coach · who needs a hand" wide>
          <CoachView report={coach} />
        </Overlay>
      )}

      {/* Sparring Partner — interactive session */}
      {sparContact && (
        <Overlay
          onClose={() => setSparContact(null)}
          title="Sparring Partner · practice"
          wide
        >
          <SparSession
            contactId={sparContact}
            onClose={() => setSparContact(null)}
          />
        </Overlay>
      )}

      {/* Automations — triggers, schedule, run log */}
      {automationsOpen && (
        <Overlay
          onClose={() => setAutomationsOpen(false)}
          title="Automations · agents that run themselves"
          wide
        >
          <AutomationsPanel onRan={refreshPending} />
        </Overlay>
      )}

      {/* Action inbox — approve/reject what agents propose */}
      {inboxOpen && (
        <Overlay onClose={() => setInboxOpen(false)} title="Inbox · needs you" wide>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-ash">
                Agents propose; you decide. Approving runs the change against your CRM.
              </p>
              <button
                onClick={runDispatcher}
                disabled={busy}
                className="shrink-0 rounded-lg bg-graphite px-3 py-1.5 text-xs font-medium text-bone transition disabled:opacity-40 enabled:hover:bg-obsidian"
              >
                {busy ? "Scanning…" : "Scan for new leads"}
              </button>
            </div>
            <ActionList
              actions={pending}
              onResolved={onActionResolved}
              emptyLabel="Nothing waiting on you. Run an agent to generate work."
            />
          </div>
        </Overlay>
      )}
    </div>
  );
}

function relTime(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  return hrs < 24 ? `${hrs}h ago` : `${Math.round(hrs / 24)}d ago`;
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
        className={`h-full overflow-y-auto bg-graphite shadow-2xl ${wide ? "w-full max-w-xl" : "w-full max-w-md"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-ash/10 bg-graphite/90 px-5 py-3 backdrop-blur">
          <span className="text-sm font-semibold text-ash">{title}</span>
          <button
            onClick={onClose}
            className="rounded-md px-2 py-1 text-ash/70 hover:bg-ash/10"
          >
            ✕
          </button>
        </div>
        <div className="px-5 py-5">{children}</div>
      </div>
    </div>
  );
}

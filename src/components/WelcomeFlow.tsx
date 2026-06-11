"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { ROSTER } from "@/agents/registry";

gsap.registerPlugin(useGSAP);

/**
 * The post-signup welcome — a full-screen, immersive first run (no app chrome).
 * Welcome → meet the agent team → name the workspace (founders) → pick a
 * starting point. Finishing (or skipping) marks the user's `welcomeDone` and
 * lands them on the dashboard, where the setup-guide checklist takes over.
 */

type StepId = "welcome" | "team" | "workspace" | "start" | "ready";

export function WelcomeFlow({
  firstName,
  workspaceName,
  isFounder,
  workspaceEmpty,
}: {
  firstName: string;
  workspaceName: string;
  isFounder: boolean;
  workspaceEmpty: boolean;
}) {
  const router = useRouter();
  const root = useRef<HTMLDivElement>(null);

  const steps: StepId[] = [
    "welcome",
    "team",
    ...(isFounder ? (["workspace"] as StepId[]) : []),
    workspaceEmpty ? "start" : "ready",
  ];

  const [idx, setIdx] = useState(0);
  const [name, setName] = useState(workspaceName);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const step = steps[idx];

  // Entrance per step (the stage remounts via key={step}) + the ember orb's
  // continuous breathing. fromTo + clearProps + matchMedia per codebase rule.
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.fromTo(
          "[data-fx]",
          { y: 18, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.6, ease: "power3.out", stagger: 0.07, clearProps: "opacity,transform" },
        );
        gsap.fromTo(
          "[data-fx-card]",
          { y: 14, opacity: 0, scale: 0.98 },
          { y: 0, opacity: 1, scale: 1, duration: 0.45, ease: "power3.out", delay: 0.15, stagger: 0.05, clearProps: "opacity,transform" },
        );
        const orb = root.current?.querySelector("[data-orb]");
        if (orb) {
          gsap.to(orb, { scale: 1.15, opacity: 0.85, duration: 2.2, ease: "sine.inOut", repeat: -1, yoyo: true });
        }
      });
    },
    { scope: root, dependencies: [step] },
  );

  function next() {
    setErr("");
    setIdx((i) => Math.min(i + 1, steps.length - 1));
  }

  /** Mark welcome done, then go. Optionally loads the sample pack first. */
  async function finish(href: string, opts?: { loadSample?: boolean }) {
    setBusy(true);
    setErr("");
    try {
      if (opts?.loadSample) {
        const r = await fetch("/api/onboarding/sample", { method: "POST" });
        if (!r.ok) {
          setErr("Couldn't load the sample pipeline — you can retry from the dashboard.");
        }
      }
      await fetch("/api/welcome", { method: "POST" });
      router.push(href);
      router.refresh();
    } catch {
      setErr("Couldn't reach the server.");
      setBusy(false);
    }
  }

  async function saveWorkspaceName() {
    const trimmed = name.trim();
    if (!trimmed || trimmed === workspaceName) {
      next();
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/workspace", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErr(j.error ?? "Couldn't save the name.");
      } else {
        next();
      }
    } catch {
      setErr("Couldn't reach the server.");
    } finally {
      setBusy(false);
    }
  }

  const primaryBtn =
    "rounded-[4px] bg-ember px-6 py-3 text-[14px] font-medium text-bone ember-glow transition-transform hover:scale-[1.03] disabled:opacity-50";

  return (
    <div ref={root} className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-obsidian">
      {/* Ambient ember glow */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 h-[50vh] bg-[radial-gradient(55%_60%_at_50%_0%,rgba(255,71,0,0.10),transparent_70%)]"
      />

      {/* Top bar */}
      <header className="relative z-10 flex items-center justify-between px-6 py-5 sm:px-10">
        <div className="flex items-center gap-2.5">
          <span className="h-3.5 w-3.5 rounded-full bg-ember ember-glow" />
          <span className="text-[15px] font-medium tracking-tight text-bone">Sales OS</span>
        </div>
        <button
          onClick={() => finish("/app")}
          disabled={busy}
          className="text-[13px] text-ash/60 transition-colors hover:text-bone disabled:opacity-50"
        >
          Skip intro →
        </button>
      </header>

      {/* Stage */}
      <main key={step} className="relative z-10 flex flex-1 items-center justify-center px-6 py-10 sm:px-10">
        {step === "welcome" && (
          <div className="max-w-2xl text-center">
            <div className="mb-10 flex justify-center">
              <span data-orb className="block h-16 w-16 rounded-full bg-ember ember-glow" />
            </div>
            <h1
              data-fx
              className="text-[clamp(2.5rem,7vw,4.5rem)] font-bold leading-[0.95] tracking-[-0.021em] text-bone"
            >
              Welcome to Sales OS,
              <br />
              {firstName}.
            </h1>
            <p data-fx className="mx-auto mt-6 max-w-md text-[15px] leading-[1.6] text-ash">
              Your sales team just got eight new members. They run the system — the routing,
              the briefs, the follow-ups, the forecast. You run the close.
            </p>
            <div data-fx className="mt-10">
              <button onClick={next} className={primaryBtn}>
                Meet the team
              </button>
            </div>
          </div>
        )}

        {step === "team" && (
          <div className="w-full max-w-3xl">
            <h1
              data-fx
              className="text-center text-[clamp(2rem,5vw,3.25rem)] font-bold leading-[1] tracking-[-0.021em] text-bone"
            >
              Meet your team.
            </h1>
            <p data-fx className="mx-auto mt-4 max-w-md text-center text-[14px] leading-[1.6] text-ash">
              Each agent owns one job and does it without being asked. Anything that touches a
              prospect waits for your approval.
            </p>
            <div className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-4">
              {ROSTER.filter((a) => a.id !== "human").map((a) => (
                <div
                  key={a.id}
                  data-fx-card
                  className="rounded-xl border border-ash/12 bg-graphite p-4"
                >
                  <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-bone">
                    <span className="h-1.5 w-1.5 rounded-full bg-ember" />
                    {a.name}
                  </span>
                  <p className="mt-1.5 text-[12px] leading-[1.5] text-ash">{a.plainDescription}</p>
                </div>
              ))}
            </div>
            <p data-fx className="mt-6 text-center text-[13px] text-ash/60">
              And the ninth seat is yours — the live call never leaves your hands.
            </p>
            <div data-fx className="mt-8 flex justify-center">
              <button onClick={next} className={primaryBtn}>
                Continue
              </button>
            </div>
          </div>
        )}

        {step === "workspace" && (
          <div className="w-full max-w-md text-center">
            <h1
              data-fx
              className="text-[clamp(2rem,5vw,3.25rem)] font-bold leading-[1] tracking-[-0.021em] text-bone"
            >
              Name your workspace.
            </h1>
            <p data-fx className="mt-4 text-[14px] leading-[1.6] text-ash">
              This is what your team will see when you invite them.
            </p>
            <div data-fx className="mt-8">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void saveWorkspaceName()}
                maxLength={60}
                autoFocus
                className="w-full rounded-lg border border-ash/15 bg-graphite px-4 py-3 text-center text-[16px] font-medium text-bone outline-none transition-colors focus:border-ember placeholder:text-ash/40"
                placeholder="Acme Realty"
              />
              <p className="mt-2 text-[12px] text-ash/50">You can change this anytime in Settings.</p>
            </div>
            {err && <p className="mt-3 text-[13px] text-rose-400">{err}</p>}
            <div data-fx className="mt-8">
              <button onClick={saveWorkspaceName} disabled={busy} className={primaryBtn}>
                {busy ? "Saving…" : "Continue"}
              </button>
            </div>
          </div>
        )}

        {step === "start" && (
          <div className="w-full max-w-2xl">
            <h1
              data-fx
              className="text-center text-[clamp(2rem,5vw,3.25rem)] font-bold leading-[1] tracking-[-0.021em] text-bone"
            >
              How do you want to start?
            </h1>
            <p data-fx className="mx-auto mt-4 max-w-md text-center text-[14px] leading-[1.6] text-ash">
              The agents need a pipeline to work. Bring yours — or borrow ours for a test drive.
            </p>
            <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <StartCard
                title="Import my CRM"
                body="Already on HubSpot? Bring contacts, deals and history over in one click."
                cta="Connect HubSpot →"
                onClick={() => finish("/connectors")}
                disabled={busy}
              />
              <StartCard
                title="Connect my inbox"
                body="Sync Gmail or Outlook so real conversations build the timeline."
                cta="Connect inbox →"
                onClick={() => finish("/connectors")}
                disabled={busy}
              />
              <StartCard
                title="Start from scratch"
                body="Add your first contact by hand and grow from there."
                cta="Add a contact →"
                onClick={() => finish("/contacts")}
                disabled={busy}
              />
              <StartCard
                title="Explore with sample data"
                body="Load a demo pipeline and watch the agents work it. Clear it anytime."
                cta={busy ? "Loading…" : "Load sample →"}
                onClick={() => finish("/app", { loadSample: true })}
                disabled={busy}
                highlight
              />
            </div>
            {err && <p className="mt-4 text-center text-[13px] text-rose-400">{err}</p>}
            <div data-fx className="mt-7 text-center">
              <button
                onClick={() => finish("/app")}
                disabled={busy}
                className="text-[13px] text-ash/60 transition-colors hover:text-bone disabled:opacity-50"
              >
                I&apos;ll explore on my own →
              </button>
            </div>
          </div>
        )}

        {step === "ready" && (
          <div className="max-w-xl text-center">
            <h1
              data-fx
              className="text-[clamp(2.5rem,7vw,4.5rem)] font-bold leading-[0.95] tracking-[-0.021em] text-bone"
            >
              You&apos;re in.
            </h1>
            <p data-fx className="mx-auto mt-6 max-w-md text-[15px] leading-[1.6] text-ash">
              {workspaceName} already has a pipeline — and the agents are already watching it.
              Your seat on the floor is ready.
            </p>
            <div data-fx className="mt-10">
              <button onClick={() => finish("/app")} disabled={busy} className={primaryBtn}>
                {busy ? "Opening…" : "Open your dashboard"}
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Progress dots */}
      <footer className="relative z-10 flex justify-center gap-2 pb-8">
        {steps.map((s, i) => (
          <span
            key={s}
            className={`h-1.5 rounded-full transition-all ${
              i === idx ? "w-6 bg-ember" : "w-1.5 bg-ash/20"
            }`}
          />
        ))}
      </footer>
    </div>
  );
}

function StartCard({
  title,
  body,
  cta,
  onClick,
  disabled,
  highlight,
}: {
  title: string;
  body: string;
  cta: string;
  onClick: () => void;
  disabled?: boolean;
  highlight?: boolean;
}) {
  return (
    <button
      data-fx-card
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col rounded-xl border p-5 text-left transition-colors disabled:opacity-60 ${
        highlight
          ? "border-ember/35 bg-ember/[0.06] hover:border-ember"
          : "border-ash/12 bg-graphite hover:border-ash/30"
      }`}
    >
      <span className="text-sm font-semibold text-bone">{title}</span>
      <span className="mt-1.5 text-[13px] leading-[1.55] text-ash">{body}</span>
      <span className={`mt-3 text-[12px] font-medium ${highlight ? "text-ember" : "text-ash/70"}`}>
        {cta}
      </span>
    </button>
  );
}

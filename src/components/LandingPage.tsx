"use client";

import { useRef } from "react";
import Link from "next/link";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { ROSTER } from "@/agents/registry";

gsap.registerPlugin(useGSAP, ScrollTrigger);

const CONNECTORS = [
  { name: "HubSpot", note: "Import your whole CRM in one click", live: true },
  { name: "Gmail", note: "Sync the inbox onto the timeline", live: true },
  { name: "Outlook", note: "Microsoft 365 mail", live: false },
  { name: "Calendar", note: "Meetings & viewings", live: false },
];

const STEPS = [
  { n: "01", title: "Connect your stack", body: "Bring your contacts, deals and inbox over from HubSpot or start fresh. Your data, your system of record." },
  { n: "02", title: "The agents go to work", body: "Dispatcher routes leads, Scout briefs you, Auditor checks the pipeline's truth, Scribe drafts the follow-ups — automatically." },
  { n: "03", title: "You take the call", body: "Every external send waits for your approval. The agents own the busywork; you own the conversation and the close." },
];

export function LandingPage() {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const ease = "power3.out";
      // Reduced-motion: leave everything as server-rendered (fully visible).
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        // Hero entrance — clearProps so nothing is ever stranded hidden.
        const tl = gsap.timeline({ defaults: { ease, clearProps: "opacity,transform" } });
        tl.from("[data-hero='nav']", { y: -14, opacity: 0, duration: 0.5 }, 0)
          .from("[data-hero='pill']", { y: 12, opacity: 0, duration: 0.5 }, 0.1)
          .from("[data-hero='line']", { yPercent: 110, opacity: 0, duration: 0.85, stagger: 0.12 }, "-=0.2")
          .from("[data-hero='sub']", { y: 16, opacity: 0, duration: 0.6 }, "-=0.45")
          .from("[data-hero='cta']", { y: 16, opacity: 0, duration: 0.55, stagger: 0.08 }, "-=0.4")
          .from("[data-hero='preview']", { y: 40, opacity: 0, scale: 0.97, duration: 0.9 }, "-=0.4");

        // Scroll reveals for the sections below the fold.
        gsap.set(".reveal", { y: 28, opacity: 0 });
        ScrollTrigger.batch(".reveal", {
          start: "top 85%",
          onEnter: (els) => gsap.to(els, { y: 0, opacity: 1, duration: 0.7, stagger: 0.08, ease, overwrite: true }),
        });
      });
    },
    { scope: root },
  );

  return (
    <div ref={root} className="min-h-screen bg-obsidian">
      {/* Nav */}
      <header data-hero="nav" className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2.5">
          <span className="h-3.5 w-3.5 rounded-full bg-ember ember-glow" />
          <span className="text-[15px] font-medium tracking-tight text-bone">Sales OS</span>
        </div>
        <nav className="hidden items-center gap-1 md:flex">
          {[["#agents", "Agents"], ["#connect", "Connect"], ["#how", "How it works"]].map(([h, l]) => (
            <a key={h} href={h} className="rounded-full px-3.5 py-1.5 text-[13px] font-medium text-ash transition-colors hover:text-bone">
              {l}
            </a>
          ))}
        </nav>
        <Link href="/app" className="rounded-[4px] bg-ember px-4 py-2 text-[13px] font-medium text-bone ember-glow transition-transform hover:scale-[1.03]">
          Launch app
        </Link>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pb-10 pt-16 text-center md:pt-24">
        <div className="flex justify-center">
          <a
            href="#connect"
            data-hero="pill"
            className="inline-flex items-center gap-2 rounded-full border border-ash/15 bg-graphite px-3.5 py-1.5 text-[13px] text-ash transition-colors hover:text-bone"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-ember" />
            Now syncing HubSpot &amp; Gmail
            <span className="text-ash/50">→</span>
          </a>
        </div>

        <h1 className="mx-auto mt-8 max-w-4xl font-bold leading-[0.9] tracking-[-0.021em] text-bone [font-size:clamp(2.75rem,9vw,7rem)]">
          <span className="block overflow-hidden">
            <span data-hero="line" className="block">AI runs the system.</span>
          </span>
          <span className="block overflow-hidden">
            <span data-hero="line" className="block">You run the close.</span>
          </span>
        </h1>

        <p data-hero="sub" className="mx-auto mt-6 max-w-xl text-[15px] leading-[1.5] text-ash">
          An agent-native CRM where a roster of named AI teammates prospect, qualify, reconcile and
          follow up — automatically. Every send waits for your approval. The call is always yours.
        </p>

        <div className="mt-8 flex items-center justify-center gap-3">
          <Link
            data-hero="cta"
            href="/app"
            className="rounded-[4px] bg-ember px-5 py-2.5 text-[15px] font-medium text-bone ember-glow transition-transform hover:scale-[1.03]"
          >
            Launch the app
          </Link>
          <a
            data-hero="cta"
            href="#agents"
            className="rounded-[4px] border border-ash/15 px-5 py-2.5 text-[15px] font-medium text-ash transition-colors hover:border-ash/30 hover:text-bone"
          >
            Meet the roster
          </a>
        </div>

        {/* Floating product preview */}
        <div data-hero="preview" className="mx-auto mt-16 max-w-4xl">
          <ProductPreview />
        </div>
      </section>

      {/* Agents */}
      <section id="agents" className="mx-auto max-w-6xl px-6 py-24">
        <div className="reveal max-w-2xl">
          <p className="text-[13px] font-medium uppercase tracking-[0.13em] text-ember">The roster</p>
          <h2 className="mt-3 text-[clamp(2rem,4.5vw,3.25rem)] font-bold leading-[1] tracking-[-0.021em] text-bone">
            A team you manage, not a menu you click.
          </h2>
          <p className="mt-4 text-[15px] leading-[1.5] text-ash">
            Eight named agents, each owning one part of the deal lifecycle. Rename them like real
            teammates, pause any of them, and decide which can act on their own.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ROSTER.filter((a) => a.id !== "human").map((a) => (
            <div key={a.id} className="reveal rounded-xl border border-ash/12 bg-graphite p-5">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-bone">{a.name}</h3>
                <span className="rounded-md bg-ash/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ash">
                  {a.side === "rep" ? "For you" : "Ops"}
                </span>
              </div>
              <p className="mt-2 text-[13px] leading-[1.5] text-ash">{a.plainDescription}</p>
            </div>
          ))}
          <div className="reveal flex flex-col justify-between rounded-xl border border-ember/30 bg-ember-smoke/40 p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-bone">You</h3>
              <span className="rounded-md bg-ember/20 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ember">
                Human
              </span>
            </div>
            <p className="mt-2 text-[13px] leading-[1.5] text-ash">
              Have the actual conversation and close. This part stays human.
            </p>
          </div>
        </div>
      </section>

      {/* Connectors */}
      <section id="connect" className="border-y border-ash/10 bg-obsidian">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <div className="reveal max-w-2xl">
            <p className="text-[13px] font-medium uppercase tracking-[0.13em] text-ember">Connect your stack</p>
            <h2 className="mt-3 text-[clamp(2rem,4.5vw,3.25rem)] font-bold leading-[1] tracking-[-0.021em] text-bone">
              Already on HubSpot? Bring it all over.
            </h2>
            <p className="mt-4 text-[15px] leading-[1.5] text-ash">
              Sales OS owns its own system of record — connectors are how your tools plug in. Import
              your CRM, sync your inbox, and your agents pick it all up instantly.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {CONNECTORS.map((c) => (
              <div key={c.name} className="reveal rounded-xl border border-ash/12 bg-graphite p-5">
                <div className="flex items-center justify-between">
                  <span className="text-[15px] font-semibold text-bone">{c.name}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${c.live ? "bg-emerald-500/15 text-emerald-400" : "bg-ash/10 text-ash/60"}`}>
                    {c.live ? "Live" : "Soon"}
                  </span>
                </div>
                <p className="mt-2 text-[13px] leading-[1.5] text-ash">{c.note}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-6xl px-6 py-24">
        <div className="reveal max-w-2xl">
          <p className="text-[13px] font-medium uppercase tracking-[0.13em] text-ember">How it works</p>
          <h2 className="mt-3 text-[clamp(2rem,4.5vw,3.25rem)] font-bold leading-[1] tracking-[-0.021em] text-bone">
            Connect once. The team runs itself.
          </h2>
        </div>
        <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="reveal">
              <div className="text-[13px] font-semibold text-ember">{s.n}</div>
              <h3 className="mt-3 text-xl font-semibold text-bone">{s.title}</h3>
              <p className="mt-2 text-[14px] leading-[1.6] text-ash">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA band */}
      <section className="mx-auto max-w-6xl px-6 pb-28">
        <div className="reveal flex flex-col items-center rounded-2xl border border-ash/12 bg-graphite px-6 py-16 text-center">
          <h2 className="max-w-2xl text-[clamp(2rem,5vw,3.5rem)] font-bold leading-[0.95] tracking-[-0.021em] text-bone">
            Give your reps their time back.
          </h2>
          <p className="mt-4 max-w-md text-[15px] leading-[1.5] text-ash">
            Spin up the workspace, connect your tools, and watch the agents work — live.
          </p>
          <Link
            href="/app"
            className="mt-8 rounded-[4px] bg-ember px-6 py-3 text-[15px] font-medium text-bone ember-glow transition-transform hover:scale-[1.03]"
          >
            Launch the app
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-ash/10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-10 text-[13px] text-ash/60 sm:flex-row">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-ember" />
            <span>Sales OS — AI owns the system, the human owns the close.</span>
          </div>
          <div className="flex items-center gap-5">
            <Link href="/app" className="transition-colors hover:text-ash">Launch app</Link>
            <a href="#agents" className="transition-colors hover:text-ash">Agents</a>
            <a href="#connect" className="transition-colors hover:text-ash">Connect</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

/** A faux dark dashboard that floats on the canvas — evokes the product. */
function ProductPreview() {
  const agents = ["Dispatcher", "Scout", "Auditor", "Scribe", "Forecaster", "Coach"];
  return (
    <div className="overflow-hidden rounded-2xl border border-ash/12 bg-graphite text-left shadow-[0_24px_80px_-20px_rgba(0,0,0,0.8)]">
      {/* window bar */}
      <div className="flex items-center gap-1.5 border-b border-ash/10 px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-ash/20" />
        <span className="h-2.5 w-2.5 rounded-full bg-ash/20" />
        <span className="h-2.5 w-2.5 rounded-full bg-ash/20" />
        <span className="ml-3 text-[11px] text-ash/50">app.salesos — Dashboard</span>
      </div>
      <div className="flex">
        {/* mini sidebar */}
        <div className="hidden w-40 shrink-0 border-r border-ash/10 p-3 sm:block">
          <div className="mb-4 flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-ember" />
            <span className="text-[12px] font-medium text-bone">Sales OS</span>
          </div>
          {["Dashboard", "Contacts", "Deals", "Oversight", "Agents", "Connect"].map((l, i) => (
            <div key={l} className={`mb-1 rounded-md px-2 py-1.5 text-[12px] ${i === 0 ? "bg-ash/10 text-bone" : "text-ash/60"}`}>
              {l}
            </div>
          ))}
        </div>
        {/* content */}
        <div className="min-w-0 flex-1 p-5">
          <div className="text-[clamp(1.5rem,4vw,2.25rem)] font-bold leading-[0.95] tracking-[-0.021em] text-bone">
            Good day, Maya.
          </div>
          <div className="mt-1 text-[12px] text-ash/60">Here&apos;s your team and what they&apos;ve handled.</div>
          <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {agents.map((a, i) => (
              <div key={a} className="rounded-lg border border-ash/10 bg-obsidian p-3">
                <div className="text-[12px] font-semibold text-bone">{a}</div>
                <div className="mt-2 flex items-center gap-1.5">
                  <span className={`h-1.5 w-1.5 rounded-full ${i % 3 === 0 ? "bg-emerald-400" : i % 3 === 1 ? "bg-amber-400" : "bg-ash/30"}`} />
                  <span className="text-[10px] text-ash/60">
                    {i % 3 === 0 ? "done" : i % 3 === 1 ? "needs you" : "idle"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

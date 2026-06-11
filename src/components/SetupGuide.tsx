"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import type { SetupStatus } from "@/lib/onboarding/setup";

gsap.registerPlugin(useGSAP);

/**
 * The getting-started guide page (HubSpot-style): a progress header and an
 * expandable checklist. Completion is detected server-side from real workspace
 * state; "Mark as done" covers steps you did elsewhere, and the whole guide can
 * be dismissed once you're settled in.
 */
export function SetupGuide({ initial }: { initial: SetupStatus }) {
  const root = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [setup, setSetup] = useState(initial);
  const firstOpen = initial.steps.find((s) => !s.done)?.id ?? null;
  const [open, setOpen] = useState<string | null>(firstOpen);
  const [busy, setBusy] = useState(false);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const ease = "power3.out";
        gsap.fromTo(
          "[data-reveal]",
          { y: 14, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.5, ease, stagger: 0.05, clearProps: "opacity,transform" },
        );
        const bar = root.current?.querySelector<HTMLElement>("[data-progress]");
        if (bar) {
          gsap.fromTo(
            bar,
            { scaleX: 0, transformOrigin: "0 50%" },
            { scaleX: 1, duration: 0.9, ease: "power2.inOut", delay: 0.2, clearProps: "transform" },
          );
        }
      });
    },
    { scope: root },
  );

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch("/api/setup", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.setup) setSetup(json.setup as SetupStatus);
      router.refresh(); // nav badge + dashboard chip stay in sync
    } finally {
      setBusy(false);
    }
  }

  const allDone = setup.completed === setup.total;

  return (
    <div ref={root} className="max-w-2xl">
      {/* Header + progress */}
      <div data-reveal className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">
          {allDone ? "You're all set." : "Set up your Sales OS"}
        </h1>
        <p className="mt-1 text-[13px] text-ash/70">
          {allDone
            ? "Every step is done — your agent team is fully operational."
            : "A few steps and your agent team is working your real pipeline."}
        </p>
        <div className="mt-4 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-ash/10">
            <div
              data-progress
              className="h-full rounded-full bg-ember"
              style={{ width: `${Math.max(2, setup.percent)}%` }}
            />
          </div>
          <span className="shrink-0 text-[13px] font-medium text-ash">
            {setup.completed} of {setup.total}
          </span>
        </div>
      </div>

      {/* Steps */}
      <ol className="space-y-2">
        {setup.steps.map((s, i) => {
          const expanded = open === s.id;
          return (
            <li
              key={s.id}
              data-reveal
              className={`rounded-xl border transition-colors ${
                expanded ? "border-ember/40 bg-graphite" : "border-ash/12 bg-graphite"
              }`}
            >
              <button
                onClick={() => setOpen(expanded ? null : s.id)}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                    s.done ? "bg-ember text-bone" : "border border-ash/25 text-ash/60"
                  }`}
                >
                  {s.done ? <Check /> : i + 1}
                </span>
                <span className={`min-w-0 flex-1 text-sm font-semibold ${s.done ? "text-ash/50 line-through decoration-ash/30" : "text-bone"}`}>
                  {s.title}
                  {s.optional && !s.done && (
                    <span className="ml-2 rounded-full bg-ash/10 px-1.5 py-0.5 text-[10px] font-medium normal-case text-ash/60 no-underline">
                      optional
                    </span>
                  )}
                </span>
                <Chevron open={expanded} />
              </button>

              {expanded && (
                <div className="border-t border-ash/10 px-4 py-3.5 pl-[3.25rem]">
                  <p className="text-[13px] leading-[1.55] text-ash">{s.body}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {!s.done && (
                      <Link
                        href={s.href}
                        className="rounded-[4px] bg-ember px-3.5 py-1.5 text-[13px] font-medium text-bone ember-glow transition-transform hover:scale-[1.02]"
                      >
                        {s.cta}
                      </Link>
                    )}
                    {!s.done && (
                      <button
                        onClick={() => patch({ markDone: s.id })}
                        disabled={busy}
                        className="rounded-[4px] px-3 py-1.5 text-[13px] font-medium text-ash/70 transition-colors hover:text-bone disabled:opacity-50"
                      >
                        Mark as done
                      </button>
                    )}
                    {s.done && (
                      <>
                        <Link
                          href={s.href}
                          className="rounded-[4px] border border-ash/15 px-3.5 py-1.5 text-[13px] font-medium text-ash transition-colors hover:border-ember hover:text-bone"
                        >
                          {s.cta}
                        </Link>
                        <button
                          onClick={() => patch({ markUndone: s.id })}
                          disabled={busy}
                          className="rounded-[4px] px-3 py-1.5 text-[12px] text-ash/50 transition-colors hover:text-ash disabled:opacity-50"
                        >
                          Mark as not done
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {/* Dismiss / restore */}
      <div data-reveal className="mt-8 border-t border-ash/10 pt-5">
        {setup.dismissed ? (
          <button
            onClick={() => patch({ dismiss: false })}
            disabled={busy}
            className="text-[13px] text-ash/70 transition-colors hover:text-bone disabled:opacity-50"
          >
            Show the guide in navigation again
          </button>
        ) : (
          <button
            onClick={() => patch({ dismiss: true })}
            disabled={busy}
            className="text-[13px] text-ash/50 transition-colors hover:text-ash disabled:opacity-50"
          >
            {allDone ? "Hide the guide — I'm done" : "Dismiss the guide — I'll find my own way"}
          </button>
        )}
      </div>
    </div>
  );
}

function Check() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className={`shrink-0 text-ash/50 transition-transform ${open ? "rotate-180" : ""}`}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

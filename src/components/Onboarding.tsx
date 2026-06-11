"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

/**
 * First-run experience for an empty workspace. An agent-native CRM is only as
 * useful as the data it watches, so the empty state's whole job is to get the
 * first records in — import an existing CRM, connect an inbox, add a contact by
 * hand, or drop in the sample pack to watch the agents work immediately.
 */
export function Onboarding({ name }: { name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function loadSample() {
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/onboarding/sample", { method: "POST" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErr(j.error ?? "Couldn't load the sample workspace.");
      } else {
        router.refresh();
      }
    } catch {
      setErr("Couldn't reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section data-reveal="hero" className="mb-12">
      <div className="rounded-2xl border border-ash/12 bg-graphite p-6 sm:p-8">
        <h2 className="text-xl font-bold tracking-tight text-bone">
          Let&apos;s give your team something to work on.
        </h2>
        <p className="mt-1.5 max-w-xl text-[14px] leading-[1.5] text-ash">
          Your workspace is empty, {name.split(" ")[0]}. Bring in your pipeline and the
          agents start routing, briefing and reconciling it right away.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Card
            href="/connectors"
            icon={<IconImport />}
            title="Import your CRM"
            body="Already on HubSpot? Bring your contacts, companies, deals and history over in one click."
            cta="Connect HubSpot →"
            primary
          />
          <Card
            href="/connectors"
            icon={<IconInbox />}
            title="Connect your inbox"
            body="Sync Gmail or Outlook so real conversations land on each contact's timeline."
            cta="Connect inbox →"
          />
          <Card
            href="/contacts"
            icon={<IconPerson />}
            title="Add your first contact"
            body="Start by hand — create a contact and a deal, and Scout will brief you before the call."
            cta="Go to contacts →"
          />
          <button
            onClick={loadSample}
            disabled={busy}
            className="group flex flex-col rounded-xl border border-ember/30 bg-ember/[0.06] p-4 text-left transition-colors hover:border-ember disabled:opacity-60"
          >
            <span className="text-ember"><IconSparkle /></span>
            <span className="mt-2.5 text-sm font-semibold text-bone">
              Explore with sample data
            </span>
            <span className="mt-1 text-[13px] leading-[1.5] text-ash">
              Load a demo pipeline to watch the agents route, audit and forecast — clear it
              anytime.
            </span>
            <span className="mt-2 text-[12px] font-medium text-ember">
              {busy ? "Loading…" : "Load sample workspace →"}
            </span>
          </button>
        </div>

        {err && <p className="mt-3 text-[13px] text-rose-400">{err}</p>}

        <p className="mt-5 text-[13px] text-ash/60">
          Prefer a checklist?{" "}
          <Link href="/setup" className="font-medium text-ember transition-opacity hover:opacity-80">
            Open the setup guide →
          </Link>
        </p>
      </div>
    </section>
  );
}

/** Slim banner shown once sample data is loaded, so it's never mistaken for real data. */
export function SampleDataBanner() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function clear() {
    setBusy(true);
    try {
      await fetch("/api/onboarding/sample", { method: "DELETE" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      data-reveal="hero"
      className="mb-6 flex items-center gap-3 rounded-lg border border-ember/25 bg-ember/[0.06] px-4 py-2.5 text-[13px]"
    >
      <span className="inline-flex items-center gap-1.5 font-medium text-ember">
        <IconSparkle small />
        Exploring with sample data
      </span>
      <span className="min-w-0 text-ash/70">— a demo pipeline so you can see the agents work.</span>
      <button
        onClick={clear}
        disabled={busy}
        className="ml-auto shrink-0 rounded-[4px] border border-ash/20 px-2.5 py-1 text-[12px] font-medium text-ash transition-colors hover:border-ember hover:text-bone disabled:opacity-50"
      >
        {busy ? "Clearing…" : "Clear sample data"}
      </button>
    </div>
  );
}

function Card({
  href,
  icon,
  title,
  body,
  cta,
  primary,
}: {
  href: string;
  icon: ReactNode;
  title: string;
  body: string;
  cta: string;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group flex flex-col rounded-xl border p-4 transition-colors ${
        primary ? "border-ash/15 bg-obsidian hover:border-ember" : "border-ash/12 bg-obsidian hover:border-ash/30"
      }`}
    >
      <span className={primary ? "text-ember" : "text-ash/70"}>{icon}</span>
      <span className="mt-2.5 text-sm font-semibold text-bone">{title}</span>
      <span className="mt-1 text-[13px] leading-[1.5] text-ash">{body}</span>
      <span className={`mt-2 text-[12px] font-medium ${primary ? "text-ember" : "text-ash/70 group-hover:text-ash"}`}>
        {cta}
      </span>
    </Link>
  );
}

/* — icons (18px) — */
function svg(path: ReactNode) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {path}
    </svg>
  );
}
function IconImport() { return svg(<><path d="M12 3v12" /><path d="m8 11 4 4 4-4" /><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></>); }
function IconInbox() { return svg(<><path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5.5 5h13l3.5 7v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6Z" /></>); }
function IconPerson() { return svg(<><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>); }
function IconSparkle({ small }: { small?: boolean }) {
  const s = small ? 14 : 18;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" />
    </svg>
  );
}

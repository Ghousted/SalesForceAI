"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type NavKey = "dashboard" | "contacts" | "companies" | "deals" | "reports" | "oversight" | "agents" | "connectors" | "settings" | "setup";

const NAV: { key: NavKey; href: string; label: string }[] = [
  { key: "dashboard", href: "/app", label: "Dashboard" },
  { key: "contacts", href: "/contacts", label: "Contacts" },
  { key: "companies", href: "/companies", label: "Companies" },
  { key: "deals", href: "/deals", label: "Deals" },
  { key: "reports", href: "/reports", label: "Reports" },
  { key: "oversight", href: "/oversight", label: "Oversight" },
  { key: "agents", href: "/agents", label: "Agents" },
  { key: "connectors", href: "/connectors", label: "Connections" },
];

/** Hamburger + slide-out nav drawer for small screens (sidebar is md+ only). */
export function MobileNav({ active, name, email, initials, showSetup }: { active: NavKey; name: string; email: string; initials: string; showSetup?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="md:hidden">
      <button onClick={() => setOpen(true)} aria-label="Menu" className="flex h-8 w-8 items-center justify-center rounded-lg text-ash hover:text-bone">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
      </button>

      {open && (
        <div className="fixed inset-0 z-[120] bg-black/50" onClick={() => setOpen(false)}>
          <aside className="flex h-full w-64 max-w-[80vw] flex-col border-r border-ash/10 bg-obsidian px-3 py-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-8 flex items-center justify-between px-2">
              <Link href="/app" onClick={() => setOpen(false)} className="flex items-center gap-2.5">
                <span className="h-3.5 w-3.5 rounded-full bg-ember ember-glow" />
                <span className="text-[15px] font-medium tracking-tight text-bone">Sales OS</span>
              </Link>
              <button onClick={() => setOpen(false)} className="text-ash/60 hover:text-bone">✕</button>
            </div>

            <nav className="flex flex-1 flex-col gap-0.5">
              {showSetup && (
                <Link
                  href="/setup"
                  onClick={() => setOpen(false)}
                  className={`mb-2 rounded-lg border px-2.5 py-2 text-sm font-medium transition-colors ${active === "setup" ? "border-ember/40 bg-ember/10 text-bone" : "border-ember/25 bg-ember/[0.06] text-ash"}`}
                >
                  Setup guide
                </Link>
              )}
              {NAV.map((item) => (
                <Link
                  key={item.key}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={`rounded-lg px-2.5 py-2 text-sm font-medium transition-colors ${item.key === active ? "bg-ash/10 text-bone" : "text-ash hover:bg-ash/5 hover:text-bone"}`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="mt-4 border-t border-ash/10 pt-4">
              <div className="flex items-center gap-2.5 px-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-ember/15 text-[11px] font-semibold text-ember">{initials}</div>
                <div className="min-w-0">
                  <div className="truncate text-[12px] font-medium text-bone">{name}</div>
                  <div className="truncate text-[11px] text-ash/60">{email}</div>
                </div>
              </div>
              <button onClick={logout} className="mt-3 block px-2 text-[12px] text-rose-400">Sign out</button>
              <Link href="/" onClick={() => setOpen(false)} className="mt-2 block px-2 text-[11px] text-ash/60 hover:text-ash">← Back to site</Link>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

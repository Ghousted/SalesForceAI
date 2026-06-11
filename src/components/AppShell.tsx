import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getCurrentUser } from "@/lib/auth/session";
import { runInWorkspace } from "@/lib/tenant";
import { getSetupStatus } from "@/lib/onboarding/setup";
import { CommandPalette } from "./CommandPalette";
import { UserMenu } from "./UserMenu";
import { ToasterProvider } from "./Toaster";
import { MobileNav } from "./MobileNav";
import { MainReveal } from "./MainReveal";

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "U";
}

/**
 * The CRM application shell — a persistent left sidebar + a thin top bar, the
 * frame every product screen lives in. Cron-dark: obsidian rail, ash strokes,
 * a single ember active indicator. Page content is passed as children.
 */

type NavKey = "dashboard" | "contacts" | "companies" | "deals" | "reports" | "oversight" | "agents" | "connectors" | "settings" | "setup";

const NAV: { key: NavKey; href: string; label: string; icon: ReactNode }[] = [
  { key: "dashboard", href: "/app", label: "Dashboard", icon: <IconGrid /> },
  { key: "contacts", href: "/contacts", label: "Contacts", icon: <IconUsers /> },
  { key: "companies", href: "/companies", label: "Companies", icon: <IconBuilding /> },
  { key: "deals", href: "/deals", label: "Deals", icon: <IconBriefcase /> },
  { key: "reports", href: "/reports", label: "Reports", icon: <IconChart /> },
  { key: "oversight", href: "/oversight", label: "Oversight", icon: <IconActivity /> },
  { key: "agents", href: "/agents", label: "Agents", icon: <IconCpu /> },
  { key: "connectors", href: "/connectors", label: "Connections", icon: <IconPlug /> },
];

export async function AppShell({
  active,
  title,
  children,
}: {
  active: NavKey;
  title?: string;
  children: ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  // A user who hasn't been through the welcome flow resumes it on their next
  // visit to the dashboard (skip inside the flow marks it done).
  if (!user.welcomeDone && active === "dashboard") redirect("/welcome");
  const initials = initialsOf(user.name);

  // Getting-started guide: pinned to the top of nav until complete or dismissed.
  const setup = await runInWorkspace(user.workspaceId, () => getSetupStatus()).catch(() => null);
  const showSetup = Boolean(setup?.show) || active === "setup";
  const setupRemaining = setup ? setup.total - setup.completed : 0;

  return (
    <ToasterProvider>
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-ash/10 bg-obsidian px-3 py-5 md:flex">
        <Link href="/app" className="mb-8 flex items-center gap-2.5 px-2">
          <span className="h-3.5 w-3.5 rounded-full bg-ember ember-glow" />
          <span className="text-[15px] font-medium tracking-tight text-bone">Sales OS</span>
        </Link>

        <nav className="flex flex-1 flex-col gap-0.5">
          {showSetup && (
            <Link
              href="/setup"
              className={`group mb-2 flex items-center gap-3 rounded-lg border px-2.5 py-2 text-[13px] font-medium transition-colors ${
                active === "setup"
                  ? "border-ember/40 bg-ember/10 text-bone"
                  : "border-ember/25 bg-ember/[0.06] text-ash hover:border-ember/40 hover:text-bone"
              }`}
            >
              <span className="text-ember"><IconCompass /></span>
              Setup guide
              {setupRemaining > 0 && (
                <span className="ml-auto rounded-full bg-ember/20 px-1.5 py-0.5 text-[10px] font-bold text-ember">
                  {setupRemaining}
                </span>
              )}
            </Link>
          )}
          {NAV.map((item) => {
            const on = item.key === active;
            return (
              <Link
                key={item.key}
                href={item.href}
                className={`group flex items-center gap-3 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors ${
                  on ? "bg-ash/10 text-bone" : "text-ash hover:bg-ash/5 hover:text-bone"
                }`}
              >
                <span className={on ? "text-ember" : "text-ash/70 group-hover:text-ash"}>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-4 border-t border-ash/10 pt-4">
          <Link href="/settings" className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-ash/5">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-ember/15 text-[11px] font-semibold text-ember">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="truncate text-[12px] font-medium text-bone">{user.name}</div>
              <div className="truncate text-[11px] text-ash/60">{user.email}</div>
            </div>
          </Link>
          <Link href="/" className="mt-3 block px-2 text-[11px] text-ash/60 transition-colors hover:text-ash">
            ← Back to site
          </Link>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b border-ash/10 bg-obsidian/80 px-6 backdrop-blur">
          <MobileNav active={active} name={user.name} email={user.email} initials={initials} showSetup={showSetup} />
          <div className="hidden flex-1 sm:block">
            <CommandPalette />
          </div>
          {title && <span className="text-[13px] font-medium text-ash sm:hidden">{title}</span>}
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden items-center gap-1.5 rounded-full border border-ash/10 px-2.5 py-1 text-[11px] text-ash sm:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Agents live
            </span>
            <UserMenu name={user.name} email={user.email} initials={initials} />
          </div>
        </header>

        <main className="flex-1 px-6 py-7">
          <div className="mx-auto max-w-5xl">
            <MainReveal>{children}</MainReveal>
          </div>
        </main>
      </div>
    </div>
    </ToasterProvider>
  );
}

/* — minimal ash-stroke icon set (16px) — */
function svg(path: ReactNode) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {path}
    </svg>
  );
}
function IconGrid() { return svg(<><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>); }
function IconUsers() { return svg(<><circle cx="9" cy="8" r="3" /><path d="M2 20a7 7 0 0 1 14 0" /><path d="M16 5a3 3 0 0 1 0 6" /><path d="M22 20a6 6 0 0 0-4-5.6" /></>); }
function IconBuilding() { return svg(<><rect x="4" y="3" width="16" height="18" rx="1" /><path d="M9 7h.01M15 7h.01M9 11h.01M15 11h.01M9 15h.01M15 15h.01M10 21v-3h4v3" /></>); }
function IconBriefcase() { return svg(<><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="M3 13h18" /></>); }
function IconActivity() { return svg(<path d="M3 12h4l3 8 4-16 3 8h4" />); }
function IconChart() { return svg(<><path d="M3 3v18h18" /><rect x="7" y="12" width="3" height="6" rx="0.5" /><rect x="12" y="8" width="3" height="10" rx="0.5" /><rect x="17" y="5" width="3" height="13" rx="0.5" /></>); }
function IconCpu() { return svg(<><rect x="6" y="6" width="12" height="12" rx="2" /><path d="M9 1v3M15 1v3M9 20v3M15 20v3M1 9h3M1 15h3M20 9h3M20 15h3" /></>); }
function IconPlug() { return svg(<><path d="M9 2v6M15 2v6" /><path d="M7 8h10v3a5 5 0 0 1-10 0V8Z" /><path d="M12 16v6" /></>); }
function IconCompass() { return svg(<><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" /></>); }

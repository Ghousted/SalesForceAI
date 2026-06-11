"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface Item {
  type: "contact" | "deal" | "company" | "page";
  label: string;
  sub?: string;
  href: string;
}

const PAGES: Item[] = [
  { type: "page", label: "Dashboard", sub: "Your team & pipeline", href: "/app" },
  { type: "page", label: "Contacts", sub: "People", href: "/contacts" },
  { type: "page", label: "Deals", sub: "Pipeline board", href: "/deals" },
  { type: "page", label: "Oversight", sub: "What agents are doing", href: "/oversight" },
  { type: "page", label: "Agents", sub: "Manage the roster", href: "/agents" },
  { type: "page", label: "Connections", sub: "Connect your tools", href: "/connectors" },
];

const TYPE_TAG: Record<Item["type"], string> = { contact: "Contact", deal: "Deal", company: "Company", page: "Go to" };

/** ⌘K command palette — a trigger styled like a search field + the modal. */
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Item[]>([]);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Global ⌘K / Ctrl+K to open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Focus + reset when opened.
  useEffect(() => {
    if (open) {
      setQ("");
      setResults([]);
      setActive(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Debounced search.
  useEffect(() => {
    if (!q.trim()) {
      setResults([]);
      setActive(0);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { cache: "no-store" });
        const json = await res.json();
        setResults(json.results ?? []);
        setActive(0);
      } catch {
        setResults([]);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  const items = q.trim() ? results : PAGES;

  const go = useCallback(
    (item: Item) => {
      setOpen(false);
      router.push(item.href);
    },
    [router],
  );

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (items[active]) go(items[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <>
      {/* Trigger — looks like a search field */}
      <button
        onClick={() => setOpen(true)}
        className="flex w-full max-w-md items-center gap-2.5 rounded-full border border-ash/10 bg-graphite py-1.5 pl-3 pr-2 text-[13px] text-ash/50 transition-colors hover:border-ash/20"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
        </svg>
        <span className="flex-1 text-left">Search contacts, deals…</span>
        <kbd className="rounded border border-ash/15 px-1.5 py-0.5 text-[10px] text-ash/50">⌘K</kbd>
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/50 px-4 pt-[12vh]" onClick={() => setOpen(false)}>
          <div
            className="w-full max-w-lg overflow-hidden rounded-xl border border-ash/15 bg-graphite shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-ash/10 px-4">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="text-ash/40">
                <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
              </svg>
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Search contacts and deals…"
                className="flex-1 bg-transparent py-3.5 text-sm text-bone outline-none placeholder:text-ash/40"
              />
              <kbd className="rounded border border-ash/15 px-1.5 py-0.5 text-[10px] text-ash/50">esc</kbd>
            </div>

            <div className="max-h-80 overflow-y-auto p-2">
              {!q.trim() && (
                <div className="px-2 pb-1 pt-1 text-[10px] font-medium uppercase tracking-wide text-ash/40">Jump to</div>
              )}
              {items.length === 0 ? (
                <div className="px-3 py-8 text-center text-sm text-ash/50">No matches for “{q}”.</div>
              ) : (
                items.map((item, i) => (
                  <button
                    key={item.href}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(item)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${i === active ? "bg-ash/10" : ""}`}
                  >
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${item.type === "deal" ? "bg-ember" : item.type === "contact" ? "bg-emerald-400" : item.type === "company" ? "bg-amber-400" : "bg-ash/40"}`} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-bone">{item.label}</span>
                      {item.sub && <span className="block truncate text-[12px] text-ash/60">{item.sub}</span>}
                    </span>
                    <span className="shrink-0 text-[10px] uppercase tracking-wide text-ash/40">{TYPE_TAG[item.type]}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

/** Topbar avatar → dropdown with profile + sign out. */
export function UserMenu({ name, email, initials }: { name: string; email: string; initials: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex h-7 w-7 items-center justify-center rounded-full bg-ember/15 text-[11px] font-semibold text-ember"
      >
        {initials}
      </button>
      {open && (
        <div className="absolute right-0 top-9 z-50 w-52 overflow-hidden rounded-xl border border-ash/15 bg-graphite shadow-2xl">
          <div className="border-b border-ash/10 px-3 py-2.5">
            <div className="truncate text-[13px] font-medium text-bone">{name}</div>
            <div className="truncate text-[11px] text-ash/60">{email}</div>
          </div>
          <Link href="/settings" onClick={() => setOpen(false)} className="block px-3 py-2 text-[13px] text-ash transition-colors hover:bg-ash/5 hover:text-bone">
            Settings
          </Link>
          <button onClick={logout} className="block w-full px-3 py-2 text-left text-[13px] text-rose-400 transition-colors hover:bg-ash/5">
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

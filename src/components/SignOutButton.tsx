"use client";

import { useRouter } from "next/navigation";

export function SignOutButton() {
  const router = useRouter();
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }
  return (
    <button
      onClick={logout}
      className="rounded-[4px] border border-rose-500/30 px-4 py-2 text-[13px] font-medium text-rose-400 transition-colors hover:bg-rose-500/10"
    >
      Sign out
    </button>
  );
}

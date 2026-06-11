"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export interface InviteInfo {
  token: string;
  workspaceName: string;
  role: "rep" | "manager";
  email: string | null;
}

/** Login / signup card. Posts to the auth API, then routes into the app. */
export function AuthForm({
  mode,
  invite,
  inviteError,
}: {
  mode: "login" | "signup";
  invite?: InviteInfo | null;
  inviteError?: string | null;
}) {
  const router = useRouter();
  const isSignup = mode === "signup";
  const [name, setName] = useState("");
  const [email, setEmail] = useState(invite?.email ?? "");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState(inviteError ?? "");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isSignup ? { name, email, password, invite: invite?.token } : { email, password },
        ),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(json.error ?? "Something went wrong.");
        setBusy(false);
        return;
      }
      if (isSignup) {
        // New accounts get the immersive welcome before the dashboard.
        router.push("/welcome");
      } else {
        const next = new URLSearchParams(window.location.search).get("next");
        router.push(next && next.startsWith("/") ? next : "/app");
      }
      router.refresh();
    } catch {
      setErr("Couldn't reach the server.");
      setBusy(false);
    }
  }

  const input = "w-full rounded-lg border border-ash/15 bg-graphite px-3 py-2.5 text-sm text-bone outline-none focus:border-ember placeholder:text-ash/40";

  return (
    <div className="flex min-h-screen items-center justify-center bg-obsidian px-5">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2.5">
          <span className="h-3.5 w-3.5 rounded-full bg-ember ember-glow" />
          <span className="text-[15px] font-medium tracking-tight text-bone">Sales OS</span>
        </Link>

        <h1 className="text-center text-2xl font-bold tracking-tight text-bone">
          {invite ? `Join ${invite.workspaceName}` : isSignup ? "Create your workspace" : "Welcome back"}
        </h1>
        <p className="mt-1.5 text-center text-[13px] text-ash">
          {invite
            ? `You've been invited as a ${invite.role}. Create your account to join the team.`
            : isSignup
              ? "Spin up your agent-native CRM in seconds."
              : "Sign in to your Sales OS."}
        </p>

        <form onSubmit={submit} className="mt-7 space-y-3">
          {isSignup && (
            <input className={input} placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          )}
          <input className={input} type="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          <input className={input} type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={isSignup ? "new-password" : "current-password"} />

          {err && <p className="text-[13px] text-rose-400">{err}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-[4px] bg-ember px-4 py-2.5 text-sm font-medium text-bone ember-glow transition-transform hover:scale-[1.01] disabled:opacity-50"
          >
            {busy ? "…" : isSignup ? "Create account" : "Sign in"}
          </button>
        </form>

        <p className="mt-5 text-center text-[13px] text-ash/60">
          {isSignup ? (
            <>Already have an account? <Link href="/login" className="text-ember hover:opacity-80">Sign in</Link></>
          ) : (
            <>New here? <Link href="/signup" className="text-ember hover:opacity-80">Create an account</Link></>
          )}
        </p>
      </div>
    </div>
  );
}

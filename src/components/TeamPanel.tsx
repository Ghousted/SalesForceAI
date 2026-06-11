"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Team management on the settings page: who's in the workspace, plus (for
 * managers) minting and revoking invite links. The invite token only ever
 * appears here, right after minting — copy it or lose it.
 */

interface Member {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface OpenInvite {
  id: string;
  email: string | null;
  role: string;
  expiresAt: string;
}

export function TeamPanel({ isManager }: { isManager: boolean }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<OpenInvite[]>([]);
  const [role, setRole] = useState<"rep" | "manager">("rep");
  const [email, setEmail] = useState("");
  const [freshLink, setFreshLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/team");
      const data = await res.json();
      setMembers(data.members ?? []);
      setInvites(data.invites ?? []);
    } catch {
      /* keep current */
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function mint() {
    setBusy(true);
    setErr("");
    setFreshLink(null);
    setCopied(false);
    try {
      const res = await fetch("/api/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, email: email || undefined }),
      });
      const data = await res.json();
      if (!res.ok) setErr(data.error ?? "Couldn't create the invite.");
      else {
        setFreshLink(`${window.location.origin}${data.invite.path}`);
        setEmail("");
        await refresh();
      }
    } catch {
      setErr("Couldn't reach the server.");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    await fetch("/api/team", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await refresh();
  }

  async function copy() {
    if (!freshLink) return;
    try {
      await navigator.clipboard.writeText(freshLink);
      setCopied(true);
    } catch {
      /* user can select manually */
    }
  }

  const input =
    "rounded-lg border border-ash/15 bg-obsidian px-3 py-2 text-[13px] text-bone outline-none focus:border-ember placeholder:text-ash/40";

  return (
    <section className="mb-6 rounded-xl border border-ash/12 bg-graphite p-5">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ash/70">Team</h2>

      <ul className="divide-y divide-ash/10">
        {members.map((m) => (
          <li key={m.id} className="flex items-center gap-3 py-2.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ember/15 text-[11px] font-semibold text-ember">
              {m.name
                .trim()
                .split(/\s+/)
                .slice(0, 2)
                .map((p) => p[0])
                .join("")
                .toUpperCase()}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-medium text-bone">{m.name}</span>
              <span className="block truncate text-[12px] text-ash/60">{m.email}</span>
            </span>
            <span className="ml-auto rounded-full bg-ash/10 px-2 py-0.5 text-[11px] text-ash">
              {m.role === "manager" ? "Manager" : "Rep"}
            </span>
          </li>
        ))}
      </ul>

      {isManager && (
        <div className="mt-4 border-t border-ash/10 pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <input
              className={`${input} min-w-0 flex-1`}
              type="email"
              placeholder="teammate@company.com (optional)"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as "rep" | "manager")}
              className={input}
            >
              <option value="rep">Rep</option>
              <option value="manager">Manager</option>
            </select>
            <button
              onClick={mint}
              disabled={busy}
              className="rounded-[4px] bg-ember px-3.5 py-2 text-[13px] font-medium text-bone ember-glow transition-transform hover:scale-[1.02] disabled:opacity-50"
            >
              {busy ? "…" : "Create invite link"}
            </button>
          </div>
          {err && <p className="mt-2 text-[12px] text-rose-400">{err}</p>}

          {freshLink && (
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-ember/30 bg-ember/[0.06] p-3">
              <code className="min-w-0 flex-1 truncate text-[12px] text-ash">{freshLink}</code>
              <button
                onClick={copy}
                className="shrink-0 rounded-[4px] border border-ash/20 px-2.5 py-1 text-[12px] text-ash transition-colors hover:border-ember hover:text-bone"
              >
                {copied ? "Copied ✓" : "Copy"}
              </button>
            </div>
          )}

          {invites.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {invites.map((i) => (
                <li key={i.id} className="flex items-center gap-2 text-[12px] text-ash/70">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                  <span className="min-w-0 truncate">
                    Open invite · {i.email ?? "anyone with the link"} · {i.role}
                  </span>
                  <button
                    onClick={() => revoke(i.id)}
                    className="ml-auto shrink-0 text-[12px] text-ash/50 transition-colors hover:text-rose-400"
                  >
                    Revoke
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

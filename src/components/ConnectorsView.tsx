"use client";

import { useCallback, useEffect, useState } from "react";

interface ConnectorView {
  kind: string;
  name: string;
  category: "crm" | "email" | "calendar";
  blurb: string;
  auth: "token" | "oauth";
  implemented: boolean;
  connected: boolean;
  lastSyncAt?: string;
  lastResult?: string;
  error?: string;
  status: "connected" | "disconnected" | "needs-setup";
  configured: boolean;
  connectUrl?: string;
  accountEmail?: string;
}

function timeAgo(iso?: string): string {
  if (!iso) return "";
  const s = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

const CATEGORY_LABEL = { crm: "CRM", email: "Email", calendar: "Calendar" } as const;

const PRETTY_NAME: Record<string, string> = {
  hubspot: "HubSpot",
  gmail: "Gmail",
  outlook: "Outlook",
  "google-calendar": "Google Calendar",
};
function prettyName(kind: string): string {
  return PRETTY_NAME[kind] ?? kind;
}

export function ConnectorsView() {
  const [conns, setConns] = useState<ConnectorView[] | null>(null);
  const [token, setToken] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/connectors", { cache: "no-store" });
    const json = await res.json();
    setConns(json.connectors);
  }, []);

  useEffect(() => {
    void load();
    // Surface the result of an OAuth round-trip (?connected= / ?error=).
    const p = new URLSearchParams(window.location.search);
    if (p.get("connected")) setBanner({ kind: "ok", text: `${prettyName(p.get("connected")!)} connected — first sync done.` });
    else if (p.get("error")) setBanner({ kind: "err", text: decodeURIComponent(p.get("error")!) });
    if (p.get("connected") || p.get("error")) {
      window.history.replaceState({}, "", "/connectors");
    }
  }, [load]);

  async function act(kind: string, init: RequestInit) {
    setBusy(kind);
    setErr((e) => ({ ...e, [kind]: "" }));
    try {
      const res = await fetch(`/api/connectors/${kind}`, {
        headers: { "Content-Type": "application/json" },
        ...init,
      });
      const json = await res.json();
      if (!res.ok) {
        setErr((e) => ({ ...e, [kind]: json.error ?? "Something went wrong." }));
      } else {
        setConns((cs) => cs?.map((c) => (c.kind === kind ? json.connector : c)) ?? cs);
        setToken((t) => ({ ...t, [kind]: "" }));
      }
    } finally {
      setBusy(null);
    }
  }

  const connect = (kind: string) =>
    act(kind, { method: "POST", body: JSON.stringify({ token: token[kind] }) });
  const sync = (kind: string) =>
    act(kind, { method: "POST", body: JSON.stringify({ action: "sync" }) });
  const disconnect = (kind: string) => act(kind, { method: "DELETE" });

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight">Connections</h1>
        <p className="mt-1 text-sm text-ash">
          Plug your own tools into Sales OS. Already on HubSpot? Bring your whole CRM over — your agents pick it up instantly.
        </p>
      </div>

      {banner && (
        <div
          className={`mb-4 rounded-lg px-3 py-2 text-sm ${
            banner.kind === "ok" ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
          }`}
        >
          {banner.text}
        </div>
      )}

      <div className="space-y-3">
        {conns?.map((c) => (
          <div key={c.kind} className="rounded-xl border border-ash/15 bg-graphite p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-bone">{c.name}</span>
                  <span className="rounded-full bg-ash/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ash">
                    {CATEGORY_LABEL[c.category]}
                  </span>
                  <StatusBadge status={c.status} />
                </div>
                <p className="mt-1 text-xs text-ash">{c.blurb}</p>
                {c.connected && c.accountEmail && (
                  <p className="mt-1.5 text-xs text-ash">Connected as {c.accountEmail}</p>
                )}
                {c.connected && c.lastResult && (
                  <p className="mt-2 text-xs text-ash">
                    {c.lastResult}{" "}
                    <span className="text-ash/70">· synced {timeAgo(c.lastSyncAt)}</span>
                  </p>
                )}
                {(err[c.kind] || c.error) && (
                  <p className="mt-2 text-xs text-rose-400">{err[c.kind] || c.error}</p>
                )}
              </div>
            </div>

            {/* Controls */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {c.status === "needs-setup" && (
                <span className="text-xs text-ash/70">
                  {c.implemented
                    ? "Add this connector's sign-in credentials to enable it (see setup notes)."
                    : "Coming soon."}
                </span>
              )}

              {c.status === "disconnected" && c.auth === "token" && (
                <>
                  <input
                    type="password"
                    placeholder="Paste HubSpot Private App token"
                    value={token[c.kind] ?? ""}
                    onChange={(e) => setToken((t) => ({ ...t, [c.kind]: e.target.value }))}
                    className="w-72 rounded-lg border border-ash/15 px-2.5 py-1.5 text-xs outline-none focus:border-ember"
                  />
                  <button
                    onClick={() => connect(c.kind)}
                    disabled={busy === c.kind || !(token[c.kind] ?? "").trim()}
                    className="rounded-lg bg-ember px-3 py-1.5 text-xs font-medium text-bone disabled:opacity-40"
                  >
                    {busy === c.kind ? "Importing…" : "Connect & import"}
                  </button>
                </>
              )}

              {c.status === "disconnected" && c.auth === "oauth" && c.connectUrl && (
                <a
                  href={c.connectUrl}
                  className="rounded-lg bg-ember px-3 py-1.5 text-xs font-medium text-bone"
                >
                  Connect {c.name}
                </a>
              )}

              {c.connected && (
                <>
                  <button
                    onClick={() => sync(c.kind)}
                    disabled={busy === c.kind}
                    className="rounded-lg border border-ash/15 px-3 py-1.5 text-xs font-medium text-ash hover:bg-obsidian disabled:opacity-40"
                  >
                    {busy === c.kind ? "Syncing…" : "Sync now"}
                  </button>
                  <button
                    onClick={() => disconnect(c.kind)}
                    disabled={busy === c.kind}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-rose-400 hover:bg-rose-500/10 disabled:opacity-40"
                  >
                    Disconnect
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
        {!conns && <p className="text-sm text-ash/70">Loading…</p>}
      </div>

      <p className="mt-4 text-xs text-ash/70">
        Your token is stored server-side and used only to import your data. Importing never deletes records you created here.
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status: ConnectorView["status"] }) {
  const map = {
    connected: { text: "Connected", cls: "bg-emerald-500/15 text-emerald-400" },
    disconnected: { text: "Not connected", cls: "bg-ash/10 text-ash" },
    "needs-setup": { text: "Coming soon", cls: "bg-amber-500/15 text-amber-400" },
  } as const;
  const s = map[status];
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${s.cls}`}>{s.text}</span>;
}

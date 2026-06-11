"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Company } from "@/lib/data/types";
import { useToast } from "./Toaster";

type Row = Company & { contactCount: number; dealCount: number };

const inputCls = "w-full rounded-lg border border-ash/15 bg-graphite px-3 py-2 text-sm text-bone outline-none focus:border-ember";

export function CompaniesView({ companies }: { companies: Row[] }) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState<Partial<Company> | null>(null);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");

  const ql = q.trim().toLowerCase();
  const shown = ql
    ? companies.filter((c) => `${c.name} ${c.industry} ${c.location}`.toLowerCase().includes(ql))
    : companies;

  async function save() {
    if (!editing?.name) return;
    setBusy(true);
    try {
      const res = await fetch("/api/crm/companies", {
        method: editing.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing),
      });
      if (res.ok) {
        toast(editing.id ? "Company updated" : "Company created");
        setEditing(null);
        router.refresh();
      } else toast("Couldn't save the company", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Companies</h1>
        <div className="flex items-center gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter…" className="w-44 rounded-full border border-ash/10 bg-graphite px-3.5 py-1.5 text-[13px] text-bone outline-none placeholder:text-ash/40 focus:border-ember/50" />
          <button onClick={() => setEditing({ name: "" })} className="rounded-[4px] bg-ember px-3.5 py-1.5 text-[13px] font-medium text-bone ember-glow transition-transform hover:scale-[1.03]">+ New company</button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-ash/15 bg-graphite">
        <table className="w-full text-sm">
          <thead className="bg-obsidian text-left text-xs uppercase tracking-wide text-ash/70">
            <tr>
              <th className="px-4 py-2 font-semibold">Company</th>
              <th className="px-4 py-2 font-semibold">Industry</th>
              <th className="px-4 py-2 font-semibold">Location</th>
              <th className="px-4 py-2 font-semibold">Contacts</th>
              <th className="px-4 py-2 font-semibold">Deals</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ash/10">
            {shown.map((c) => (
              <tr key={c.id} onClick={() => router.push(`/companies/${c.id}`)} className="cursor-pointer hover:bg-obsidian">
                <td className="px-4 py-2 font-medium text-bone">{c.name}</td>
                <td className="px-4 py-2 text-ash">{c.industry}</td>
                <td className="px-4 py-2 text-ash">{c.location}</td>
                <td className="px-4 py-2 text-ash">{c.contactCount}</td>
                <td className="px-4 py-2 text-ash">{c.dealCount}</td>
              </tr>
            ))}
            {shown.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-ash/70">{companies.length === 0 ? "No companies yet — add one." : "No companies match your filter."}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={() => setEditing(null)}>
          <div className="h-full w-full max-w-md overflow-y-auto border-l border-ash/10 bg-graphite p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-4 text-lg font-semibold text-bone">{editing.id ? "Edit company" : "New company"}</h3>
            <div className="space-y-3">
              <Field label="Name"><input className={inputCls} value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field>
              <Field label="Industry"><input className={inputCls} value={editing.industry ?? ""} onChange={(e) => setEditing({ ...editing, industry: e.target.value })} /></Field>
              <Field label="Location"><input className={inputCls} value={editing.location ?? ""} onChange={(e) => setEditing({ ...editing, location: e.target.value })} /></Field>
              <Field label="Notes"><textarea rows={3} className={inputCls} value={editing.notes ?? ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} /></Field>
            </div>
            <div className="mt-5 flex gap-2">
              <button onClick={save} disabled={busy} className="rounded-[4px] bg-ember px-4 py-2 text-sm font-medium text-bone ember-glow disabled:opacity-40">{busy ? "Saving…" : "Save"}</button>
              <button onClick={() => setEditing(null)} className="rounded-[4px] border border-ash/15 px-4 py-2 text-sm text-ash hover:bg-obsidian">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-ash">{label}</span>
      {children}
    </label>
  );
}

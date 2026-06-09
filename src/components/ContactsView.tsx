"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Contact, Company, Rep } from "@/lib/data/types";

const blank: Partial<Contact> = {
  firstName: "", lastName: "", title: "", companyId: "",
  email: "", phone: "", persona: "", ownerRepId: "",
};

export function ContactsView({
  contacts,
  companies,
  reps,
}: {
  contacts: Contact[];
  companies: Company[];
  reps: Rep[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<Partial<Contact> | null>(null);
  const [busy, setBusy] = useState(false);

  const companyName = (id: string) => companies.find((c) => c.id === id)?.name ?? "—";
  const repName = (id: string) => reps.find((r) => r.id === id)?.name ?? "Unassigned";

  async function save() {
    if (!editing?.firstName || !editing?.lastName) return;
    setBusy(true);
    try {
      const isEdit = Boolean(editing.id);
      await fetch("/api/crm/contacts", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing),
      });
      setEditing(null);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Contacts</h1>
        <button
          onClick={() => setEditing({ ...blank })}
          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
        >
          + New contact
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-2 font-semibold">Name</th>
              <th className="px-4 py-2 font-semibold">Title</th>
              <th className="px-4 py-2 font-semibold">Company</th>
              <th className="px-4 py-2 font-semibold">Owner</th>
              <th className="px-4 py-2 font-semibold">Email</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {contacts.map((c) => (
              <tr
                key={c.id}
                onClick={() => setEditing({ ...c })}
                className="cursor-pointer hover:bg-slate-50"
              >
                <td className="px-4 py-2 font-medium text-slate-800">{c.firstName} {c.lastName}</td>
                <td className="px-4 py-2 text-slate-600">{c.title}</td>
                <td className="px-4 py-2 text-slate-600">{companyName(c.companyId)}</td>
                <td className="px-4 py-2 text-slate-600">{repName(c.ownerRepId)}</td>
                <td className="px-4 py-2 text-slate-400">{c.email || "—"}</td>
              </tr>
            ))}
            {contacts.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No contacts yet — add one.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={() => setEditing(null)}>
          <div className="h-full w-full max-w-md overflow-y-auto bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-4 text-lg font-semibold">{editing.id ? "Edit contact" : "New contact"}</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="First name"><input className={inputCls} value={editing.firstName ?? ""} onChange={(e) => setEditing({ ...editing, firstName: e.target.value })} /></Field>
                <Field label="Last name"><input className={inputCls} value={editing.lastName ?? ""} onChange={(e) => setEditing({ ...editing, lastName: e.target.value })} /></Field>
              </div>
              <Field label="Title"><input className={inputCls} value={editing.title ?? ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })} /></Field>
              <Field label="Company">
                <select className={inputCls} value={editing.companyId ?? ""} onChange={(e) => setEditing({ ...editing, companyId: e.target.value })}>
                  <option value="">— none —</option>
                  {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Email"><input className={inputCls} value={editing.email ?? ""} onChange={(e) => setEditing({ ...editing, email: e.target.value })} /></Field>
                <Field label="Phone"><input className={inputCls} value={editing.phone ?? ""} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} /></Field>
              </div>
              <Field label="Owner">
                <select className={inputCls} value={editing.ownerRepId ?? ""} onChange={(e) => setEditing({ ...editing, ownerRepId: e.target.value })}>
                  <option value="">— unassigned —</option>
                  {reps.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </Field>
              <Field label="Persona (helps Scout & Sparring)"><textarea rows={3} className={inputCls} value={editing.persona ?? ""} onChange={(e) => setEditing({ ...editing, persona: e.target.value })} /></Field>
            </div>
            <div className="mt-5 flex gap-2">
              <button onClick={save} disabled={busy} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40 enabled:hover:bg-indigo-700">{busy ? "Saving…" : "Save"}</button>
              <button onClick={() => setEditing(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const inputCls = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-300";
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
      {children}
    </label>
  );
}

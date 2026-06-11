"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Contact, Company, Rep } from "@/lib/data/types";
import { useToast } from "./Toaster";

const inputCls = "w-full rounded-lg border border-ash/15 bg-graphite px-3 py-2 text-sm text-bone outline-none focus:border-ember";

/** Slide-over create/edit form for a contact, shared by the list and the record page. */
export function ContactForm({
  initial,
  companies,
  reps,
  onClose,
}: {
  initial: Partial<Contact>;
  companies: Company[];
  reps: Rep[];
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState<Partial<Contact>>(initial);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!editing.firstName || !editing.lastName) return;
    setBusy(true);
    try {
      const isEdit = Boolean(editing.id);
      const res = await fetch("/api/crm/contacts", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing),
      });
      if (res.ok) {
        toast(isEdit ? "Contact updated" : "Contact created");
        onClose();
        router.refresh();
      } else {
        toast("Couldn't save the contact", "error");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div className="h-full w-full max-w-md overflow-y-auto border-l border-ash/10 bg-graphite p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-4 text-lg font-semibold text-bone">{editing.id ? "Edit contact" : "New contact"}</h3>
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
          <button onClick={save} disabled={busy} className="rounded-[4px] bg-ember px-4 py-2 text-sm font-medium text-bone ember-glow disabled:opacity-40">{busy ? "Saving…" : "Save"}</button>
          <button onClick={onClose} className="rounded-[4px] border border-ash/15 px-4 py-2 text-sm text-ash hover:bg-obsidian">Cancel</button>
        </div>
      </div>
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

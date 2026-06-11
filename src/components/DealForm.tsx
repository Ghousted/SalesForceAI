"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DEAL_STAGE_LABELS, type Deal, type DealStage, type Contact, type Rep } from "@/lib/data/types";
import { useToast } from "./Toaster";

const STAGES = Object.keys(DEAL_STAGE_LABELS) as DealStage[];
const inputCls = "w-full rounded-lg border border-ash/15 bg-graphite px-3 py-2 text-sm text-bone outline-none focus:border-ember";

/** A slide-over create/edit form for a deal, shared by the board and the record page. */
export function DealForm({
  initial,
  contacts,
  reps,
  onClose,
}: {
  initial: Partial<Deal>;
  contacts: Contact[];
  reps: Rep[];
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState<Partial<Deal>>(initial);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!editing.name || !editing.stage || !editing.expectedCloseDate) return;
    setBusy(true);
    try {
      const isEdit = Boolean(editing.id);
      const companyId = editing.contactId
        ? contacts.find((c) => c.id === editing.contactId)?.companyId ?? editing.companyId
        : editing.companyId;
      const res = await fetch("/api/crm/deals", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...editing, companyId }),
      });
      if (res.ok) {
        toast(isEdit ? "Deal updated" : "Deal created");
        onClose();
        router.refresh();
      } else {
        toast("Couldn't save the deal", "error");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div className="h-full w-full max-w-md overflow-y-auto border-l border-ash/10 bg-graphite p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-4 text-lg font-semibold text-bone">{editing.id ? "Edit deal" : "New deal"}</h3>
        <div className="space-y-3">
          <Field label="Deal name"><input className={inputCls} value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field>
          <Field label="Product / property"><input className={inputCls} value={editing.property ?? ""} onChange={(e) => setEditing({ ...editing, property: e.target.value })} /></Field>
          <Field label="Contact">
            <select className={inputCls} value={editing.contactId ?? ""} onChange={(e) => setEditing({ ...editing, contactId: e.target.value })}>
              <option value="">— none —</option>
              {contacts.map((c) => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Stage">
              <select className={inputCls} value={editing.stage ?? "qualifying"} onChange={(e) => setEditing({ ...editing, stage: e.target.value as DealStage })}>
                {STAGES.map((s) => <option key={s} value={s}>{DEAL_STAGE_LABELS[s]}</option>)}
              </select>
            </Field>
            <Field label="Amount (PHP)"><input type="number" className={inputCls} value={editing.amount ?? 0} onChange={(e) => setEditing({ ...editing, amount: Number(e.target.value) })} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Close date"><input type="date" className={inputCls} value={editing.expectedCloseDate?.slice(0, 10) ?? ""} onChange={(e) => setEditing({ ...editing, expectedCloseDate: e.target.value })} /></Field>
            <Field label="Confidence %"><input type="number" min={0} max={100} className={inputCls} value={editing.repConfidence ?? 50} onChange={(e) => setEditing({ ...editing, repConfidence: Number(e.target.value) })} /></Field>
          </div>
          <Field label="Owner">
            <select className={inputCls} value={editing.ownerRepId ?? ""} onChange={(e) => setEditing({ ...editing, ownerRepId: e.target.value })}>
              <option value="">— unassigned —</option>
              {reps.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </Field>
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

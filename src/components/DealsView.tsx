"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DEAL_STAGE_LABELS, type Deal, type DealStage, type Contact, type Rep } from "@/lib/data/types";

const PHP = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 });
const STAGES = Object.keys(DEAL_STAGE_LABELS) as DealStage[];

const blank: Partial<Deal> = {
  name: "", contactId: "", companyId: "", stage: "qualifying",
  amount: 0, property: "", expectedCloseDate: "", ownerRepId: "", repConfidence: 50,
};

export function DealsView({
  deals,
  contacts,
  reps,
}: {
  deals: Deal[];
  contacts: Contact[];
  reps: Rep[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<Partial<Deal> | null>(null);
  const [busy, setBusy] = useState(false);

  const contactName = (id: string) => {
    const c = contacts.find((x) => x.id === id);
    return c ? `${c.firstName} ${c.lastName}` : "—";
  };
  const repName = (id: string) => reps.find((r) => r.id === id)?.name ?? "Unassigned";

  async function save() {
    if (!editing?.name || !editing?.stage || !editing?.expectedCloseDate) return;
    setBusy(true);
    try {
      const isEdit = Boolean(editing.id);
      // if a contact is chosen, inherit its company
      const companyId = editing.contactId
        ? contacts.find((c) => c.id === editing.contactId)?.companyId ?? editing.companyId
        : editing.companyId;
      await fetch("/api/crm/deals", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...editing, companyId }),
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
        <h1 className="text-2xl font-semibold tracking-tight">Deals</h1>
        <button onClick={() => setEditing({ ...blank })} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700">+ New deal</button>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-2 font-semibold">Deal</th>
              <th className="px-4 py-2 font-semibold">Contact</th>
              <th className="px-4 py-2 font-semibold">Stage</th>
              <th className="px-4 py-2 font-semibold">Amount</th>
              <th className="px-4 py-2 font-semibold">Close</th>
              <th className="px-4 py-2 font-semibold">Conf.</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {deals.map((d) => (
              <tr key={d.id} onClick={() => setEditing({ ...d })} className="cursor-pointer hover:bg-slate-50">
                <td className="px-4 py-2 font-medium text-slate-800">{d.name}</td>
                <td className="px-4 py-2 text-slate-600">{contactName(d.contactId)}</td>
                <td className="px-4 py-2"><span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">{DEAL_STAGE_LABELS[d.stage]}</span></td>
                <td className="px-4 py-2 text-slate-600">{PHP.format(d.amount)}</td>
                <td className="px-4 py-2 text-slate-400">{d.expectedCloseDate?.slice(0, 10) || "—"}</td>
                <td className="px-4 py-2 text-slate-600">{d.repConfidence}%</td>
              </tr>
            ))}
            {deals.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">No deals yet — add one.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={() => setEditing(null)}>
          <div className="h-full w-full max-w-md overflow-y-auto bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-4 text-lg font-semibold">{editing.id ? "Edit deal" : "New deal"}</h3>
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

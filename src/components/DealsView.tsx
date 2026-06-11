"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DEAL_STAGE_LABELS, type Deal, type DealStage, type Contact, type Rep } from "@/lib/data/types";
import { DealForm } from "./DealForm";
import { useToast } from "./Toaster";
import { downloadCsv } from "@/lib/csv";

const PHP = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 });
const PHPc = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 1, notation: "compact" });
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
  const toast = useToast();
  const [creating, setCreating] = useState(false);
  const [view, setView] = useState<"board" | "table">("board");
  const [q, setQ] = useState("");
  // Local mirror so a drag drops instantly; re-synced when the server refreshes.
  const [dealList, setDealList] = useState(deals);
  const [dragId, setDragId] = useState<string | null>(null);
  useEffect(() => setDealList(deals), [deals]);

  const contactName = (id: string) => {
    const c = contacts.find((x) => x.id === id);
    return c ? `${c.firstName} ${c.lastName}` : "—";
  };
  const open = (id: string) => router.push(`/deals/${id}`);

  const ql = q.trim().toLowerCase();
  const shown = ql
    ? dealList.filter((d) => `${d.name} ${d.property} ${contactName(d.contactId)}`.toLowerCase().includes(ql))
    : dealList;

  async function moveStage(id: string, stage: DealStage) {
    const current = dealList.find((d) => d.id === id);
    if (!current || current.stage === stage) return;
    setDealList((prev) => prev.map((d) => (d.id === id ? { ...d, stage } : d)));
    try {
      await fetch("/api/crm/deals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, stage }),
      });
      toast(`Moved to ${DEAL_STAGE_LABELS[stage]}`);
      router.refresh();
    } catch {
      setDealList((prev) => prev.map((d) => (d.id === id ? { ...d, stage: current.stage } : d)));
      toast("Couldn't move the deal", "error");
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Deals</h1>
        <div className="flex items-center gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter…" className="w-40 rounded-full border border-ash/10 bg-graphite px-3.5 py-1.5 text-[13px] text-bone outline-none placeholder:text-ash/40 focus:border-ember/50" />
          <div className="flex items-center gap-0.5 rounded-full bg-ash/10 p-0.5 text-[13px]">
            {(["board", "table"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`rounded-full px-3 py-1 font-medium capitalize transition-colors ${view === v ? "bg-graphite text-bone" : "text-ash hover:text-bone"}`}
              >
                {v}
              </button>
            ))}
          </div>
          <button
            onClick={() => downloadCsv("deals.csv", shown.map((d) => ({ name: d.name, contact: contactName(d.contactId), stage: DEAL_STAGE_LABELS[d.stage], amount: d.amount, property: d.property, closeDate: d.expectedCloseDate?.slice(0, 10), confidence: d.repConfidence })))}
            className="rounded-[4px] border border-ash/15 px-3 py-1.5 text-[13px] font-medium text-ash transition-colors hover:border-ember hover:text-bone"
          >
            Export
          </button>
          <button onClick={() => setCreating(true)} className="rounded-[4px] bg-ember px-3.5 py-1.5 text-[13px] font-medium text-bone ember-glow transition-transform hover:scale-[1.03]">+ New deal</button>
        </div>
      </div>

      {view === "board" ? (
        <div className="flex gap-3 overflow-x-auto pb-3">
          {STAGES.map((stage) => {
            const col = shown.filter((d) => d.stage === stage);
            const sum = col.reduce((s, d) => s + d.amount, 0);
            return (
              <div
                key={stage}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const id = e.dataTransfer.getData("text/plain");
                  if (id) moveStage(id, stage);
                  setDragId(null);
                }}
                className="flex w-64 shrink-0 flex-col rounded-xl border border-ash/12 bg-graphite/40"
              >
                <div className="border-b border-ash/10 px-3 py-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-ash">{DEAL_STAGE_LABELS[stage]}</span>
                    <span className="rounded-full bg-ash/10 px-1.5 py-0.5 text-[10px] text-ash/70">{col.length}</span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-ash/50">{PHPc.format(sum)}</div>
                </div>
                <div className="flex min-h-[100px] flex-1 flex-col gap-2 p-2">
                  {col.map((d) => (
                    <div
                      key={d.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", d.id);
                        e.dataTransfer.effectAllowed = "move";
                        setDragId(d.id);
                      }}
                      onDragEnd={() => setDragId(null)}
                      onClick={() => open(d.id)}
                      className={`cursor-pointer rounded-lg border bg-obsidian p-3 transition ${dragId === d.id ? "border-ember opacity-50" : "border-ash/12 hover:border-ember/60"}`}
                    >
                      <div className="text-[13px] font-medium text-bone">{d.name}</div>
                      <div className="mt-0.5 text-[11px] text-ash/70">{contactName(d.contactId)}</div>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-[12px] text-ash">{PHPc.format(d.amount)}</span>
                        <span className="text-[10px] text-ash/60">{d.repConfidence}%</span>
                      </div>
                      <div className="mt-1.5 h-1 rounded-full bg-ash/10">
                        <div className="h-1 rounded-full bg-ember" style={{ width: `${d.repConfidence}%` }} />
                      </div>
                    </div>
                  ))}
                  {col.length === 0 && (
                    <div className="rounded-lg border border-dashed border-ash/10 px-2 py-6 text-center text-[11px] text-ash/40">Drop here</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-ash/15 bg-graphite">
          <table className="w-full text-sm">
            <thead className="bg-obsidian text-left text-xs uppercase tracking-wide text-ash/70">
              <tr>
                <th className="px-4 py-2 font-semibold">Deal</th>
                <th className="px-4 py-2 font-semibold">Contact</th>
                <th className="px-4 py-2 font-semibold">Stage</th>
                <th className="px-4 py-2 font-semibold">Amount</th>
                <th className="px-4 py-2 font-semibold">Close</th>
                <th className="px-4 py-2 font-semibold">Conf.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ash/10">
              {shown.map((d) => (
                <tr key={d.id} onClick={() => open(d.id)} className="cursor-pointer hover:bg-obsidian">
                  <td className="px-4 py-2 font-medium text-bone">{d.name}</td>
                  <td className="px-4 py-2 text-ash">{contactName(d.contactId)}</td>
                  <td className="px-4 py-2"><span className="rounded bg-ash/10 px-1.5 py-0.5 text-xs text-ash">{DEAL_STAGE_LABELS[d.stage]}</span></td>
                  <td className="px-4 py-2 text-ash">{PHP.format(d.amount)}</td>
                  <td className="px-4 py-2 text-ash/70">{d.expectedCloseDate?.slice(0, 10) || "—"}</td>
                  <td className="px-4 py-2 text-ash">{d.repConfidence}%</td>
                </tr>
              ))}
              {shown.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-ash/70">{dealList.length === 0 ? "No deals yet — add one." : "No deals match your filter."}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {creating && (
        <DealForm initial={{ ...blank }} contacts={contacts} reps={reps} onClose={() => setCreating(false)} />
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ActivityType } from "@/lib/data/types";
import { useToast } from "./Toaster";

const TYPES: { value: ActivityType; label: string }[] = [
  { value: "note", label: "Note" },
  { value: "call", label: "Call" },
  { value: "meeting", label: "Meeting" },
  { value: "email", label: "Email" },
  { value: "viewing", label: "Viewing" },
];

/** Inline form to log a touch onto a contact's (and optionally a deal's) timeline. */
export function LogActivity({ contactId, dealId }: { contactId: string; dealId?: string }) {
  const router = useRouter();
  const toast = useToast();
  const [type, setType] = useState<ActivityType>("note");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/crm/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId, dealId, type, subject, body }),
      });
      if (res.ok) {
        toast("Activity logged");
        setSubject("");
        setBody("");
        setType("note");
        router.refresh();
      } else toast("Couldn't log the activity", "error");
    } finally {
      setBusy(false);
    }
  }

  const input = "rounded-lg border border-ash/15 bg-graphite px-3 py-2 text-sm text-bone outline-none focus:border-ember placeholder:text-ash/40";

  return (
    <form onSubmit={submit} className="mb-4 rounded-xl border border-ash/12 bg-graphite p-3.5">
      <div className="mb-2 flex gap-2">
        <select value={type} onChange={(e) => setType(e.target.value as ActivityType)} className={`${input} shrink-0`}>
          {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject — what happened?" className={`${input} flex-1`} />
      </div>
      <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2} placeholder="Details (optional)" className={`${input} w-full`} />
      <div className="mt-2 flex justify-end">
        <button type="submit" disabled={busy || !subject.trim()} className="rounded-[4px] bg-ember px-3.5 py-1.5 text-[13px] font-medium text-bone ember-glow disabled:opacity-40">
          {busy ? "Logging…" : "Log activity"}
        </button>
      </div>
    </form>
  );
}

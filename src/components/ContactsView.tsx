"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Contact, Company, Rep } from "@/lib/data/types";
import { ContactForm } from "./ContactForm";
import { downloadCsv } from "@/lib/csv";

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
  const [creating, setCreating] = useState(false);
  const [q, setQ] = useState("");

  const companyName = (id: string) => companies.find((c) => c.id === id)?.name ?? "—";
  const repName = (id: string) => reps.find((r) => r.id === id)?.name ?? "Unassigned";

  const ql = q.trim().toLowerCase();
  const shown = ql
    ? contacts.filter((c) =>
        `${c.firstName} ${c.lastName} ${c.title} ${companyName(c.companyId)} ${c.email}`.toLowerCase().includes(ql),
      )
    : contacts;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Contacts</h1>
        <div className="flex items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter…"
            className="w-44 rounded-full border border-ash/10 bg-graphite px-3.5 py-1.5 text-[13px] text-bone outline-none placeholder:text-ash/40 focus:border-ember/50"
          />
          <button
            onClick={() => downloadCsv("contacts.csv", shown.map((c) => ({ firstName: c.firstName, lastName: c.lastName, title: c.title, company: companyName(c.companyId), owner: repName(c.ownerRepId), email: c.email, phone: c.phone })))}
            className="rounded-[4px] border border-ash/15 px-3 py-1.5 text-[13px] font-medium text-ash transition-colors hover:border-ember hover:text-bone"
          >
            Export
          </button>
          <button
            onClick={() => setCreating(true)}
            className="rounded-[4px] bg-ember px-3.5 py-1.5 text-[13px] font-medium text-bone ember-glow transition-transform hover:scale-[1.03]"
          >
            + New contact
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-ash/15 bg-graphite">
        <table className="w-full text-sm">
          <thead className="bg-obsidian text-left text-xs uppercase tracking-wide text-ash/70">
            <tr>
              <th className="px-4 py-2 font-semibold">Name</th>
              <th className="px-4 py-2 font-semibold">Title</th>
              <th className="px-4 py-2 font-semibold">Company</th>
              <th className="px-4 py-2 font-semibold">Owner</th>
              <th className="px-4 py-2 font-semibold">Email</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ash/10">
            {shown.map((c) => (
              <tr
                key={c.id}
                onClick={() => router.push(`/contacts/${c.id}`)}
                className="cursor-pointer hover:bg-obsidian"
              >
                <td className="px-4 py-2 font-medium text-bone">{c.firstName} {c.lastName}</td>
                <td className="px-4 py-2 text-ash">{c.title}</td>
                <td className="px-4 py-2 text-ash">{companyName(c.companyId)}</td>
                <td className="px-4 py-2 text-ash">{repName(c.ownerRepId)}</td>
                <td className="px-4 py-2 text-ash/70">{c.email || "—"}</td>
              </tr>
            ))}
            {shown.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-ash/70">{contacts.length === 0 ? "No contacts yet — add one." : "No contacts match your filter."}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {creating && (
        <ContactForm initial={{ ...blank }} companies={companies} reps={reps} onClose={() => setCreating(false)} />
      )}
    </div>
  );
}

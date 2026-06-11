import Link from "next/link";
import { DEAL_STAGE_LABELS, type Company, type Contact, type Deal } from "@/lib/data/types";

const PHP = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 });

export function CompanyDetail({
  company,
  contacts,
  deals,
}: {
  company: Company;
  contacts: Contact[];
  deals: Deal[];
}) {
  const pipeline = deals
    .filter((d) => d.stage !== "closed-won" && d.stage !== "closed-lost")
    .reduce((s, d) => s + d.amount, 0);

  return (
    <div>
      <div className="mb-6">
        <Link href="/companies" className="text-[13px] text-ash/60 transition-colors hover:text-ash">← Companies</Link>
        <h1 className="mt-3 text-[clamp(1.75rem,4vw,2.75rem)] font-bold leading-[1.05] tracking-[-0.021em] text-bone">{company.name}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px] text-ash">
          <span>{company.industry}</span>
          <span>· {company.location}</span>
        </div>
      </div>

      <div className="mb-8 grid grid-cols-3 gap-3">
        <Stat label="Contacts" value={String(contacts.length)} />
        <Stat label="Deals" value={String(deals.length)} />
        <Stat label="Open pipeline" value={PHP.format(pipeline)} />
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ash/70">Contacts</h2>
          {contacts.length === 0 ? (
            <Empty>No contacts at this company yet.</Empty>
          ) : (
            <div className="space-y-2">
              {contacts.map((c) => (
                <Link key={c.id} href={`/contacts/${c.id}`} className="block rounded-xl border border-ash/12 bg-graphite p-3.5 transition-colors hover:border-ember/60">
                  <div className="text-sm font-medium text-bone">{c.firstName} {c.lastName}</div>
                  <div className="mt-0.5 text-[12px] text-ash/70">{c.title || "—"}{c.email ? ` · ${c.email}` : ""}</div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ash/70">Deals</h2>
          {deals.length === 0 ? (
            <Empty>No deals linked to this company yet.</Empty>
          ) : (
            <div className="space-y-2">
              {deals.map((d) => (
                <Link key={d.id} href={`/deals/${d.id}`} className="block rounded-xl border border-ash/12 bg-graphite p-3.5 transition-colors hover:border-ember/60">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-bone">{d.name}</span>
                    <span className="rounded-full bg-ash/10 px-2 py-0.5 text-[11px] text-ash">{DEAL_STAGE_LABELS[d.stage]}</span>
                  </div>
                  <div className="mt-1 text-[12px] text-ash/70">{PHP.format(d.amount)} · {d.repConfidence}%</div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>

      {company.notes && (
        <section className="mt-8">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ash/70">Notes</h2>
          <div className="rounded-xl border border-ash/12 bg-graphite p-4 text-[13px] leading-[1.6] text-ash">{company.notes}</div>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-ash/12 bg-graphite p-4">
      <div className="text-[11px] font-medium uppercase tracking-wide text-ash/60">{label}</div>
      <div className="mt-1.5 text-xl font-bold tracking-tight text-bone">{value}</div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-ash/12 bg-graphite p-4 text-[13px] text-ash/60">{children}</div>;
}

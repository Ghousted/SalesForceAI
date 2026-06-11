import { NextResponse } from "next/server";
import { ensureSnapshot, listAllContacts, listAllDeals, listAllCompanies } from "@/lib/data/spine";
import { tenantRoute } from "@/lib/tenant";

export const dynamic = "force-dynamic";

/** Global search over contacts + deals for the ⌘K command palette. */
export const GET = tenantRoute(async (req: Request) => {
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().toLowerCase();
  if (!q) return NextResponse.json({ results: [] });
  await ensureSnapshot();

  const companies = listAllCompanies();
  const companyName = (id: string) => companies.find((c) => c.id === id)?.name ?? "";

  const contacts = listAllContacts()
    .filter((c) =>
      `${c.firstName} ${c.lastName} ${c.email} ${c.title} ${companyName(c.companyId)}`
        .toLowerCase()
        .includes(q),
    )
    .slice(0, 6)
    .map((c) => ({
      type: "contact" as const,
      id: c.id,
      label: `${c.firstName} ${c.lastName}`.trim(),
      sub: c.title || companyName(c.companyId) || c.email || "Contact",
      href: `/contacts/${c.id}`,
    }));

  const deals = listAllDeals()
    .filter((d) => `${d.name} ${d.property}`.toLowerCase().includes(q))
    .slice(0, 6)
    .map((d) => ({
      type: "deal" as const,
      id: d.id,
      label: d.name,
      sub: d.property || "Deal",
      href: `/deals/${d.id}`,
    }));

  const companyHits = companies
    .filter((c) => `${c.name} ${c.industry} ${c.location}`.toLowerCase().includes(q))
    .slice(0, 4)
    .map((c) => ({
      type: "company" as const,
      id: c.id,
      label: c.name,
      sub: c.industry || "Company",
      href: `/companies/${c.id}`,
    }));

  return NextResponse.json({ results: [...contacts, ...companyHits, ...deals] });
});

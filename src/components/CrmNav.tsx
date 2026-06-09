import Link from "next/link";

/** Shared top nav for the CRM surfaces (Team roster + light CRM views). */
export function CrmNav({ active }: { active: "team" | "contacts" | "deals" }) {
  const link = (href: string, label: string, key: string) => (
    <Link
      href={href}
      className={`rounded-md px-3 py-1.5 text-sm font-medium ${
        active === key ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-800"
      }`}
    >
      {label}
    </Link>
  );
  return (
    <header className="mb-7 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
          S
        </div>
        <div className="text-sm font-semibold leading-tight">Sales OS</div>
      </div>
      <nav className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
        {link("/", "Team", "team")}
        {link("/contacts", "Contacts", "contacts")}
        {link("/deals", "Deals", "deals")}
      </nav>
    </header>
  );
}

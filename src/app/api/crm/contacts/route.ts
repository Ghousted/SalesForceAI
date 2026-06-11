import { NextResponse } from "next/server";
import { createContact, updateContact } from "@/lib/data/writes";
import { withTenant } from "@/lib/tenant";

// POST create, PATCH update (id in body) — the CRM is its own system of record.
export async function POST(req: Request) {
  return withTenant(async () => {
    const body = await req.json().catch(() => null);
    if (!body?.firstName || !body?.lastName) {
      return NextResponse.json({ error: "firstName and lastName are required" }, { status: 400 });
    }
    const id = await createContact(body);
    return NextResponse.json({ id });
  });
}

export async function PATCH(req: Request) {
  return withTenant(async () => {
    const body = await req.json().catch(() => null);
    if (!body?.id) return NextResponse.json({ error: "id is required" }, { status: 400 });
    const { id, ...patch } = body;
    await updateContact(id, patch);
    return NextResponse.json({ id });
  });
}

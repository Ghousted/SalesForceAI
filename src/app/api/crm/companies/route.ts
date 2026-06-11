import { NextResponse } from "next/server";
import { createCompany, updateCompany } from "@/lib/data/writes";
import { withTenant } from "@/lib/tenant";

export async function POST(req: Request) {
  return withTenant(async () => {
    const body = await req.json().catch(() => null);
    if (!body?.name) return NextResponse.json({ error: "name is required" }, { status: 400 });
    const id = await createCompany(body);
    return NextResponse.json({ id });
  });
}

export async function PATCH(req: Request) {
  return withTenant(async () => {
    const body = await req.json().catch(() => null);
    if (!body?.id) return NextResponse.json({ error: "id is required" }, { status: 400 });
    const { id, ...patch } = body;
    await updateCompany(id, patch);
    return NextResponse.json({ id });
  });
}

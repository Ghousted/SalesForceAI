import { NextResponse } from "next/server";
import { createDeal, updateDeal } from "@/lib/data/writes";
import { withTenant } from "@/lib/tenant";

export async function POST(req: Request) {
  return withTenant(async () => {
    const body = await req.json().catch(() => null);
    if (!body?.name || !body?.stage || !body?.expectedCloseDate) {
      return NextResponse.json(
        { error: "name, stage and expectedCloseDate are required" },
        { status: 400 },
      );
    }
    const id = await createDeal({ ...body, amount: Number(body.amount) || 0 });
    return NextResponse.json({ id });
  });
}

export async function PATCH(req: Request) {
  return withTenant(async () => {
    const body = await req.json().catch(() => null);
    if (!body?.id) return NextResponse.json({ error: "id is required" }, { status: 400 });
    const { id, ...patch } = body;
    if (patch.amount !== undefined) patch.amount = Number(patch.amount) || 0;
    await updateDeal(id, patch);
    return NextResponse.json({ id });
  });
}

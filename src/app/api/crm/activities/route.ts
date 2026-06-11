import { NextResponse } from "next/server";
import { logActivity } from "@/lib/data/writes";
import { withTenant } from "@/lib/tenant";
import type { ActivityType } from "@/lib/data/types";

const TYPES: ActivityType[] = ["note", "call", "meeting", "email", "viewing"];

export async function POST(req: Request) {
  return withTenant(async () => {
    const body = await req.json().catch(() => null);
    if (!body?.contactId || !body?.subject || !TYPES.includes(body.type)) {
      return NextResponse.json({ error: "contactId, type and subject are required" }, { status: 400 });
    }
    const id = await logActivity({
      contactId: body.contactId,
      dealId: body.dealId || undefined,
      type: body.type,
      subject: body.subject,
      body: body.body,
      direction: body.direction,
    });
    return NextResponse.json({ id });
  });
}

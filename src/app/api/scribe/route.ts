import { NextResponse } from "next/server";
import { tenantRoute } from "@/lib/tenant";
import { runScribe } from "@/agents/scribe";
import { ensureSnapshot } from "@/lib/data/spine";

async function _POST(req: Request) {
  let contactId: string | undefined;
  let reason: string | undefined;
  try {
    const body = await req.json();
    contactId = body?.contactId;
    reason = typeof body?.reason === "string" ? body.reason : undefined;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!contactId) {
    return NextResponse.json({ error: "contactId is required" }, { status: 400 });
  }
  try {
    await ensureSnapshot();
    const result = await runScribe(contactId, reason ? { reason } : undefined);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Scribe failed";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}

export const POST = tenantRoute(_POST);

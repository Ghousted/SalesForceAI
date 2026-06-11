import { NextResponse } from "next/server";
import { tenantRoute } from "@/lib/tenant";
import { runAnalyst } from "@/agents/analyst";
import { ensureSnapshot } from "@/lib/data/spine";

async function _POST(req: Request) {
  let contactId: string | undefined;
  try {
    contactId = (await req.json())?.contactId;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!contactId) {
    return NextResponse.json({ error: "contactId is required" }, { status: 400 });
  }
  try {
    await ensureSnapshot();
    const result = await runAnalyst(contactId);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Analyst failed";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}

export const POST = tenantRoute(_POST);

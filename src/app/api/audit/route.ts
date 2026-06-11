import { NextResponse } from "next/server";
import { tenantRoute } from "@/lib/tenant";
import { runAuditor } from "@/agents/auditor";
import { ensureSnapshot } from "@/lib/data/spine";

async function _POST(req: Request) {
  let repId: string | undefined;
  try {
    const body = await req.json();
    repId = body?.repId; // optional — omit to audit the whole floor
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    await ensureSnapshot();
    const result = await runAuditor(repId);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Auditor failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const POST = tenantRoute(_POST);

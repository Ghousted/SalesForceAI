import { NextResponse } from "next/server";
import { tenantRoute } from "@/lib/tenant";
import { runDispatcher } from "@/agents/dispatcher";
import { ensureSnapshot } from "@/lib/data/spine";

async function _POST() {
  try {
    await ensureSnapshot();
    const result = await runDispatcher();
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Dispatcher failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const POST = tenantRoute(_POST);

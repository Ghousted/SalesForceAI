import { NextResponse } from "next/server";
import { runScout } from "@/agents/scout";
import { ensureSnapshot } from "@/lib/data/spine";
import { tenantRoute } from "@/lib/tenant";

export const POST = tenantRoute(async (req: Request) => {
  let contactId: string | undefined;
  try {
    const body = await req.json();
    contactId = body?.contactId;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!contactId) {
    return NextResponse.json({ error: "contactId is required" }, { status: 400 });
  }

  try {
    await ensureSnapshot();
    const result = await runScout(contactId);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Scout failed";
    return NextResponse.json({ error: message }, { status: 404 });
  }
});

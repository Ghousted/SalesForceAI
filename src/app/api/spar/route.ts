import { NextResponse } from "next/server";
import { tenantRoute } from "@/lib/tenant";
import { runSparSession, type SparAnswer } from "@/agents/sparring";
import { ensureSnapshot } from "@/lib/data/spine";

async function _POST(req: Request) {
  let contactId: string | undefined;
  let answers: SparAnswer[] = [];
  try {
    const body = await req.json();
    contactId = body?.contactId;
    answers = Array.isArray(body?.answers) ? body.answers : [];
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!contactId) {
    return NextResponse.json({ error: "contactId is required" }, { status: 400 });
  }

  try {
    await ensureSnapshot();
    const result = await runSparSession(contactId, answers);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sparring Partner failed";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}

export const POST = tenantRoute(_POST);

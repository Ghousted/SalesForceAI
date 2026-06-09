import { NextResponse } from "next/server";
import { runSparSession, type SparAnswer } from "@/agents/sparring";
import { ensureSnapshot } from "@/lib/data/spine";

export async function POST(req: Request) {
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

import { NextResponse } from "next/server";
import { runScribe } from "@/agents/scribe";
import { ensureSnapshot } from "@/lib/data/spine";

export async function POST(req: Request) {
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
    const result = await runScribe(contactId);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Scribe failed";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}

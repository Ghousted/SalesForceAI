import { NextResponse } from "next/server";
import { runAuditor } from "@/agents/auditor";

export async function POST(req: Request) {
  let repId: string | undefined;
  try {
    const body = await req.json();
    repId = body?.repId; // optional — omit to audit the whole floor
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const result = await runAuditor(repId);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Auditor failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

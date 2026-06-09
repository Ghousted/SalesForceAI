import { NextResponse } from "next/server";
import { runCommand } from "@/lib/command/router";
import { ensureSnapshot } from "@/lib/data/spine";

export async function POST(req: Request) {
  let text: string | undefined;
  let repId: string | undefined;
  try {
    const body = await req.json();
    text = body?.text;
    repId = body?.repId;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!text || !repId) {
    return NextResponse.json(
      { error: "text and repId are required" },
      { status: 400 },
    );
  }

  await ensureSnapshot();
  const outcome = await runCommand(text, repId);
  return NextResponse.json(outcome);
}

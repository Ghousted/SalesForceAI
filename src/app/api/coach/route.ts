import { NextResponse } from "next/server";
import { runCoach } from "@/agents/coach";
import { ensureSnapshot } from "@/lib/data/spine";

export async function POST() {
  try {
    await ensureSnapshot();
    const result = await runCoach();
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Coach failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

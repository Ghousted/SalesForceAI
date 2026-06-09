import { NextResponse } from "next/server";
import { setEnabled, runNow } from "@/lib/triggers/runner";

// POST /api/triggers/:id   { action: "enable" | "disable" | "run" }
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  let action: string | undefined;
  try {
    action = (await req.json())?.action;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (action === "enable" || action === "disable") {
    const trigger = await setEnabled(id, action === "enable");
    if (!trigger) return NextResponse.json({ error: "Unknown trigger" }, { status: 404 });
    return NextResponse.json({ trigger });
  }

  if (action === "run") {
    const run = await runNow(id);
    if (!run) return NextResponse.json({ error: "Unknown trigger" }, { status: 404 });
    return NextResponse.json({ run });
  }

  return NextResponse.json(
    { error: 'action must be "enable", "disable", or "run"' },
    { status: 400 },
  );
}

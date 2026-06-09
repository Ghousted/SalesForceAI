import { NextResponse } from "next/server";
import { getAction, updateAction } from "@/lib/actions/store";
import { executeAction } from "@/lib/actions/executor";

// POST /api/actions/:id  { decision: "approve" | "reject" }
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const action = getAction(id);
  if (!action) {
    return NextResponse.json({ error: "Action not found" }, { status: 404 });
  }
  if (action.status !== "proposed") {
    return NextResponse.json(
      { error: `Action already ${action.status}` },
      { status: 409 },
    );
  }

  let decision: string | undefined;
  try {
    decision = (await req.json())?.decision;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (decision === "reject") {
    const updated = updateAction(id, {
      status: "rejected",
      resolvedAt: new Date().toISOString(),
    });
    return NextResponse.json({ action: updated });
  }

  if (decision === "approve") {
    const executed = await executeAction(action);
    return NextResponse.json({ action: executed });
  }

  return NextResponse.json(
    { error: 'decision must be "approve" or "reject"' },
    { status: 400 },
  );
}

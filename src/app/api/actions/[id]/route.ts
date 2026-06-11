import { NextResponse } from "next/server";
import { tenantRoute } from "@/lib/tenant";
import { getAction, updateAction } from "@/lib/actions/store";
import { executeAction } from "@/lib/actions/executor";
import { chainFromRouting } from "@/agents/chain";

// POST /api/actions/:id  { decision: "approve" | "reject" }
async function _POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const action = await getAction(id);
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
    const updated = await updateAction(id, {
      status: "rejected",
      resolvedAt: new Date().toISOString(),
    });
    return NextResponse.json({ action: updated });
  }

  if (decision === "approve") {
    const executed = await executeAction(action);
    // Dispatcher→Scout chain: a routed lead gets its pre-call brief pinned to
    // the timeline so the new owner opens the record already briefed.
    if (executed.status === "executed" && executed.kind === "assign-owner") {
      await chainFromRouting(executed.target.id);
    }
    return NextResponse.json({ action: executed });
  }

  return NextResponse.json(
    { error: 'decision must be "approve" or "reject"' },
    { status: 400 },
  );
}

export const POST = tenantRoute(_POST);

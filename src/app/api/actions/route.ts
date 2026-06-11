import { NextResponse } from "next/server";
import { tenantRoute } from "@/lib/tenant";
import { listActions } from "@/lib/actions/store";

// GET /api/actions?status=pending  → the approval inbox
async function _GET(req: Request) {
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const actions =
    status === "pending"
      ? await listActions({ pending: true })
      : status
        ? await listActions({ status: status as never })
        : await listActions();
  return NextResponse.json({ actions });
}

export const GET = tenantRoute(_GET);

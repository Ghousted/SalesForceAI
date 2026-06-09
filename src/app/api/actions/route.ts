import { NextResponse } from "next/server";
import { listActions } from "@/lib/actions/store";

// GET /api/actions?status=pending  → the approval inbox
export async function GET(req: Request) {
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const actions =
    status === "pending"
      ? listActions({ pending: true })
      : status
        ? listActions({ status: status as never })
        : listActions();
  return NextResponse.json({ actions });
}

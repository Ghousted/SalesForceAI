import { NextResponse } from "next/server";
import { tick } from "@/lib/triggers/runner";

// POST /api/triggers/tick   { force?: boolean }
// The clock pulse — evaluates triggers and fires the due ones. Drive it from an
// external cron, or let the in-process scheduler call the same logic.
export async function POST(req: Request) {
  let force = false;
  try {
    force = Boolean((await req.json())?.force);
  } catch {
    /* no body is fine */
  }
  const fired = await tick(force);
  return NextResponse.json({ fired, count: fired.length });
}

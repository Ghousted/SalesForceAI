import { NextResponse } from "next/server";
import { tick } from "@/lib/triggers/runner";

// The clock pulse — evaluates triggers and fires the due ones. Driven by the
// in-process scheduler locally, and by an external cron (e.g. Vercel Cron) in
// serverless. POST accepts { force }; GET is for Vercel Cron (which sends GET).

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

export async function GET(req: Request) {
  // Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`. Enforce if set.
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const fired = await tick();
  return NextResponse.json({ count: fired.length });
}

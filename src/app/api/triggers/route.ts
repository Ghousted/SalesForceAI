import { NextResponse } from "next/server";
import {
  listTriggers,
  recentRuns,
  schedulerRunning,
  ensureScheduler,
} from "@/lib/triggers/runner";

export async function GET() {
  // Lazily make sure the scheduler is up (covers servers that didn't run
  // instrumentation, e.g. some dev setups).
  ensureScheduler();
  return NextResponse.json({
    scheduler: schedulerRunning(),
    triggers: await listTriggers(),
    runs: await recentRuns(),
  });
}

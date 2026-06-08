import { NextResponse } from "next/server";
import { runForecaster } from "@/agents/forecaster";

export async function POST(req: Request) {
  let repId: string | undefined;
  try {
    const body = await req.json();
    repId = body?.repId; // optional — omit to forecast the whole floor
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const result = await runForecaster(repId);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Forecaster failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

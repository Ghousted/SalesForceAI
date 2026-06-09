import { NextResponse } from "next/server";
import { modelAssignments, MODEL_TIERS } from "@/lib/llm/models";

/**
 * Inspect the active per-agent model mapping (which GGUF each agent hot-loads).
 * Handy for verifying your llama-swap config lines up with what the agents ask
 * for. GET /api/models
 */
export async function GET() {
  return NextResponse.json({
    provider: process.env.LLM_PROVIDER ?? "stub",
    endpoint: process.env.LLAMACPP_BASE_URL ?? "http://localhost:8080/v1",
    tiers: MODEL_TIERS,
    agents: modelAssignments(),
  });
}

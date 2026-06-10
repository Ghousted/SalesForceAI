import { NextResponse } from "next/server";
import { listAgentConfigs, setAgentConfig } from "@/lib/agents/config";

export async function GET() {
  return NextResponse.json({ agents: await listAgentConfigs() });
}

// PATCH { id, displayName?, enabled?, autonomy? }  — autonomy "default" clears the override.
export async function PATCH(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body?.id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  const autonomy =
    body.autonomy === undefined
      ? undefined
      : body.autonomy === "default"
        ? null
        : (body.autonomy as "ask" | "auto");
  await setAgentConfig(body.id, {
    displayName: body.displayName,
    enabled: body.enabled,
    autonomy,
  });
  return NextResponse.json({ ok: true });
}

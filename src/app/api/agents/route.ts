import { NextResponse } from "next/server";
import { tenantRoute } from "@/lib/tenant";
import { listAgentConfigs, setAgentConfig } from "@/lib/agents/config";

async function _GET() {
  return NextResponse.json({ agents: await listAgentConfigs() });
}

// PATCH { id, displayName?, enabled?, autonomy?, funnel? }
//   autonomy "default" clears the override; funnel { segment, routeTo }.
async function _PATCH(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body?.id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  const autonomy =
    body.autonomy === undefined
      ? undefined
      : body.autonomy === "default"
        ? null
        : (body.autonomy as "ask" | "auto");
  const funnel =
    body.funnel === undefined
      ? undefined
      : {
          segment: String(body.funnel?.segment ?? "all"),
          routeTo: String(body.funnel?.routeTo ?? "auto"),
        };
  await setAgentConfig(body.id, {
    displayName: body.displayName,
    enabled: body.enabled,
    autonomy,
    funnel,
  });
  return NextResponse.json({ ok: true });
}

export const GET = tenantRoute(_GET);
export const PATCH = tenantRoute(_PATCH);

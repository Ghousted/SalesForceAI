import { NextResponse } from "next/server";
import { tenantRoute } from "@/lib/tenant";
import { connectConnector, disconnectConnector, syncConnector } from "@/lib/connectors";
import { isConnectorKind } from "@/lib/connectors/registry";

/**
 * POST /api/connectors/:kind  { action?: "connect" | "sync", token? }
 *   - action "sync" re-pulls an already-connected source
 *   - otherwise connects (HubSpot: requires token)
 * DELETE /api/connectors/:kind  disconnects.
 */
async function _POST(req: Request, ctx: { params: Promise<{ kind: string }> }) {
  const { kind } = await ctx.params;
  if (!isConnectorKind(kind)) return NextResponse.json({ error: "Unknown connector" }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  try {
    const view =
      body?.action === "sync"
        ? await syncConnector(kind)
        : await connectConnector(kind, { token: body?.token });
    return NextResponse.json({ connector: view });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 400 },
    );
  }
}

async function _DELETE(_req: Request, ctx: { params: Promise<{ kind: string }> }) {
  const { kind } = await ctx.params;
  if (!isConnectorKind(kind)) return NextResponse.json({ error: "Unknown connector" }, { status: 404 });
  return NextResponse.json({ connector: await disconnectConnector(kind) });
}

export const POST = tenantRoute(_POST);
export const DELETE = tenantRoute(_DELETE);

import { NextResponse } from "next/server";
import { tenantRoute } from "@/lib/tenant";
import { startOAuth } from "@/lib/connectors";
import { isConnectorKind } from "@/lib/connectors/registry";

export const dynamic = "force-dynamic";

/** Kick off an OAuth connect (Gmail / Outlook / Calendar): redirect to consent. */
async function _GET(req: Request, ctx: { params: Promise<{ kind: string }> }) {
  const { kind } = await ctx.params;
  if (!isConnectorKind(kind)) {
    return NextResponse.redirect(new URL("/connectors?error=unknown-connector", req.url));
  }
  try {
    const url = await startOAuth(kind, new URL(req.url).origin);
    return NextResponse.redirect(url);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "oauth-start-failed";
    return NextResponse.redirect(new URL(`/connectors?error=${encodeURIComponent(msg)}`, req.url));
  }
}

export const GET = tenantRoute(_GET);

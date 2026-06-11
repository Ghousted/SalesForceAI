import { NextResponse } from "next/server";
import { tenantRoute } from "@/lib/tenant";
import { completeOAuth } from "@/lib/connectors";
import { isConnectorKind } from "@/lib/connectors/registry";

export const dynamic = "force-dynamic";

/** The provider redirects here with ?code & ?state (or ?error). Finish, then return. */
async function _GET(req: Request, ctx: { params: Promise<{ kind: string }> }) {
  const { kind } = await ctx.params;
  const url = new URL(req.url);
  const error = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!isConnectorKind(kind)) {
    return NextResponse.redirect(new URL("/connectors?error=unknown-connector", req.url));
  }
  if (error) return NextResponse.redirect(new URL(`/connectors?error=${encodeURIComponent(error)}`, req.url));
  if (!code || !state) return NextResponse.redirect(new URL("/connectors?error=missing-code", req.url));

  try {
    await completeOAuth(kind, url.origin, code, state);
    return NextResponse.redirect(new URL(`/connectors?connected=${kind}`, req.url));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "oauth-failed";
    return NextResponse.redirect(new URL(`/connectors?error=${encodeURIComponent(msg)}`, req.url));
  }
}

export const GET = tenantRoute(_GET);

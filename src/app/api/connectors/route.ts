import { NextResponse } from "next/server";
import { tenantRoute } from "@/lib/tenant";
import { listConnectors } from "@/lib/connectors";

export const dynamic = "force-dynamic";

async function _GET() {
  return NextResponse.json({ connectors: await listConnectors() });
}

export const GET = tenantRoute(_GET);

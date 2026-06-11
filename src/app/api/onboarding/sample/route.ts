import { NextResponse } from "next/server";
import { tenantRoute } from "@/lib/tenant";
import { loadSampleData, clearSampleData } from "@/lib/db/sample-data";

export const dynamic = "force-dynamic";

/** POST → load the sample pack into this workspace; DELETE → clear it. */
async function _POST() {
  try {
    await loadSampleData();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Couldn't load sample data." },
      { status: 500 },
    );
  }
}

async function _DELETE() {
  try {
    await clearSampleData();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Couldn't clear sample data." },
      { status: 500 },
    );
  }
}

export const POST = tenantRoute(_POST);
export const DELETE = tenantRoute(_DELETE);

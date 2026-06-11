import { NextResponse } from "next/server";
import { tenantRoute } from "@/lib/tenant";
import { getSetupStatus, patchSetupState } from "@/lib/onboarding/setup";

export const dynamic = "force-dynamic";

/** GET → guide status; PATCH {dismiss} | {markDone} | {markUndone}. */
async function _GET() {
  return NextResponse.json({ setup: await getSetupStatus() });
}

async function _PATCH(req: Request) {
  const body = await req.json().catch(() => ({}));
  await patchSetupState({
    dismissed: typeof body?.dismiss === "boolean" ? body.dismiss : undefined,
    markDone: typeof body?.markDone === "string" ? body.markDone : undefined,
    markUndone: typeof body?.markUndone === "string" ? body.markUndone : undefined,
  });
  return NextResponse.json({ setup: await getSetupStatus() });
}

export const GET = tenantRoute(_GET);
export const PATCH = tenantRoute(_PATCH);

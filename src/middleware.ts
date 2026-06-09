import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Light access guard for the deployed single-workspace demo. Active only when
 * `APP_PASSWORD` is set — local dev (no password) is unguarded. The cron tick
 * endpoint is exempt (it has its own `CRON_SECRET`).
 */
export function middleware(req: NextRequest) {
  const pw = process.env.APP_PASSWORD;
  if (!pw) return NextResponse.next();
  if (req.nextUrl.pathname.startsWith("/api/triggers/tick")) return NextResponse.next();

  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Basic ")) {
    const decoded = atob(auth.slice(6));
    const pass = decoded.slice(decoded.indexOf(":") + 1);
    if (pass === pw) return NextResponse.next();
  }
  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Sales OS"' },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Auth gate. Public: the landing page, the auth pages + endpoints, and the cron
 * tick (it carries its own CRON_SECRET). Everything else requires a session
 * cookie — its presence is checked cheaply here at the edge; the real
 * validation (DB lookup) happens in the server components via getCurrentUser().
 *
 * The cookie name is inlined (not imported from lib/auth/session) so this Edge
 * bundle doesn't pull in the Node-only DB client.
 */

const SESSION_COOKIE = "salesos_session";
const PUBLIC_PAGES = new Set(["/", "/login", "/signup"]);

function isPublic(pathname: string): boolean {
  if (PUBLIC_PAGES.has(pathname)) return true;
  if (pathname.startsWith("/api/auth/")) return true;
  if (pathname.startsWith("/api/triggers/tick")) return true;
  return false;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  const hasSession = Boolean(req.cookies.get(SESSION_COOKIE)?.value);
  if (hasSession) return NextResponse.next();

  // No session: APIs get a 401, page requests bounce to login.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

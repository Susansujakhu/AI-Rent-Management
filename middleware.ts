import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// Paths exempt from CSRF: bearer-token-authed callers (server-to-server, cron)
// that won't send a browser Origin/Referer header.
const CSRF_EXEMPT_PREFIXES = ["/api/cron/"];

function hostMatches(headerValue: string | null, host: string): boolean {
  if (!headerValue) return false;
  try {
    const headerHost = new URL(headerValue).host;
    return headerHost.toLowerCase() === host.toLowerCase();
  } catch {
    return false;
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // CSRF: for mutating API requests, require either Origin or Referer to
  // match Host. Browsers always send at least one on cross-origin POSTs;
  // requests with neither are almost certainly non-browser and should not
  // be allowed to drive cookie-authed mutations.
  if (
    pathname.startsWith("/api/") &&
    MUTATING_METHODS.has(request.method) &&
    !CSRF_EXEMPT_PREFIXES.some(p => pathname.startsWith(p))
  ) {
    const host    = request.headers.get("host") ?? "";
    const origin  = request.headers.get("origin");
    const referer = request.headers.get("referer");

    const ok = hostMatches(origin, host) || hostMatches(referer, host);
    if (!ok) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  if (!pathname.startsWith("/portal")) return NextResponse.next();

  // ── Feature flag ──────────────────────────────────────────────────────────
  if (process.env.TENANT_PORTAL_ENABLED !== "true") {
    return NextResponse.json(
      { error: "Tenant portal is not enabled." },
      { status: 404 }
    );
  }

  // All portal routes are allowed through — each page validates its own token/session
  return NextResponse.next();
}

export const config = {
  matcher: ["/portal/:path*", "/api/:path*"],
};

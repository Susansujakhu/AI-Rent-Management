import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Routes inside /portal that don't need a tenant session
const PORTAL_PUBLIC = ["/portal", "/portal/disabled"];
const PORTAL_TOKEN_PREFIX = "/portal/t/";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // CSRF: for mutating API requests, Origin must match Host
  if (pathname.startsWith("/api/") && MUTATING_METHODS.has(request.method)) {
    const origin = request.headers.get("origin");
    if (origin) {
      try {
        const originHost = new URL(origin).host;
        const host = request.headers.get("host") ?? "";
        if (originHost !== host) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
      } catch {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
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

  // ── Public portal routes (no session needed) ──────────────────────────────
  if (
    PORTAL_PUBLIC.includes(pathname) ||
    pathname.startsWith(PORTAL_TOKEN_PREFIX)
  ) {
    return NextResponse.next();
  }

  // ── Protected portal routes — require tenant session cookie ───────────────
  // Full session validation (DB lookup) happens in lib/tenant-auth.ts.
  // Middleware only checks cookie presence to avoid DB calls at the edge.
  const session = request.cookies.get("rms_tenant_session");
  if (!session?.value) {
    return NextResponse.redirect(new URL("/portal", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/portal/:path*", "/api/:path*"],
};

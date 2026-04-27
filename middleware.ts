import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

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

  // All portal routes are allowed through — each page validates its own token/session
  return NextResponse.next();
}

export const config = {
  matcher: ["/portal/:path*", "/api/:path*"],
};

import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { setTenantSessionCookie } from "@/lib/tenant-auth";

type Params = { params: Promise<{ token: string }> };

type TenantRow = { id: string; portalEnabled: number | boolean };

// Whitelist of cookie-based portal paths the bootstrap can land on.
const ALLOWED_REDIRECTS = new Set([
  "/portal/dashboard",
  "/portal/payments",
  "/portal/charges",
  "/portal/electricity",
  "/portal/maintenance",
  "/portal/profile",
]);

export async function GET(req: Request, { params }: Params) {
  const { token } = await params;

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim()
    ?? req.headers.get("x-real-ip")
    ?? "unknown";

  // Use the real public host, not the internal Passenger/Node binding
  const proto   = req.headers.get("x-forwarded-proto") ?? "https";
  const host    = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "localhost:3000";
  const baseUrl = `${proto}://${host}`;

  if (!checkRateLimit(`portal_token_${ip}`, 10, 15 * 60 * 1000)) {
    return NextResponse.redirect(`${baseUrl}/portal?error=invalid`);
  }

  const rows = await prisma.$queryRaw<TenantRow[]>`
    SELECT id, portalEnabled
    FROM \`Tenant\`
    WHERE portalToken = ${token}
    LIMIT 1
  `;
  const tenant = rows[0];

  if (!tenant || !(tenant.portalEnabled === 1 || tenant.portalEnabled === true)) {
    return NextResponse.redirect(`${baseUrl}/portal?error=invalid`);
  }

  // Mint a cookie-backed session so the token can be stripped from the URL.
  // The cookie is the real long-lived credential from this point on.
  const sessionToken = randomBytes(32).toString("hex");
  const expiresAt    = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await prisma.tenantSession.create({
    data: { tenantId: tenant.id, token: sessionToken, expiresAt },
  });

  // Honour the `redirect` query param only if it points at a known cookie-based
  // portal page — otherwise fall back to the dashboard. The legacy
  // /portal/<token>/<page> URLs are intentionally rejected here so the bootstrap
  // always lands on the token-free tree.
  const redirectParam = new URL(req.url).searchParams.get("redirect");
  const target = redirectParam && ALLOWED_REDIRECTS.has(redirectParam)
    ? redirectParam
    : "/portal/dashboard";

  const res = NextResponse.redirect(`${baseUrl}${target}`);
  setTenantSessionCookie(res, sessionToken);
  return res;
}

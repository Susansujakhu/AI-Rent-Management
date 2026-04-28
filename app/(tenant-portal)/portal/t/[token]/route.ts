import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";

type Params = { params: Promise<{ token: string }> };

type TenantRow = { id: string; portalEnabled: number | boolean };

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

  const redirectParam = new URL(req.url).searchParams.get("redirect");
  const safePath = redirectParam?.startsWith(`/portal/${token}/`) ? redirectParam : `/portal/${token}/dashboard`;

  return NextResponse.redirect(`${baseUrl}${safePath}`);
}

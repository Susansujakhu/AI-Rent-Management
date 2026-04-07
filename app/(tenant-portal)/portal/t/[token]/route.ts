import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { randomBytes } from "crypto";
import { setTenantSessionCookie } from "@/lib/tenant-auth";
import { checkRateLimit } from "@/lib/rate-limit";

type Params = { params: Promise<{ token: string }> };

export async function GET(req: Request, { params }: Params) {
  const { token } = await params;

  // Rate-limit per IP to prevent brute-force token guessing
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim()
    ?? req.headers.get("x-real-ip")
    ?? "unknown";

  if (!checkRateLimit(`portal_token_${ip}`, 10, 5 * 60 * 1000)) {
    return NextResponse.redirect(new URL("/portal?error=invalid", req.url));
  }

  const tenant = await prisma.tenant.findUnique({
    where: { portalToken: token },
  });

  if (!tenant || !tenant.portalEnabled) {
    return NextResponse.redirect(new URL("/portal?error=invalid", req.url));
  }

  const sessionToken = randomBytes(32).toString("hex");
  const expiresAt    = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await prisma.tenantSession.create({
    data: { tenantId: tenant.id, token: sessionToken, expiresAt },
  });

  const res = NextResponse.redirect(new URL("/portal/dashboard", req.url));
  setTenantSessionCookie(res, sessionToken);
  return res;
}

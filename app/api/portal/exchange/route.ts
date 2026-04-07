import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { randomBytes } from "crypto";
import { setTenantSessionCookie } from "@/lib/tenant-auth";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(req: Request) {
  // Rate-limit token exchanges per IP
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim()
    ?? req.headers.get("x-real-ip")
    ?? "unknown";

  if (!checkRateLimit(`portal_exchange_${ip}`, 10, 5 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const { token } = body;

  if (typeof token !== "string" || !token) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }

  const tenant = await prisma.tenant.findUnique({
    where: { portalToken: token },
  });

  if (!tenant || !tenant.portalEnabled) {
    return NextResponse.json({ error: "Invalid or expired access link." }, { status: 401 });
  }

  const sessionToken = randomBytes(32).toString("hex");
  const expiresAt    = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  await prisma.tenantSession.create({
    data: { tenantId: tenant.id, token: sessionToken, expiresAt },
  });

  const res = NextResponse.json({ ok: true });
  setTenantSessionCookie(res, sessionToken);
  return res;
}

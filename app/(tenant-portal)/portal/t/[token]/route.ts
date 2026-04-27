import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";

type Params = { params: Promise<{ token: string }> };

export async function GET(req: Request, { params }: Params) {
  const { token } = await params;

  // Rate-limit per IP to prevent brute-force token guessing
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim()
    ?? req.headers.get("x-real-ip")
    ?? "unknown";

  if (!checkRateLimit(`portal_token_${ip}`, 10, 15 * 60 * 1000)) {
    return NextResponse.redirect(new URL("/portal?error=invalid", req.url));
  }

  // Validate the token exists before redirecting
  const tenant = await prisma.tenant.findUnique({
    where:  { portalToken: token },
    select: { id: true, portalEnabled: true },
  });

  if (!tenant || !tenant.portalEnabled) {
    return NextResponse.redirect(new URL("/portal?error=invalid", req.url));
  }

  // Support ?redirect= for deep-linking into the token-based portal
  const redirectParam = new URL(req.url).searchParams.get("redirect");
  const safePath = redirectParam?.startsWith(`/portal/${token}/`) ? redirectParam : `/portal/${token}/dashboard`;

  return NextResponse.redirect(new URL(safePath, req.url));
}
